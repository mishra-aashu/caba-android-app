import { useEffect, useCallback } from 'react';
import { useSupabase } from '../../../contexts/SupabaseContext';

export const useMessageStatus = (chatId, currentUserId) => {
  const { supabase } = useSupabase();

  // Mark messages as read - DISABLED until message_reads table is created
  const markAsRead = useCallback(async (messageIds) => {
    return [];
  }, [currentUserId, supabase]);

  // Update message status (sent, delivered, read)
  const updateMessageStatus = useCallback(async (messageId, status) => {
    if (!messageId || !status) return null;

    try {
      const { data, error } = await supabase
        .from('messages')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating message status:', error);
      throw error;
    }
  }, [supabase]);

  // Set up real-time subscription for message status updates
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`message_status:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          // Handle message status updates
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, supabase]);

  // DISABLED: Set up real-time subscription for read receipts
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`read_receipts_disabled:${chatId}`)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, supabase]);

  // Mark all messages in chat as read - DISABLED
  const markAllAsRead = useCallback(async () => {
    return false;
  }, [chatId, currentUserId, markAsRead]);

  // Get read status for messages - DISABLED
  const getReadStatus = useCallback(async (messageIds) => {
    return {};
  }, [supabase]);

  return {
    markAsRead,
    markAllAsRead,
    updateMessageStatus,
    getReadStatus,
  };
};

export default useMessageStatus;
