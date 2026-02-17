/**
 * useGroupMessages - Custom hook for Group Chat messages
 * Handles fetching messages and realtime subscriptions
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { fetchGroupMessages, sendGroupMessage, reportScreenshot } from '../services/groupService';

/**
 * Hook for fetching group messages
 * @param {string} groupId - Group ID
 * @param {string} currentUserId - Current user ID
 * @returns {Object} - Messages and loading states
 */
export const useGroupMessages = (groupId, currentUserId) => {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});

  // TanStack Query for messages
  const { data: queryMessages, isLoading, isFetching, error } = useQuery({
    queryKey: ['groupMessages', groupId],
    queryFn: () => fetchGroupMessages(groupId, 50),
    enabled: !!groupId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  // Update messages when query data changes
  useEffect(() => {
    if (queryMessages && queryMessages.length > 0) {
      setMessages(queryMessages);
    }
  }, [queryMessages]);

  // Handle new message from realtime
  const handleNewMessage = useCallback((payload) => {
    const newMessage = payload.new;
    
    // Only add if it's for this group and not from current user (to avoid duplicates)
    if (newMessage.chat_id === groupId) {
      setMessages(prev => {
        // Check for duplicates
        const exists = prev.some(msg => msg.id === newMessage.id);
        if (exists) return prev;
        
        // Fetch sender details for the new message
        return [...prev, newMessage];
      });
    }
  }, [groupId]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!groupId) return;

    const messagesChannel = supabase
      .channel(`group_messages_${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${groupId}`,
      }, handleNewMessage)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${groupId}`,
      }, (payload) => {
        const updatedMessage = payload.new;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === updatedMessage.id ? updatedMessage : msg
          )
        );
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${groupId}`,
      }, (payload) => {
        const deletedMessage = payload.old;
        setMessages(prev =>
          prev.filter(msg => msg.id !== deletedMessage.id)
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [groupId, handleNewMessage]);

  // Send message function
  const sendMessage = useCallback(async ({
    content,
    mediaPath = null,
    mediaType = null,
    isAnonymous = false,
    unlockAt = null,
    replyTo = null,
  }) => {
    if (!content.trim() || !currentUserId) return;

    try {
      const message = await sendGroupMessage({
        chatId: groupId,
        senderId: currentUserId,
        content: content.trim(),
        mediaPath,
        mediaType,
        isAnonymous,
        unlockAt,
        replyTo,
      });

      // Message will be added via realtime subscription
      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [groupId, currentUserId]);

  // Report screenshot
  const reportScreenCapture = useCallback(async (messageId) => {
    if (!currentUserId) return;
    
    try {
      await reportScreenshot(groupId, currentUserId, messageId);
    } catch (error) {
      console.error('Error reporting screenshot:', error);
    }
  }, [groupId, currentUserId]);

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    if (!groupId || !currentUserId) return;

    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('chat_id', groupId)
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [groupId, currentUserId]);

  // Refresh messages
  const refreshMessages = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['groupMessages', groupId] });
  }, [groupId, queryClient]);

  // Get unlocked messages (filter time capsule)
  const getUnlockedMessages = useCallback(() => {
    const now = new Date();
    return messages.map(msg => {
      // If message has unlock_at and it's not yet unlocked, hide content
      if (msg.unlock_at && new Date(msg.unlock_at) > now) {
        return {
          ...msg,
          isLocked: true,
          content: '🔒 This message is locked',
        };
      }
      return { ...msg, isLocked: false };
    });
  }, [messages]);

  return {
    messages,
    setMessages,
    isLoading: isLoading && !messages.length,
    isFetching,
    error,
    sendMessage,
    reportScreenCapture,
    markAsRead,
    refreshMessages,
    getUnlockedMessages,
    typingUsers,
    setTypingUsers,
  };
};

export default useGroupMessages;
