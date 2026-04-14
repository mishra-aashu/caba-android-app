/**
 * useGroupMessages - Custom hook for Group Chat messages
 * Handles fetching messages and realtime subscriptions
 */

import { useState, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { fetchGroupMessages, sendGroupMessage, reportScreenshot } from '../services/groupService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { dbToFrontend } from '../utils/dbFieldMapping';

/**
 * Hook for fetching group messages
 * @param {string} groupId - Group ID
 * @param {string} currentUserId - Current user ID
 * @returns {Object} - Messages and loading states
 */
export const useGroupMessages = (groupId, currentUserId) => {
  const [typingUsers, setTypingUsers] = useState({});

  // Dexie live query
  const rawMessages = useLiveQuery(
    () => db.messages.where('chatId').equals(groupId).sortBy('createdAt'),
    [groupId]
  ) || [];

  const messages = rawMessages.map(msg => dbToFrontend(msg));
  const isLoading = rawMessages.length === 0;

  // Realtime subscription handled globally by useChatListRealtime / useRealtimeMessages 
  // No need to keep a discrete subscription here if we centralize, but leaving a basic stub
  // if needed. Group messages should follow the exact same path.
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
  const refreshMessages = useCallback(async () => {
    const freshMsgs = await fetchGroupMessages(groupId, 50);
    if(freshMsgs && freshMsgs.length > 0) {
       const { safeDbConversion } = await import('../utils/dbFieldMapping');
       await db.messages.bulkPut(safeDbConversion(freshMsgs));
    }
  }, [groupId]);

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
    isLoading,
    isFetching: false,
    error: null,
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
