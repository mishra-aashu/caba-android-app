import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useInfiniteMessages } from '../../hooks/useMessages';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useDeleteMessage } from '../../hooks/useDeleteMessage';
import { frontendToDb, dbToFrontend } from '../../utils/dbFieldMapping';
import { db, addToSyncQueue } from '../../db/db';
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [replyingTo, setReplyingTo] = useState(null);

  // ─── PAGINATION ───
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isMessagesLoading,
  } = useInfiniteMessages(chatId);

  // Flatten messages for UI (reverse to chronological order)
  const messages = useMemo(() => {
    if (!infiniteData?.pages) return [];
    const allMsgs = infiniteData.pages.flatMap((page) => page.data);
    return [...allMsgs].reverse();
  }, [infiniteData]);

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

      const previousData = queryClient.getQueryData(['messages', chatId]);

      // Optimistic update
      queryClient.setQueryData(['messages', chatId], (old) => {
        if (!old) return old;
        const idSet = new Set(selectedIds);
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((m) =>
              idSet.has(m.id) ? { ...m, is_deleted: true, isDeleted: true } : m
            ),
          })),
        };
      });

      try {
        const { data, error } = await supabase
          .from('messages')
          .update({ is_deleted: true })
          .in('id', selectedIds)
          .select('id');

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Deletion failed — likely RLS block');
        }

        await db.messages.where('id').anyOf(selectedIds).delete();

        if (callback) callback();
        toast.success('Messages deleted');
      } catch (error) {
        console.error('Error deleting messages:', error);
        queryClient.setQueryData(['messages', chatId], previousData);
        toast.error(error.message || 'Failed to delete messages');
      }
    },
    [chatId, supabase, queryClient]
  );

  const clearChat = useCallback(async () => {
    if (isNewChat) return;

    const previousData = queryClient.getQueryData(['messages', chatId]);

    queryClient.setQueryData(['messages', chatId], {
      pages: [{ data: [], nextCursor: null }],
      pageParams: [null],
    });

    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('chat_id', chatId);

      if (error) throw error;

      await db.messages.where('chat_id').equals(chatId).delete();
      toast.success('Chat cleared');
    } catch (error) {
      console.error('Error clearing chat:', error);
      queryClient.setQueryData(['messages', chatId], previousData);
      toast.error('Failed to clear chat');
    }
  }, [chatId, isNewChat, supabase, queryClient]);

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

      // Optimistic insert
      queryClient.setQueryData(['messages', chatId], (old) => {
        if (!old)
          return {
            pages: [{ data: [optimisticMsg], nextCursor: null }],
            pageParams: [null],
          };
        return {
          ...old,
          pages: old.pages.map((page, i) =>
            i === 0 ? { ...page, data: [optimisticMsg, ...page.data] } : page
          ),
        };
      });

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
          queryClient.setQueryData(['messages', data.chat_id], {
            pages: [{ data: [finalMsg], nextCursor: null }],
            pageParams: [null],
          });
          navigate(`/chat/${data.chat_id}/${otherUserId}`, { replace: true });
          return data;
        }

        // Replace optimistic with real
        queryClient.setQueryData(['messages', chatId], (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((msg) =>
                msg.tempId === tempId ? finalMsg : msg
              ),
            })),
          };
        });

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
      currentUser, replyingTo, supabase, queryClient, navigate,
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
    queryClient.setQueryData(['messages', chatId], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map(page => ({
          ...page,
          data: page.data.map(m => m.id === messageId ? { ...m, metadata: newMetadata } : m)
        }))
      };
    });

    try {
      const { error } = await supabase
        .from('messages')
        .update({ metadata: newMetadata })
        .eq('id', messageId);

      if (error) throw error;
      await db.messages.update(messageId, { metadata: newMetadata });
    } catch (error) {
      console.error('Error toggling reaction:', error);
      // Rollback
      queryClient.setQueryData(['messages', chatId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            data: page.data.map(m => m.id === messageId ? { ...m, metadata: currentMetadata } : m)
          }))
        };
      });
      toast.error('Failed to update reaction');
    }
  }, [chatId, currentUser, messages, supabase, queryClient]);

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