import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { fetchMessagesPage, loadInitialMessagesIfNeeded } from '../../hooks/useMessages';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useDeleteMessage } from '../../hooks/useDeleteMessage';
import { frontendToDb, dbToFrontend } from '../../utils/dbFieldMapping';
import { db } from '../../db/db';
import { queueAction, QUEUE_ACTIONS } from '../../services/offlineQueue';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import hapticsManager from '../../utils/hapticsManager';
import { useNavigate } from 'react-router-dom';
import { EncryptionService } from '../../services/EncryptionService';

export function useChatMessages({
    chatId,
    otherUserId,
    isGroupChat,
    isNewChat,
    currentUser,
    onNewMessage,
}) {
    const { supabase } = useSupabase();
    const navigate = useNavigate();
    const [replyingTo, setReplyingTo] = useState(null);

    // ─── DEXIE LIVE QUERY (PAGINATED) ───
    const PAGE_SIZE = 50;
    const [page, setPage] = useState(1);
    const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
    const [hasNextPage, setHasNextPage] = useState(true);

    const rawMessages = useLiveQuery(
        async () => {
            if (!chatId || chatId === 'new') return [];
            
            // [ROOT FIX] Use compound index [chatId+createdAt] for reliable latest-message selection.
            // Old way (.reverse().limit()) was selecting by primary key (UUID), which is random.
            const collection = db.messages.where('[chatId+createdAt]')
                .between([chatId, db.constructor.minKey], [chatId, db.constructor.maxKey]);
            
            const count = await collection.count();
            const currentLimit = page * PAGE_SIZE;
            
            setHasNextPage(count > currentLimit);

            // Fetch truly latest messages and return them sorted ascending for the UI
            const latest = await collection
                .reverse()
                .limit(currentLimit)
                .toArray();
            
            return latest.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        },
        [chatId, page]
    ) || [];

    const messages = useMemo(() => {
        // [PERF] Map only once per message; use memoized mapping
        return rawMessages.map(msg => dbToFrontend(msg));
    }, [rawMessages]);

    // ─── OFFLINE-FIRST INITIALIZATION ───
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        // [PROFESSIONAL] Instead of blocking UI, we show cached messages immediately.
        // We trigger a "Quiet Sync" in the background only if online.
        if (navigator.onLine && chatId && chatId !== 'new') {
            setIsSyncing(true);
            import('../../services/syncService').then(({ syncService }) => {
                syncService.syncChat(chatId).finally(() => setIsSyncing(false));
            });
        }
    }, [chatId]);

    // [UX] messages.length > 0 means we have cache, so it's not "loading"
    const isMessagesLoading = messages.length === 0 && isSyncing;

    const fetchNextPage = useCallback(() => {
        if (!hasNextPage || isFetchingNextPage) return;
        
        setIsFetchingNextPage(true);
        // Small delay to prevent scroll jump and show spinner
        setTimeout(() => {
            setPage(prev => prev + 1);
            setIsFetchingNextPage(false);
        }, 150);
    }, [hasNextPage, isFetchingNextPage]);

    // ─── REALTIME ───
    const { status: connectionStatus, retry: retryConnection } = useRealtimeMessages(
        chatId,
        {
            onNewMessage: (msg) => onNewMessage?.(msg),
            onConnectionError: () =>
                toast.error('Check your internet connection', { id: 'realtime-error' }),
        },
        currentUser?.id,
        otherUserId
    );

    // ─── DELETION ───
    const { mutateAsync: deleteMessageMutation } = useDeleteMessage(chatId);

    const deleteSelectedMessages = useCallback(
        async (selectedIds, callback) => {
            if (!selectedIds?.length) return;

            // 1. Optimistic local delete
            let previousMessages = [];
            try {
                previousMessages = await db.messages.where('id').anyOf(selectedIds).toArray();
                await db.messages.where('id').anyOf(selectedIds).delete();
                
                // Update chat list preview after deletion
                const remaining = await db.messages
                    .where('chatId').equals(chatId)
                    .reverse().sortBy('createdAt');
                const latestMsg = remaining[0];
                if (latestMsg) {
                    await db.chats_list.update(chatId, {
                        lastMessage: latestMsg.content || '📎 Media',
                        lastMessageAt: latestMsg.createdAt,
                        timestamp: latestMsg.createdAt,
                    }).catch(() => {});
                }
            } catch (e) {
                console.error('Optimistic local delete failed', e);
            }

            try {
                const { error } = await supabase
                    .from('messages')
                    .delete()
                    .in('id', selectedIds);

                // Note: Supabase delete returns empty data even on success (RLS may filter rows)
                // We do NOT throw on empty response — the optimistic delete already handled the UI
                if (error) throw error;

                if (callback) callback();
                toast.success('Messages deleted');
            } catch (error) {
                console.error('Error deleting messages:', error);
                // Rollback optimistic delete on true network/server error
                if (previousMessages.length > 0) {
                    try {
                        await db.messages.bulkPut(previousMessages);
                    } catch (e) { /* ignore */ }
                }
                toast.error(error.message || 'Failed to delete messages');
            }
        },
        [chatId, supabase]
    );

    // ─── CLEAR CHAT WITH ROLLBACK ───
    const clearChat = useCallback(async () => {
        if (isNewChat) return;

        const backup = await db.messages.where('chatId').equals(chatId).toArray();

        try {
            await db.messages.where('chatId').equals(chatId).delete();

            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('chat_id', chatId);

            if (error) throw error;
            toast.success('Chat cleared');
        } catch (error) {
            console.error('Error clearing chat:', error);
            if (backup.length > 0) {
                try {
                    await db.messages.bulkPut(backup);
                } catch (e) {
                    console.error('Rollback failed:', e);
                }
            }
            toast.error('Failed to clear chat');
        }
    }, [chatId, isNewChat, supabase]);

    // ─── SENDING ───
    const sendMessage = useCallback(
        async (content, vanishConfig = null) => {
            if (!content?.trim() || !currentUser) return null;

            const tempId = String(Date.now());
            const frontendMsg = {
                chatId,
                senderId: currentUser.id,
                receiverId: isGroupChat ? currentUser.id : otherUserId,
                content: content.trim(),
                isGroupMessage: Boolean(isGroupChat),
                replyTo: replyingTo?.id || null,
                messageType: 'text',
                createdAt: new Date().toISOString(),
                vanishAt: vanishConfig?.vanishAt || null,
                status: navigator.onLine ? 'sending' : 'pending',
                tempId: tempId,
            };

            setReplyingTo(null);
            hapticsManager.impact();

            try {
                // 1. Optimistic Save to Dexie (Always use camelCase 'chatId')
                await db.transaction('rw', [db.messages, db.chats_list], async () => {
                    await db.messages.put({
                        ...frontendMsg,
                        id: `temp_${tempId}`,
                        tempId,
                    });
                    
                    // Update chat list head
                    await db.chats_list.update(chatId, {
                        lastMessageAt: frontendMsg.createdAt,
                        timestamp: frontendMsg.createdAt,
                        lastMessage: frontendMsg.content,
                        status: 'sending'
                    }).catch(() => {});
                });

                if (!navigator.onLine) {
                    await queueAction(QUEUE_ACTIONS.INSERT_MESSAGE, 'messages', frontendMsg);
                    return null;
                }

                // 2. Prepare for Supabase (Convert to snake_case and ENCRYPT)
                const dbData = frontendToDb(frontendMsg);
                
                // End-to-End Encryption before sending to server
                dbData.content = EncryptionService.encrypt(
                    dbData.content, 
                    chatId, 
                    isGroupChat ? null : otherUserId
                );

                // Online path: Perform Supabase insert
                const { data, error } = await supabase
                    .from('messages')
                    .insert(dbData)
                    .select()
                    .single();

                if (error) {
                    await db.messages.update(`temp_${tempId}`, { status: 'failed' });
                    await db.chats_list.update(chatId, { status: 'failed' }).catch(() => {});
                    throw error;
                }

                const normalizedData = dbToFrontend(data);
                
                // Decrypt the server response (which is encrypted) before saving locally
                if (normalizedData.content) {
                    normalizedData.content = EncryptionService.decrypt(
                        normalizedData.content, 
                        chatId, 
                        isGroupChat ? null : otherUserId
                    );
                }

                // 3. Swap temp message with real server data
                await db.transaction('rw', [db.messages, db.chats_list], async () => {
                    await db.messages.delete(`temp_${tempId}`).catch(() => {});
                    if (normalizedData) {
                        await db.messages.put(normalizedData);
                        
                        await db.chats_list.update(chatId, {
                            lastMessageAt: normalizedData.createdAt,
                            timestamp: normalizedData.createdAt,
                            lastMessage: normalizedData.content,
                            status: 'delivered'
                        }).catch(() => {});
                    }
                });

                return data;
            } catch (error) {
                console.error('Send failed, falling back to queue:', error);
                await queueAction(QUEUE_ACTIONS.INSERT_MESSAGE, 'messages', frontendMsg);
                hapticsManager.error();
                return null;
            }
        },
        [
            chatId, otherUserId, isGroupChat, isNewChat,
            currentUser, replyingTo, supabase, navigate,
        ]
    );

    const toggleReaction = useCallback(async (messageId, emoji) => {
        if (!currentUser || !messageId) return;

        const message = messages.find(m => m.id === messageId);
        if (!message) return;

        const currentMetadata = message.metadata || {};
        const newMetadata = { ...currentMetadata };

        if (newMetadata[currentUser.id] === emoji) {
            delete newMetadata[currentUser.id];
        } else {
            newMetadata[currentUser.id] = emoji;
        }

        try {
            await db.messages.update(messageId, { metadata: newMetadata });
        } catch (e) { /* ignore */ }

        try {
            const { error } = await supabase
                .from('messages')
                .update({ metadata: newMetadata })
                .eq('id', messageId);

            if (error) throw error;
        } catch (error) {
            console.error('Error toggling reaction:', error);
            try {
                await db.messages.update(messageId, { metadata: currentMetadata });
            } catch (e) { /* ignore */ }
            toast.error('Failed to update reaction');
        }
    }, [currentUser, messages, supabase]);

    // ─── FORWARD MESSAGES ───
    const forwardMessages = useCallback(async (msgs, targetChat) => {
        if (!msgs?.length || !targetChat || !currentUser) return;

        const isTargetGroup = targetChat.isGroup || targetChat.is_group || false;

        for (const msg of msgs) {
            // Unique tempId per message to avoid collisions
            const tempId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

            const frontendMsg = {
                chatId: targetChat.id,
                senderId: currentUser.id,
                receiverId: isTargetGroup
                    ? currentUser.id
                    : (targetChat.otherUser?.id || targetChat.receiver_id),
                content: msg.content,
                mediaPath: msg.mediaPath || msg.media_path,
                mediaType: msg.mediaType || msg.media_type,
                messageType: msg.messageType || msg.message_type || 'text',
                isGroupMessage: Boolean(isTargetGroup),
                replyTo: null,
                createdAt: new Date().toISOString(),
                status: navigator.onLine ? 'sending' : 'pending',
                tempId,
            };

            try {
                // Optimistic save to Dexie (camelCase)
                await db.messages.put({
                    ...frontendMsg,
                    id: `temp_${tempId}`,
                });

                if (!navigator.onLine) {
                    await queueAction(QUEUE_ACTIONS.INSERT_MESSAGE, 'messages', frontendMsg);
                } else {
                    // Convert to snake_case and ENCRYPT only for server
                    const dbData = frontendToDb(frontendMsg);
                    dbData.content = EncryptionService.encrypt(
                        dbData.content, 
                        targetChat.id, 
                        isTargetGroup ? null : (targetChat.otherUser?.id || targetChat.receiver_id)
                    );

                    const { data, error } = await supabase
                        .from('messages')
                        .insert(dbData)
                        .select()
                        .single();

                    if (error) throw error;

                    // Swap temp with real server record
                    const normalizedData = dbToFrontend(data);
                    await db.transaction('rw', db.messages, async () => {
                        await db.messages.delete(`temp_${tempId}`).catch(() => {});
                        if (normalizedData) await db.messages.put(normalizedData);
                    });
                }
            } catch (err) {
                console.error('[Forward] Failed for msg:', msg.id, err);
            }
        }
        toast.success(`Forwarded ${msgs.length} message${msgs.length > 1 ? 's' : ''}`);
    }, [currentUser, supabase]);

    return {
        messages,
        isMessagesLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        connectionStatus,
        retryConnection,
        sendMessage,
        forwardMessages,
        deleteMessage: deleteMessageMutation,
        deleteSelectedMessages,
        clearChat,
        replyingTo,
        setReplyingTo,
        handleReply: useCallback((msg) => setReplyingTo(msg), []),
        cancelReply: useCallback(() => setReplyingTo(null), []),
        toggleReaction,
    };
}