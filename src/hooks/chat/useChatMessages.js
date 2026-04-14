import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { fetchMessagesPage, loadInitialMessagesIfNeeded } from '../../hooks/useMessages';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useDeleteMessage } from '../../hooks/useDeleteMessage';
import { frontendToDb, dbToFrontend } from '../../utils/dbFieldMapping';
import { db, addToSyncQueue } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import hapticsManager from '../../utils/hapticsManager';
import { useNavigate } from 'react-router-dom';

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

    // ─── DEXIE LIVE QUERY ───
    const limit = 50;
    const rawMessages = useLiveQuery(
        () => db.messages.where('chatId').equals(chatId).sortBy('createdAt'),
        [chatId]
    ) || [];

    const messages = useMemo(() => {
        // [PERF] Map only once per message; use memoized mapping
        return rawMessages.map(msg => dbToFrontend(msg));
    }, [rawMessages]);

    // ─── LOADING STATE ───
    const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

    useEffect(() => {
        setHasInitiallyLoaded(false);
        loadInitialMessagesIfNeeded(chatId).then(() => {
            setHasInitiallyLoaded(true);
        }).catch(() => {
            setHasInitiallyLoaded(true);
        });
    }, [chatId]);

    // [UX] Only consider "loading" if we have zero messages and haven't finished the initial sync check.
    // If we have cached messages, we show them immediately.
    const isMessagesLoading = !hasInitiallyLoaded && messages.length === 0;

    // ─── PAGINATION ───
    const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
    const lastFetchCountRef = useRef(limit);
    const hasNextPage = lastFetchCountRef.current === limit && rawMessages.length > 0;

    const fetchNextPage = useCallback(async () => {
        if (!hasNextPage || isFetchingNextPage) return;
        setIsFetchingNextPage(true);
        try {
            const firstMsg = rawMessages[0];
            const result = await fetchMessagesPage({
                chatId,
                beforeTimestamp: firstMsg.createdAt,
                limit,
            });
            lastFetchCountRef.current = result.count;
        } finally {
            setIsFetchingNextPage(false);
        }
    }, [chatId, hasNextPage, isFetchingNextPage, rawMessages]);

    // ─── REALTIME ───
    const { status: connectionStatus, retry: retryConnection } = useRealtimeMessages(
        chatId,
        {
            onNewMessage: (msg) => onNewMessage?.(msg),
            onConnectionError: () =>
                toast.error('Check your internet connection', { id: 'realtime-error' }),
        },
        currentUser?.id
    );

    // ─── DELETION ───
    const { mutateAsync: deleteMessageMutation } = useDeleteMessage(chatId);

    const deleteSelectedMessages = useCallback(
        async (selectedIds, callback) => {
            if (!selectedIds?.length) return;

            let previousMessages = [];
            try {
                previousMessages = await db.messages.where('id').anyOf(selectedIds).toArray();
                await db.messages.where('id').anyOf(selectedIds).delete();
            } catch (e) {
                console.error('Optimistic local delete failed', e);
            }

            try {
                const { data, error } = await supabase
                    .from('messages')
                    .delete()
                    .in('id', selectedIds)
                    .select('id');

                if (error) throw error;
                if (!data || data.length === 0) {
                    throw new Error('Deletion failed — likely RLS block');
                }

                if (callback) callback();
                toast.success('Messages deleted');
            } catch (error) {
                console.error('Error deleting messages:', error);
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
            const dbData = frontendToDb({
                chatId,
                senderId: currentUser.id,
                // [FIX #2] Group messages: use sender as receiver placeholder
                // Previously only fixed in useNetworkSync (offline path).
                // Online path was sending receiver_id: null → RLS/schema violation.
                receiverId: isGroupChat ? currentUser.id : otherUserId,
                content: content.trim(),
                isGroupMessage: Boolean(isGroupChat),
                replyTo: replyingTo?.id || null,
                messageType: 'text',
                createdAt: new Date().toISOString(),
                vanishAt: vanishConfig?.vanishAt || null,
                status: navigator.onLine ? 'sending' : 'pending',
                clientId: tempId,
            });

            setReplyingTo(null);
            hapticsManager.impact();

            try {
                await db.messages.put({
                    ...dbData,
                    id: `temp_${tempId}`,
                    tempId,
                });

                if (!navigator.onLine) {
                    await addToSyncQueue('send_message', { ...dbData, tempId });
                    return null;
                }

                const { data, error } = await supabase
                    .from('messages')
                    .insert(dbData)
                    .select()
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Message blocked by RLS');

                if (isNewChat) {
                    await db.messages.put(data);
                    navigate(`/chat/${data.chat_id}/${otherUserId}`, { replace: true });
                    return data;
                }

                await db.transaction('rw', db.messages, async () => {
                    await db.messages.delete(`temp_${tempId}`).catch(() => {});
                    await db.messages.put(data);
                });

                return data;
            } catch (error) {
                console.error('Send failed:', error);
                hapticsManager.error();
                toast.error('Failed to send message');
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
            // [FIX #3] tempId collision fix
            // Previously: String(Date.now() + Math.random()) — number addition, loses precision
            // Date.now() = 1719000000000, Math.random() = 0.123 → "1719000000000.123"
            // Two messages forwarded in same millisecond could collide.
            // Now: concatenation with underscore ensures uniqueness
            const tempId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

            const dbData = frontendToDb({
                chatId: targetChat.id,
                senderId: currentUser.id,
                // [FIX #2] Group receiver_id fix — same as sendMessage
                // Online inserts also need a valid receiver_id for groups
                receiverId: isTargetGroup
                    ? currentUser.id  // Sender placeholder for groups
                    : (targetChat.otherUser?.id || targetChat.receiver_id),
                content: msg.content,
                mediaPath: msg.mediaPath || msg.media_path,
                mediaType: msg.mediaType || msg.media_type,
                messageType: msg.messageType || msg.message_type || 'text',
                isGroupMessage: Boolean(isTargetGroup),
                replyTo: null,
                createdAt: new Date().toISOString(),
                status: navigator.onLine ? 'sending' : 'pending',
                clientId: tempId,
            });

            try {
                await db.messages.put({
                    ...dbData,
                    id: `temp_${tempId}`,
                    tempId,
                });

                if (!navigator.onLine) {
                    await addToSyncQueue('send_message', { ...dbData, tempId });
                } else {
                    const { data, error } = await supabase
                        .from('messages')
                        .insert(dbData)
                        .select()
                        .single();

                    if (error) throw error;

                    await db.transaction('rw', db.messages, async () => {
                        await db.messages.delete(`temp_${tempId}`).catch(() => {});
                        if (data) await db.messages.put(data);
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