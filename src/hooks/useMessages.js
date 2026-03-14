import { db } from '../db/db';
import { supabase } from '../config/supabase';
import { safeDbConversion } from '../utils/dbFieldMapping';

/**
 * Fetch messages for a specific chat with pagination
 */
export const fetchMessagesPage = async ({ chatId, beforeTimestamp = null, limit = 50 }) => {
  if (!chatId || chatId === 'new') return { count: 0 };

  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:sender_id (
        id,
        name,
        avatar,
        is_online,
        last_seen
      ),
      receiver:receiver_id (
        id,
        name,
        avatar,
        is_online,
        last_seen
      )
    `)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (beforeTimestamp) {
    query = query.lt('created_at', beforeTimestamp);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching messages page:', error);
    throw error;
  }

  const rawMessages = data || [];

  // Patch up sender/receiver but keep everything else snake_case
  const validMessages = rawMessages.map((msg) => ({
    ...msg,
    sender: msg.sender || {
      id: msg.sender_id,
      name: 'Unknown',
      avatar: null,
    },
    receiver: msg.receiver || (
      msg.receiver_id
        ? { id: msg.receiver_id, name: 'Unknown', avatar: null }
        : null
    ),
  }));

  // Save fetched messages directly into Dexie
  if (validMessages.length > 0) {
    await db.messages.bulkPut(validMessages);
  }

  return {
    count: validMessages.length,
    lastFetchedTimestamp: validMessages.length > 0 ? validMessages[validMessages.length - 1].created_at : null
  };
};

/**
 * Utility to load initial messages for a chat if Dexie is empty
 */
export const loadInitialMessagesIfNeeded = async (chatId) => {
  if (!chatId || chatId === 'new') return;
  const count = await db.messages.where('chat_id').equals(chatId).count();
  if (count === 0) {
    await fetchMessagesPage({ chatId });
  }
};