import { useEffect, useRef, useCallback, useState } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { supabase } from '../config/supabase';
import useUserStore from '../store/userStore';
import { safeDbConversion } from '../utils/dbFieldMapping';
import { db } from '../db/db';
import { EncryptionService } from '../services/EncryptionService';

function enrichSender(senderId) {
    const cached = useUserStore.getState().getUser(senderId);
    if (cached) return cached;
    return { id: senderId, name: 'Unknown', avatar: null };
}

export const useRealtimeMessages = (chatId, handlers = {}, currentUserId, otherUserId = null) => {
    const [status, setStatus] = useState('connecting');

    const processedIds = useRef(new Set());
    const handlersRef = useRef(handlers);
    const currentUserIdRef = useRef(currentUserId);
    const chatIdRef = useRef(chatId);
    const otherUserIdRef = useRef(otherUserId);
    const lastMessageRef = useRef(null);
    const catchUpTimerRef = useRef(null);
    const mountedRef = useRef(true);
    const capacitorListenerRef = useRef(null);

    // Keep refs in sync to prevent stale closures
    useEffect(() => {
        handlersRef.current = handlers;
        currentUserIdRef.current = currentUserId;
        chatIdRef.current = chatId;
        otherUserIdRef.current = otherUserId;
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, [handlers, currentUserId, chatId, otherUserId]);

    const _log = useCallback((message, detail = {}) => {
        console.log(`[RT] ${message}`, { chat: chatIdRef.current, ...detail });
    }, []);

    const handlePayload = useCallback(async (payload) => {
        if (!mountedRef.current) return;

        const { eventType, new: newRecord, old: oldRecord } = payload;

        // Wrong-room guard (Case-insensitive)
        const msgChatId = newRecord?.chat_id || oldRecord?.chat_id;
        if (msgChatId && msgChatId.toLowerCase() !== String(chatIdRef.current).toLowerCase()) {
            console.warn('[RT] Wrong-room message ignored', {
                expected: chatIdRef.current,
                actual: msgChatId,
            });
            return;
        }

        const id = newRecord?.id ?? oldRecord?.id;
        if (!id) return;

        if (eventType === 'INSERT') {
            // ── Deduplication ──
            if (processedIds.current.has(id)) return;
            processedIds.current.add(id);

            // Track last message for monotonic catch-up
            if (
                !lastMessageRef.current ||
                new Date(newRecord.created_at) > new Date(lastMessageRef.current.createdAt)
            ) {
                lastMessageRef.current = { id: newRecord.id, createdAt: newRecord.created_at };
            }

            // Cap dedup set size
            if (processedIds.current.size > 500) {
                const entries = Array.from(processedIds.current);
                processedIds.current = new Set(entries.slice(-250));
            }

            _log('Realtime INSERT', { id });
            
            // Decrypt message content if encrypted
            if (newRecord.content) {
                newRecord.content = EncryptionService.decrypt(
                    newRecord.content, 
                    chatIdRef.current, 
                    otherUserIdRef.current
                );
            }

            const frontendMsg = safeDbConversion(newRecord);

            const senderId = frontendMsg.senderId || frontendMsg.sender_id;

            // ── [RESILIENCE] Enrichment with graceful fallback ──
            // If profile fetch fails, we still store the message with a placeholder
            // sender so the chat doesn't break silently. The `needsEnrichment` flag
            // allows lazy re-enrichment on next render or manual retry.
            let sender = enrichSender(senderId);
            try {
                const fetched = await useUserStore.getState().fetchUserIfNeeded(senderId);
                if (fetched) sender = fetched;
            } catch (enrichErr) {
                console.warn('[RT] Profile enrichment failed, using placeholder', { senderId, error: enrichErr?.message });
            }

            const enrichedMsg = {
                ...frontendMsg,
                sender,
                needsEnrichment: !sender?.name || sender.name === 'Unknown',
            };

            const finalMsg = {
                ...enrichedMsg,
                tempId: newRecord.client_id || undefined,
            };

            // [STATUS FIX] If the message from server is still 'sending' or missing status, fix it to 'sent'
            if (!finalMsg.status || finalMsg.status === 'sending') {
                finalMsg.status = 'sent';
            }

            try {
                await db.transaction('rw', [db.messages, db.chats_list], async () => {
                    if (newRecord.client_id) {
                        await db.messages.delete(`temp_${newRecord.client_id}`).catch(() => {});
                    }
                    // Store normalized message
                    await db.messages.put(finalMsg);

                    // Update chat list head (Ensure String ID for Dexie)
                    await db.chats_list.update(String(finalMsg.chatId), {
                        lastMessageAt: finalMsg.createdAt,
                        timestamp: finalMsg.createdAt,
                        lastMessage: finalMsg.content
                    }).catch(() => {});
                });
            } catch (err) {
                console.error('Failed to save realtime msg to Dexie', err);
            }

            if (mountedRef.current && handlersRef.current.onNewMessage) {
                handlersRef.current.onNewMessage(enrichedMsg);
            }
        } else if (eventType === 'UPDATE' && newRecord) {
            try {
                // Decrypt updated message content
                if (newRecord.content) {
                    newRecord.content = EncryptionService.decrypt(
                        newRecord.content, 
                        chatIdRef.current, 
                        otherUserIdRef.current
                    );
                }
                const normalized = safeDbConversion(newRecord);
                await db.messages.update(newRecord.id, normalized);
            } catch (err) {
                console.error('Failed to update realtime msg in Dexie', err);
            }

            if (mountedRef.current && handlersRef.current.onUpdateMessage) {
                handlersRef.current.onUpdateMessage(newRecord);
            }
        } else if (eventType === 'DELETE' && oldRecord) {
            // [PRIVACY FIX] Do NOT delete from Dexie when the server deletes the message.
            // Our server now auto-deletes messages after they are read for privacy.
            // If we delete here, the message disappears from the phone too!
            // Local deletion should only happen via manual user action or 'is_deleted' flag updates.
            _log('Server deleted message row (Privacy Cleanup) - keeping local copy');

            if (mountedRef.current && handlersRef.current.onDeleteMessage) {
                handlersRef.current.onDeleteMessage(oldRecord.id);
            }
        }
    }, [_log]);

    /**
     * Catch-up: fetch missed messages anchored to last known message
     *
     * [FIX #12] safeDbConversion was being called multiple times redundantly.
     * Now called once and result is reused.
     */
    const fetchMissedMessages = useCallback(async (isReconnect = false) => {
        if (!chatIdRef.current || chatIdRef.current === 'new' || !mountedRef.current) return;

        const currentChatId = chatIdRef.current;
        _log('Catch-up fetch started', { isReconnect });

        // ── 1. Recovery: If lastMessageRef is null, try to load from Dexie ──
        if (!lastMessageRef.current) {
            const latestInDexie = await db.messages
                .where('[chatId+createdAt]')
                .between([currentChatId, db.constructor.minKey], [currentChatId, db.constructor.maxKey])
                .reverse()
                .first();
            
            if (latestInDexie) {
                lastMessageRef.current = { id: latestInDexie.id, createdAt: latestInDexie.createdAt };
                _log('Recovered anchor from Dexie', { anchor: lastMessageRef.current });
            }
        }

        let query = supabase
            .from('messages')
            .select('*')
            .eq('chat_id', currentChatId);

        if (lastMessageRef.current?.createdAt) {
            const { createdAt, id } = lastMessageRef.current;
            query = query
                .or(`created_at.gt.${createdAt},and(created_at.eq.${createdAt},id.gt.${id})`)
                .order('created_at', { ascending: true })
                .limit(100);
        } else {
            query = query.order('created_at', { ascending: false }).limit(50);
        }

        const { data, error } = await query;

        if (error) {
            _log('Catch-up fetch failed', { error });
            return;
        }

        if (data && data.length > 0 && mountedRef.current) {
            // Update anchor to newest message
            const sorted = [...data].sort(
                (a, b) => new Date(b.created_at) - new Date(a.created_at)
            );
            const latestFromData = sorted[0];

            if (
                !lastMessageRef.current ||
                new Date(latestFromData.created_at) > new Date(lastMessageRef.current.createdAt)
            ) {
                lastMessageRef.current = {
                    id: latestFromData.id,
                    createdAt: latestFromData.created_at,
                };
                
                // Persist to chats_list (Ensure String ID for Dexie)
                await db.chats_list.update(String(currentChatId), { 
                    lastMessageAt: latestFromData.created_at 
                }).catch(() => {});
            }

            if (handlersRef.current.onCatchup) {
                // Decrypt all caught up messages
                data.forEach(msg => {
                    if (msg.content) {
                        msg.content = EncryptionService.decrypt(
                            msg.content, 
                            currentChatId, 
                            otherUserIdRef.current
                        );
                    }
                });
                
                const converted = safeDbConversion(data);
                const frontendMsgs = Array.isArray(converted) ? converted : [converted];

                const senderIds = Array.from(new Set(frontendMsgs.map((m) => m.senderId)));
                // [RESILIENCE] Fetch profiles individually so one failure doesn't abort the batch
                await Promise.all(
                    senderIds.map((sid) =>
                        useUserStore.getState().fetchUserIfNeeded(sid).catch((e) => {
                            console.warn('[RT] Catch-up enrichment failed for sender', { sid, error: e?.message });
                        })
                    )
                );

                const enriched = frontendMsgs.map((m) => ({
                    ...m,
                    sender:
                        useUserStore.getState().getUser(m.senderId) || enrichSender(m.senderId),
                }));

                try {
                    await db.messages.bulkPut(enriched);
                } catch (err) {
                    console.error('Failed to catch up messages in Dexie', err);
                }

                handlersRef.current.onCatchup(enriched);
            }
        }
    }, [_log]);

    const retry = useCallback(() => {
        if (!chatIdRef.current || chatIdRef.current === 'new') return;
        const channelName = `chat_messages_${chatIdRef.current}`;
        setStatus('connecting'); // Immediate feedback on manual retry
        realtimeManager.refreshChannel(channelName);
        fetchMissedMessages(true);
    }, [fetchMissedMessages]);

    useEffect(() => {
        if (!chatId || chatId === 'new') return;

        const channelName = `chat_messages_${chatId}`;

        const setupSubscription = () => {
            realtimeManager.subscribe(
                channelName,
                {},
                {
                    postgres_changes: [
                        {
                            event: '*',
                            schema: 'public',
                            table: 'messages',
                            filter: `chat_id=eq.${chatId}`,
                            handler: handlePayload,
                        },
                    ],
                    onStatusChange: (newStatus) => {
                        if (mountedRef.current) {
                            const mapped =
                                newStatus === 'SUBSCRIBED'
                                    ? 'connected'
                                    : newStatus === 'SUBSCRIBING' || newStatus === 'RECONNECTING'
                                        ? 'connecting'
                                        : 'disconnected';
                            
                            // [UX] Delay reporting 'connecting' to prevent immediate banner flashes
                            if (mapped === 'connecting') {
                                setTimeout(() => {
                                    if (mountedRef.current) setStatus(mapped);
                                }, 2000);
                            } else {
                                setStatus(mapped);
                            }
                        }
                    },
                    onReconnect: () => {
                        fetchMissedMessages(true);
                    },
                    onMaxRetriesReached: () => {
                        if (mountedRef.current) setStatus('disconnected');
                        if (handlersRef.current.onConnectionError) {
                            handlersRef.current.onConnectionError();
                        }
                    },
                }
            );
        };

        setupSubscription();

        // ── Focus Recovery: Browser Tab + Capacitor Mobile ──
        // When user returns to the app (from another tab, another app on mobile,
        // or after locking the screen), we must catch up on missed messages.
        
        const performFocusCatchup = () => {
            clearTimeout(catchUpTimerRef.current);
            catchUpTimerRef.current = setTimeout(() => {
                if (!mountedRef.current) return;
                _log('Focus catch-up triggered');
                
                // Check if subscription is still alive
                const entry = realtimeManager.getChannel(channelName);
                if (!entry || entry.status !== 'SUBSCRIBED') {
                    _log('Subscription dead — re-subscribing');
                    setupSubscription();
                }
                // Always fetch missed messages on focus return
                fetchMissedMessages();
            }, 300);
        };

        // 1. Browser tab visibility (web + Android Chrome tab switching)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                performFocusCatchup();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // 2. Capacitor native app state (Android/iOS app switching, home button)
        const setupCapacitorListener = async () => {
            try {
                const { App } = await import('@capacitor/app');
                const handle = await App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive && mountedRef.current) {
                        _log('App came to foreground — catching up');
                        performFocusCatchup();
                    }
                });
                
                // [FIX] If component unmounted while listener was being created, remove it immediately
                if (!mountedRef.current) {
                    handle.remove();
                } else {
                    capacitorListenerRef.current = handle;
                }
            } catch {
                // Not a Capacitor environment — ignore
            }
        };
        setupCapacitorListener();

        return () => {
            mountedRef.current = false;
            document.removeEventListener('visibilitychange', handleVisibility);
            clearTimeout(catchUpTimerRef.current);
            
            if (capacitorListenerRef.current) {
                capacitorListenerRef.current.remove();
                capacitorListenerRef.current = null;
            }
            
            realtimeManager.unsubscribe(channelName);
            processedIds.current.clear();
        };
    }, [chatId, handlePayload, fetchMissedMessages, _log]);

    return { status, retry };
};

export default useRealtimeMessages;