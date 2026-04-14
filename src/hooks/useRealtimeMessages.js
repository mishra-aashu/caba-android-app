import { useEffect, useRef, useCallback, useState } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { supabase } from '../config/supabase';
import useUserStore from '../store/userStore';
import { safeDbConversion } from '../utils/dbFieldMapping';
import { db } from '../db/db';

function enrichSender(senderId) {
    const cached = useUserStore.getState().getUser(senderId);
    if (cached) return cached;
    return { id: senderId, name: 'Unknown', avatar: null };
}

export const useRealtimeMessages = (chatId, handlers = {}, currentUserId) => {
    const [status, setStatus] = useState('connecting');

    const processedIds = useRef(new Set());
    const handlersRef = useRef(handlers);
    const currentUserIdRef = useRef(currentUserId);
    const chatIdRef = useRef(chatId);
    const lastMessageRef = useRef(null);
    const catchUpTimerRef = useRef(null);
    const mountedRef = useRef(true);

    // Keep refs in sync to prevent stale closures
    useEffect(() => {
        handlersRef.current = handlers;
        currentUserIdRef.current = currentUserId;
        chatIdRef.current = chatId;
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, [handlers, currentUserId, chatId]);

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
                new Date(newRecord.created_at) > new Date(lastMessageRef.current.created_at)
            ) {
                lastMessageRef.current = { id: newRecord.id, created_at: newRecord.created_at };
            }

            // Cap dedup set size
            if (processedIds.current.size > 500) {
                const entries = Array.from(processedIds.current);
                processedIds.current = new Set(entries.slice(-250));
            }

            _log('Realtime INSERT', { id });
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

            try {
                await db.transaction('rw', db.messages, async () => {
                    if (newRecord.client_id) {
                        await db.messages.delete(`temp_${newRecord.client_id}`).catch(() => {});
                    }
                    // Store normalized message
                    await db.messages.put(finalMsg);
                });
            } catch (err) {
                console.error('Failed to save realtime msg to Dexie', err);
            }

            if (mountedRef.current && handlersRef.current.onNewMessage) {
                handlersRef.current.onNewMessage(enrichedMsg);
            }
        } else if (eventType === 'UPDATE' && newRecord) {
            try {
                const normalized = safeDbConversion(newRecord);
                await db.messages.update(newRecord.id, normalized);
            } catch (err) {
                console.error('Failed to update realtime msg in Dexie', err);
            }

            if (mountedRef.current && handlersRef.current.onUpdateMessage) {
                handlersRef.current.onUpdateMessage(newRecord);
            }
        } else if (eventType === 'DELETE' && oldRecord) {
            try {
                await db.messages.delete(oldRecord.id);
            } catch (err) {
                console.error('Failed to delete realtime msg from Dexie', err);
            }

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
                .where('chatId')
                .equals(currentChatId)
                .reverse()
                .sortBy('createdAt')
                .then(msgs => msgs[0]);
            
            if (latestInDexie) {
                lastMessageRef.current = { id: latestInDexie.id, created_at: latestInDexie.created_at };
                _log('Recovered anchor from Dexie', { anchor: lastMessageRef.current });
            }
        }

        let query = supabase
            .from('messages')
            .select('*')
            .eq('chat_id', currentChatId);

        if (lastMessageRef.current) {
            const { created_at, id } = lastMessageRef.current;
            query = query
                .or(`created_at.gt.${created_at},and(created_at.eq.${created_at},id.gt.${id})`)
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
                new Date(latestFromData.created_at) > new Date(lastMessageRef.current.created_at)
            ) {
                lastMessageRef.current = {
                    id: latestFromData.id,
                    created_at: latestFromData.created_at,
                };
                
                // Persist to chats_list
                await db.chats_list.update(currentChatId, { 
                    lastMessageAt: latestFromData.created_at 
                }).catch(() => {});
            }

            if (handlersRef.current.onCatchup) {
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

        // Debounced visibility handling
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                clearTimeout(catchUpTimerRef.current);
                catchUpTimerRef.current = setTimeout(() => {
                    if (!mountedRef.current) return;

                    _log('Visibility catch-up triggered');
                    const entry = realtimeManager.getChannel(channelName);
                    if (!entry || entry.status !== 'SUBSCRIBED') {
                        setupSubscription();
                    }
                    fetchMissedMessages();
                }, 300);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            clearTimeout(catchUpTimerRef.current);
            realtimeManager.unsubscribe(channelName);
            processedIds.current.clear();
        };
    }, [chatId, handlePayload, fetchMissedMessages, _log]);

    return { status, retry };
};

export default useRealtimeMessages;