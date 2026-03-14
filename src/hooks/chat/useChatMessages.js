import { useState, useCallback, useMemo, useEffect } from 'react';
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

/**
 * useChatMessages
 *
 * Handles all message-related operations:
 * - Infinite query fetching
 * - Realtime synchronization
 * - Optimistic sending (text)
 * - Deletion (single and bulk)
 * - Chat clearing
 * - Reply management
 */
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
    () => db.messages.where('chat_id').equals(chatId).sortBy('created_at'),
    [chatId]
  ) || [];

  const messages = useMemo(() => {
    return rawMessages.map(msg => dbToFrontend(msg));
  }, [rawMessages]);

  useEffect(() => {
    loadInitialMessagesIfNeeded(chatId);
  }, [chatId]);

  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const hasNextPage = rawMessages.length > 0 && rawMessages.length % limit === 0;

  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) return;
    setIsFetchingNextPage(true);
    const firstMsg = rawMessages[0];
    await fetchMessagesPage({ chatId, beforeTimestamp: firstMsg.created_at, limit });
    setIsFetchingNextPage(false);
  }, [chatId, hasNextPage, isFetchingNextPage, rawMessages]);

  const isMessagesLoading = rawMessages.length === 0;

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

      // Optimistic update - hard delete in Dexie
      // We don't rollback this block because we want it gone immediately, and it will be resynced if Supabase fails (by refetching) or we just accept the risk of it being out of sync briefly.
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
        // Rollback optimistic update
        if (previousMessages.length > 0) {
            try {
              await db.messages.bulkPut(previousMessages);
            } catch (e) {
               // Ignore
            }
        }
        toast.error(error.message || 'Failed to delete messages');
      }
    },
    [chatId, supabase]
  );

  const clearChat = useCallback(async () => {
    if (isNewChat) return;

    try {
      await db.messages.where('chat_id').equals(chatId).delete();
      
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId);

      if (error) throw error;

      toast.success('Chat cleared');
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast.error('Failed to clear chat');
    }
  }, [chatId, isNewChat, supabase]);

  // ─── SENDING ───
  const sendMessage = useCallback(
    async (content, vanishConfig = null) => {
      if (!content?.trim() || !currentUser) return null;

      const tempId = Date.now();
      const dbData = frontendToDb({
        chatId,
        senderId: currentUser.id,
        receiverId: isGroupChat ? null : otherUserId,
        content: content.trim(),
        isGroupMessage: Boolean(isGroupChat),
        replyTo: replyingTo?.id || null,
        messageType: 'text',
        createdAt: new Date().toISOString(),
        vanishAt: vanishConfig?.vanishAt || null,
        status: navigator.onLine ? 'sending' : 'pending',
        // FIX: Use camelCase — frontendToDb expects camelCase input
        clientId: String(tempId),
      });

      const optimisticMsg = {
        ...dbToFrontend(dbData),
        sender: currentUser,
        tempId,
      };

      setReplyingTo(null);
      hapticsManager.impact();

      try {
        // FIX: Use .put() instead of .add() to prevent duplicate key errors
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

        const finalMsg = { ...dbToFrontend(data), status: 'sent', sender: currentUser };

        // Handle transition from 'new' chat
        if (isNewChat) {
          await db.messages.put(data);
          navigate(`/chat/${data.chat_id}/${otherUserId}`, { replace: true });
          return data;
        }

        // FIX: Use transaction with .put() for safety
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

    // Optimistic update
    try {
      await db.messages.update(messageId, { metadata: newMetadata });
    } catch(e) { /* ignore */ }

    try {
      const { error } = await supabase
        .from('messages')
        .update({ metadata: newMetadata })
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling reaction:', error);
      // Rollback
      try {
        await db.messages.update(messageId, { metadata: currentMetadata });
      } catch(e) { /* ignore */ }
      toast.error('Failed to update reaction');
    }
  }, [currentUser, messages, supabase]);

  return {
    messages,
    isMessagesLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    connectionStatus,
    retryConnection,
    sendMessage,
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