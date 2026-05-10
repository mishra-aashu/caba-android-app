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
      // 1. Prepare read receipt rows
      const rows = messageIds.map((messageId) => ({
        message_id: messageId,
        user_id: userId,
        read_at: new Date().toISOString(),
      }));

      // 2. Insert read receipts into Supabase
      const { data, error } = await supabase
        .from('message_reads')
        .upsert(rows, { onConflict: 'message_id,user_id', ignoreDuplicates: true })
        .select();

      if (error) throw error;

      // ─── VANISH MODE: VIEW ONCE LOGIC ───
      // We check if these messages belong to a chat with vanish mode enabled
      // and update their vanish_at timestamp to "now + 10s"
      
      const now = new Date();
      const vanishAt = new Date(now.getTime() + 10000).toISOString(); // 10 seconds from now

      // Get unique chat IDs for these messages to check settings
      const { data: messages } = await supabase
        .from('messages')
        .select('id, chat_id')
        .in('id', messageIds);

      if (messages?.length) {
        const chatIds = [...new Set(messages.map(m => m.chat_id))];
        
        // Check which of these chats have vanish mode enabled
        const { data: settings } = await supabase
          .from('temporary_chat_settings')
          .select('chat_id')
          .in('chat_id', chatIds)
          .eq('is_enabled', true);

        if (settings?.length) {
          const vanishChatIds = settings.map(s => s.chat_id);
          const vanishMsgIds = messages
            .filter(m => vanishChatIds.includes(m.chat_id))
            .map(m => m.id);

            if (vanishMsgIds.length > 0) {
              // Update Supabase: Set vanish_at for these messages
              await supabase
                .from('messages')
                .update({ vanish_at: vanishAt })
                .in('id', vanishMsgIds);

              // Update local DB
              const { db } = await import('../db/db');
              for (const id of vanishMsgIds) {
                await db.update('messages', id, { vanishAt });
              }
            }
        }
      }

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

      // [FIX] Update local DB count immediately for instant UI feedback
      const { db } = await import('../db/db');
      await db.update('chats_list', String(chatId), { unreadCount: 0 }).catch(() => {});

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
