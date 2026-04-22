/**
 * Message reads service — wired to the message_reads table in Supabase.
 * Provides read receipt tracking for 1:1 and group chats.
 */

import { supabase } from '../config/supabase';

class MessageReadsService {
  /**
   * Mark specific messages as read by inserting rows into message_reads.
   * Uses upsert to avoid duplicate constraint errors.
   * @param {string[]} messageIds - Array of message UUIDs
   * @param {string} userId - The reader's user UUID
   * @returns {object[]} Inserted read-receipt rows
   */
  async markAsRead(messageIds, userId) {
    if (!messageIds?.length || !userId) return [];

    try {
      // DEBUG: Check if we actually have a session - prevents 403 if auth state is lost
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !localStorage.getItem('phoneAuthToken')) {
        console.warn('MessageReadsService.markAsRead: No active session found.');
      }

      if (session && session.user.id !== userId) {
        console.warn('MessageReadsService.markAsRead: Session user ID mismatch.', {
          sessionUserId: session.user.id,
          providedUserId: userId
        });
      }

      const rows = messageIds.map((messageId) => ({
        message_id: messageId,
        user_id: userId,
        read_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('message_reads')
        .upsert(rows, { onConflict: 'message_id,user_id', ignoreDuplicates: true })
        .select();

      if (error) {
        // Specifically log 403 which often indicates RLS or Auth issues
        if (error.code === '42501' || error.status === 403) {
          console.error('MessageReadsService: RLS/Auth Error (403) - Verify message_reads policies or user session.', error);
        }
        throw error;
      }

      // NOTE: We no longer manually update the 'messages' table here.
      // A database trigger 'on_message_read_inserted' now handles this automatically
      // with SECURITY DEFINER privileges to bypass RLS restrictions on the messages table.

      return data || [];
    } catch (error) {
      console.error('MessageReadsService.markAsRead error:', error);
      return [];
    }
  }

  /**
   * Get read status for a list of messages.
   * Returns a map of messageId → array of readers {user_id, read_at}.
   * @param {string[]} messageIds
   * @returns {Object.<string, object[]>}
   */
  async getReadStatus(messageIds) {
    if (!messageIds?.length) return {};

    try {
      const { data, error } = await supabase
        .from('message_reads')
        .select('message_id, user_id, read_at')
        .in('message_id', messageIds);

      if (error) throw error;

      const statusMap = {};
      (data || []).forEach((row) => {
        if (!statusMap[row.message_id]) statusMap[row.message_id] = [];
        statusMap[row.message_id].push({
          user_id: row.user_id,
          read_at: row.read_at,
        });
      });

      return statusMap;
    } catch (error) {
      console.error('MessageReadsService.getReadStatus error:', error);
      return {};
    }
  }

  /**
   * Mark all unread messages in a chat as read for a given user.
   * Fetches unread messages (where sender ≠ user) then bulk-inserts read receipts.
   * @param {string} chatId
   * @param {string} userId
   * @returns {boolean} success
   */
  async markAllAsRead(chatId, userId) {
    if (!chatId || !userId) return false;

    try {
      // Get all unread messages in this chat that the user hasn't sent
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', chatId)
        .neq('sender_id', userId)
        .eq('is_read', false);

      if (fetchError) throw fetchError;
      if (!unreadMessages?.length) return true; // Nothing to mark

      const messageIds = unreadMessages.map((m) => m.id);
      await this.markAsRead(messageIds, userId);

      // [FIX] Update local Dexie count immediately for instant UI feedback
      const { db } = await import('../db/db');
      await db.chats_list.update(chatId, { unreadCount: 0 }).catch(() => {});

      return true;
    } catch (error) {
      console.error('MessageReadsService.markAllAsRead error:', error);
      return false;
    }
  }

  /**
   * Subscribe to read receipt updates for a specific chat.
   * Listens for INSERT events on message_reads and calls the callback.
   * @param {string} chatId
   * @param {function} callback - Called with the new read receipt row
   * @returns {{ unsubscribe: function }} Subscription handle
   */
  subscribeToReadReceipts(chatId, callback) {
    if (!chatId || typeof callback !== 'function') return null;

    const channel = supabase
      .channel(`read_receipts_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }
}

export const messageReadsService = new MessageReadsService();
export default messageReadsService;
