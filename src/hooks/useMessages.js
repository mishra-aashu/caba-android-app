import { useQuery } from '@tanstack/react-query';
import { supabase } from '../config/supabase';

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
    return (data || []).map(msg => ({
        ...msg,
        sender: msg.sender || { id: msg.sender_id, name: 'Unknown', avatar: null },
        receiver: msg.receiver || (msg.receiver_id ? { id: msg.receiver_id, name: 'Unknown', avatar: null } : null)
    })).reverse();
};

/**
 * Hook to get messages for a chat with global caching
 */
export const useMessages = (chatId) => {
    return useQuery({
        queryKey: ['messages', chatId],
        queryFn: () => fetchMessages(chatId),
        enabled: !!chatId && chatId !== 'new',
        staleTime: 1000 * 60, // 1 minute
        gcTime: 1000 * 60 * 30, // 30 minutes
        refetchOnWindowFocus: false,
    });
};
