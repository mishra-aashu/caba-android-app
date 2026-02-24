import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { safeDbConversion } from '../utils/dbFieldMapping';

/**
 * Fetch messages for a specific chat (DM or Group)
 */
export const fetchMessages = async (chatId, limit = 50) => {
    if (!chatId) return [];

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
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }

    // Add null safety and return in ascending order (oldest first)
    const converted = safeDbConversion(data || []);
    return converted.map(msg => ({
        ...msg,
        sender: msg.sender || { id: msg.sender_id, name: 'Unknown', avatar: null },
        receiver: msg.receiver || (msg.receiver_id ? { id: msg.receiver_id, name: 'Unknown', avatar: null } : null)
    })).reverse();
};

/**
 * Hook to get messages for a chat with global caching
 */
export const useMessages = (chatId, limit = 50) => {
    return useQuery({
        queryKey: ['messages', chatId, limit],
        queryFn: () => fetchMessages(chatId, limit),
        enabled: !!chatId && chatId !== 'new',
        staleTime: 1000 * 60 * 5,       // 5 minutes — serve cache instantly, revalidate in bg
        gcTime: 1000 * 60 * 30,          // 30 minutes in cache after last use
        refetchOnWindowFocus: false,
    });
};
