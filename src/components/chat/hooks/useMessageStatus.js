import { useEffect, useCallback } from 'react';
import { useSupabase } from '../../../contexts/SupabaseContext';

export const useMessageStatus = (chatId, currentUserId) => {
  const { supabase } = useSupabase();
  
  // Mark messages as read
  const markAsRead = useCallback(async (messageIds) => {
    if (!messageIds || !messageIds.length || !currentUserId) return [];
    
    try {
      // Prepare read receipts
      const readReceipts = messageIds.map(messageId => ({
        message_id: messageId,
        user_id: currentUserId,
        read_at: new Date().toISOString(),
      }));
      
      // Upsert read receipts
      const { data, error } = await supabase
        .from('message_reads')
        .upsert(readReceipts, { onConflict: 'message_id,user_id' })
        .select();
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
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
          console.log('Message status updated:', payload);
          // You can add custom logic here to handle status updates
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, supabase]);
  
  // Set up real-time subscription for read receipts
  useEffect(() => {
    if (!chatId) return;
    
    const channel = supabase
      .channel(`read_receipts:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
          filter: `message_id=in.(${chatId})`
        },
        (payload) => {
          // Handle read receipts
          console.log('Message read receipt:', payload);
          // You can add custom logic here to handle read receipts
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, supabase]);
  
  // Mark all messages in chat as read
  const markAllAsRead = useCallback(async () => {
    if (!chatId || !currentUserId) return false;
    
    try {
      // Get all unread messages in the chat
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', chatId)
        .neq('sender_id', currentUserId)
        .filter('read_by', 'not.cs', `{${currentUserId}}`);
      
      if (fetchError) throw fetchError;
      
      if (!unreadMessages.length) return true;
      
      // Mark all as read
      await markAsRead(unreadMessages.map(msg => msg.id));
      
      return true;
    } catch (error) {
      console.error('Error marking all messages as read:', error);
      return false;
    }
  }, [chatId, currentUserId, markAsRead]);
  
  // Get read status for messages
  const getReadStatus = useCallback(async (messageIds) => {
    if (!messageIds || !messageIds.length) return {};
    
    try {
      const { data, error } = await supabase
        .from('message_reads')
        .select('message_id, user_id, read_at, user:profiles!user_id(id, name, avatar_url)')
        .in('message_id', messageIds);
      
      if (error) throw error;
      
      // Group by message_id
      return (data || []).reduce((acc, receipt) => {
        if (!acc[receipt.message_id]) {
          acc[receipt.message_id] = [];
        }
        acc[receipt.message_id].push(receipt);
        return acc;
      }, {});
    } catch (error) {
      console.error('Error fetching read status:', error);
      return {};
    }
  }, [supabase]);
  
  return {
    markAsRead,
    markAllAsRead,
    updateMessageStatus,
    getReadStatus,
  };
};

export default useMessageStatus;
