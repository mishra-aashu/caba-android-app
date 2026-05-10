import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Dexie from 'dexie';
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
import useChatStore from '../../store/useChatStore';

const STABLE_EMPTY_ARRAY = [];

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
            
            const collection = db.messages.where('[chatId+createdAt]')
                .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey]);
            
            const currentLimit = page * PAGE_SIZE;
            
            let latest = await collection
                .reverse()
                .limit(currentLimit)
                .toArray();
            
            if (latest.length === 0) {
                const fallbackMessages = await db.messages.where('chatId').equals(chatId).toArray();
                if (fallbackMessages.length > 0) {
                    latest = fallbackMessages
                        .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at))
                        .slice(0, currentLimit);
                }
            }
            
            return latest.sort((a, b) => new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at));
        },
        [chatId, page]
    );

    // [FIX] Update hasNextPage in an effect, not during render/query
    useEffect(() => {
        if (!chatId || chatId === 'new') {
            setHasNextPage(false);
            return;
        }
        
        const checkHasNext = async () => {
            try {
                const count = await db.messages.where('[chatId+createdAt]')
                    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
                    .count();
                setHasNextPage(count > page * PAGE_SIZE);
            } catch (err) {
                console.warn('[useChatMessages] hasNextPage check failed:', err);
            }
        };
        
        checkHasNext();
    }, [chatId, page, rawMessages?.length]);

    const setCachedMessages = useChatStore(state => state.setCachedMessages);
    const cachedMessages = useChatStore(state => state.chatMessagesCache[chatId]) || STABLE_EMPTY_ARRAY;

    // [STABILITY] Map raw messages to frontend format
    const mappedMessages = useMemo(() => {
        if (!rawMessages) return [];
        return rawMessages.map(msg => dbToFrontend(msg));
    }, [rawMessages]);

    // [STABILITY] Final messages array (prefers cache if loading)
    const messages = useMemo(() => {
        if (rawMessages === undefined && cachedMessages.length > 0) {
            return cachedMessages;
        }
        return mappedMessages;
    }, [rawMessages, cachedMessages, mappedMessages]);

    // [FIX] Update cache in an effect, not during render/memo
    useEffect(() => {
        if (mappedMessages.length > 0 && chatId && chatId !== 'new') {
            setCachedMessages(chatId, mappedMessages);
        }
    }, [chatId, mappedMessages, setCachedMessages]);

    // ─── OFFLINE-FIRST INITIALIZATION ───
    const [isSyncing, setIsSyncing] = useState(Boolean(navigator.onLine && chatId && chatId !== 'new'));

    useEffect(() => {
        if (navigator.onLine && chatId && chatId !== 'new') {
            setIsSyncing(true);
            import('../../services/syncService').then(({ syncService }) => {
                syncService.syncChat(chatId).finally(() => setIsSyncing(false));
            }).catch(() => setIsSyncing(false));
        }
    }, [chatId]);

    const isDexieLoading = rawMessages === undefined;
    // We only show the "loading" skeleton if we have absolutely nothing (no local DB data AND no in-memory cache)
    const isMessagesLoading = (isDexieLoading || isSyncing) && messages.length === 0;

    const fetchNextPage = useCallback(() => {
        if (!hasNextPage || isFetchingNextPage) return;
        setIsFetchingNextPage(true);
        setTimeout(() => {
            setPage(prev => prev + 1);
            setIsFetchingNextPage(false);
        }, 150);
    }, [hasNextPage, isFetchingNextPage]);

    const { status: connectionStatus, retry: retryConnection } = useRealtimeMessages(
        chatId,
        {
            onNewMessage: (msg) => onNewMessage?.(msg),
            onConnectionError: () => toast.error('Check your internet connection', { id: 'realtime-error' }),
        },
        currentUser?.id,
        otherUserId
    );

    const { mutateAsync: deleteMessageMutation } = useDeleteMessage(chatId);

    const deleteSelectedMessages = useCallback(async (selectedIds, callback) => {
        if (!selectedIds?.length) return;
        let previousMessages = [];
        try {
            for (const id of selectedIds) {
                const msg = await db.get('messages', id);
                if (msg) previousMessages.push(msg);
                await db.delete('messages', id);
            }
            const remaining = await db.getAll('messages', { chatId: String(chatId) });
            const sortedRemaining = remaining.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
            const latestMsg = sortedRemaining[0];
            if (latestMsg) {
                await db.update('chats_list', String(chatId), {
                    lastMessage: latestMsg.content || '📎 Media',
                    lastMessageAt: latestMsg.createdAt,
                    timestamp: latestMsg.createdAt,
                }).catch(() => {});
            }
        } catch (e) {}

        try {
            const { error } = await supabase.from('messages').delete().in('id', selectedIds);
            if (error) throw error;
            if (callback) callback();
            toast.success('Messages deleted');
        } catch (error) {
            if (previousMessages.length > 0) await db.messages.bulkPut(previousMessages);
            toast.error(error.message || 'Failed to delete messages');
        }
    }, [chatId, supabase]);

    const clearChat = useCallback(async () => {
        if (isNewChat) return;
        const backup = await db.messages.where('chatId').equals(chatId).toArray();
        try {
            await db.delete('messages', { chatId }); // Note: Need to verify if IDatabase.delete handles object filters
            // Actually, let's just use a query or a loop for now if delete only takes ID
            const allMsgs = await db.getAll('messages', { chatId });
            for (const m of allMsgs) await db.delete('messages', m.id);
            
            const { error } = await supabase.from('messages').delete().eq('chat_id', chatId);
            if (error) throw error;
            toast.success('Chat cleared');
        } catch (error) {
            if (backup.length > 0) await db.messages.bulkPut(backup);
            toast.error('Failed to clear chat');
        }
    }, [chatId, isNewChat, supabase]);

    const sendMessage = useCallback(async (content, vanishConfig = null) => {
        if (!content?.trim() || !currentUser) return null;
        
        const tempId = String(Date.now());
        const taskId = crypto.randomUUID(); // Idempotency Key
        
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
            status: 'sending', // Optimistic status
            tempId: tempId,
        };

        setReplyingTo(null);
        hapticsManager.impact();

        try {
            // 1. Optimistic Write to Local DB
            await db.set('messages', { ...frontendMsg, id: `temp_${tempId}` });
            await db.update('chats_list', String(chatId), {
                lastMessageAt: frontendMsg.createdAt,
                timestamp: frontendMsg.createdAt,
                lastMessage: frontendMsg.content,
                status: 'sending'
            }).catch(() => {});

            // 2. Queue for Processing (The Muscles)
            const dbData = frontendToDb(frontendMsg);
            await queueAction(QUEUE_ACTIONS.INSERT_MESSAGE, 'messages', dbData, { taskId });
            
            return { id: `temp_${tempId}`, ...frontendMsg };
        } catch (error) {
            console.error('[useChatMessages] Send failed:', error);
            await db.update('messages', `temp_${tempId}`, { status: 'failed' });
            hapticsManager.error();
            return null;
        }
    }, [chatId, otherUserId, isGroupChat, currentUser, replyingTo]);

    const toggleReaction = useCallback(async (messageId, emoji) => {
        if (!currentUser || !messageId) return;
        const message = messages.find(m => m.id === messageId);
        if (!message) return;
        const currentMetadata = message.metadata || {};
        const newMetadata = { ...currentMetadata };
        if (newMetadata[currentUser.id] === emoji) delete newMetadata[currentUser.id];
        else newMetadata[currentUser.id] = emoji;
        try {
            await db.messages.update(messageId, { metadata: newMetadata });
            const { error } = await supabase.from('messages').update({ metadata: newMetadata }).eq('id', messageId);
            if (error) throw error;
        } catch (error) {
            await db.messages.update(messageId, { metadata: currentMetadata });
            toast.error('Failed to update reaction');
        }
    }, [currentUser, messages, supabase]);

    const forwardMessages = useCallback(async (msgs, targetChat) => {
        if (!msgs?.length || !targetChat || !currentUser) return;
        const isTargetGroup = targetChat.isGroup || targetChat.is_group || false;
        
        for (const msg of msgs) {
            const tempId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
            const taskId = crypto.randomUUID();
            
            const frontendMsg = {
                chatId: targetChat.id,
                senderId: currentUser.id,
                receiverId: isTargetGroup ? currentUser.id : (targetChat.otherUser?.id || targetChat.receiver_id),
                content: msg.content,
                mediaPath: msg.mediaPath || msg.media_path,
                mediaType: msg.mediaType || msg.media_type,
                messageType: msg.messageType || msg.message_type || 'text',
                isGroupMessage: Boolean(isTargetGroup),
                replyTo: null,
                createdAt: new Date().toISOString(),
                status: 'sending',
                tempId,
            };

            try {
                await db.messages.put({ ...frontendMsg, id: `temp_${tempId}` });
                const dbData = frontendToDb(frontendMsg);
                await queueAction(QUEUE_ACTIONS.INSERT_MESSAGE, 'messages', dbData, { taskId });
            } catch (err) {
                console.error('[useChatMessages] Forward failed:', err);
            }
        }
        toast.success(`Forwarding ${msgs.length} messages...`);
    }, [currentUser]);

    return useMemo(() => ({
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
        handleReply: (msg) => setReplyingTo(msg),
        cancelReply: () => setReplyingTo(null),
        toggleReaction,
        isDexieLoading,
        handleManualRetry: async (tempId) => {
            const { manualRetrySyncItem } = await import('../../db/db');
            await manualRetrySyncItem(tempId);
            window.dispatchEvent(new Event('online'));
        },
    }), [
        messages, isMessagesLoading, isFetchingNextPage, hasNextPage, 
        fetchNextPage, connectionStatus, retryConnection, sendMessage, 
        forwardMessages, deleteMessageMutation, deleteSelectedMessages, 
        clearChat, replyingTo, toggleReaction, isDexieLoading
    ]);
}