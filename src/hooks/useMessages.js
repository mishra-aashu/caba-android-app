import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { safeDbConversion } from '../utils/dbFieldMapping';

/**
 * Fetch messages for a specific chat with pagination
 */
export const fetchMessagesPage = async ({ chatId, pageParam = null, limit = 50 }) => {
  if (!chatId) return { data: [], nextCursor: null };

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

  if (pageParam) {
    query = query.lt('created_at', pageParam);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching messages page:', error);
    throw error;
  }

  // Convert database field names to frontend format
  const converted = safeDbConversion(data || []);

  // FIX: After safeDbConversion, fields are camelCase → use senderId, receiverId
  const messages = converted.map((msg) => ({
    ...msg,
    sender: msg.sender || {
      id: msg.senderId || msg.sender_id,
      name: 'Unknown',
      avatar: null,
    },
    receiver: msg.receiver || (
      (msg.receiverId || msg.receiver_id)
        ? { id: msg.receiverId || msg.receiver_id, name: 'Unknown', avatar: null }
        : null
    ),
  }));

  const validMessages = messages || [];

  // FIX: Use both possible field names for cursor safety
  const lastMsg = validMessages.length > 0
    ? validMessages[validMessages.length - 1]
    : null;

  const nextCursor =
    validMessages.length === limit && lastMsg
      ? (lastMsg.createdAt || lastMsg.created_at)
      : null;

  return {
    data: validMessages,
    nextCursor,
  };
};

/**
 * Hook to get infinite messages for a chat
 */
export const useInfiniteMessages = (chatId) => {
  return useInfiniteQuery({
    queryKey: ['messages', chatId],
    queryFn: ({ pageParam }) => fetchMessagesPage({ chatId, pageParam }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.data || lastPage.data.length === 0) return undefined;
      return lastPage.nextCursor || undefined;
    },
    enabled: !!chatId && chatId !== 'new',
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
};