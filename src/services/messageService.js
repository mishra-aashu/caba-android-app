import { dbToFrontend, safeDbConversion } from '../utils/dbFieldMapping';
import { validateAndSanitize, coerceDataTypes } from '../utils/dataValidation';

/**
 * Service function to fetch chat messages from Supabase
 * Returns the array of messages directly for use with React Query
 * 
 * @param {Object} params - The parameters object
 * @param {string} params.chatId - The chat ID to fetch messages for
 * @param {Object} params.supabase - The Supabase client instance
 * @returns {Promise<Array>} - Array of messages
 */
export const fetchChatMessages = async ({ chatId, supabase }) => {
  if (!chatId || chatId === 'new') {
    return [];
  }

  // Optimized query with joins to fetch user data in single query
  const { data, error } = await supabase
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
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }

  // Convert database field names to frontend format with null safety
  const convertedData = safeDbConversion(data || []);
  
  // Coerce data types to ensure consistency
  return convertedData.map(message => coerceDataTypes(message, 'messages'));
};

/**
 * Fetch older messages for pagination
 * 
 * @param {Object} params - The parameters object
 * @param {string} params.chatId - The chat ID
 * @param {Object} params.supabase - The Supabase client
 * @param {string} params.beforeTimestamp - Get messages before this timestamp
 * @returns {Promise<Array>} - Array of older messages
 */
export const fetchOlderMessages = async ({ chatId, supabase, beforeTimestamp }) => {
  if (!chatId || chatId === 'new' || !beforeTimestamp) {
    return [];
  }

  const { data, error } = await supabase
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
    .lt('created_at', beforeTimestamp)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Error fetching older messages:', error);
    throw error;
  }

  // Convert database field names to frontend format with null safety
  const convertedData = safeDbConversion(data || []);
  
  // Coerce data types to ensure consistency
  return convertedData.map(message => coerceDataTypes(message, 'messages'));
};

export default fetchChatMessages;
