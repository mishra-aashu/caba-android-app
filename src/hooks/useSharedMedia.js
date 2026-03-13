import { useQuery } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { safeDbConversion } from '../utils/dbFieldMapping';

/**
 * Fetch only media messages (images and videos) for a specific chat
 */
export const fetchSharedMedia = async (chatId, limit = 100) => {
    if (!chatId) return [];

    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            sender:sender_id (id, name, avatar),
            receiver:receiver_id (id, name, avatar)
        `)
        .eq('chat_id', chatId)
        .in('media_type', ['image', 'video'])
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching shared media:', error);
        throw error;
    }

    return safeDbConversion(data || []);
};

/**
 * Hook to get shared media for a chat
 */
export const useSharedMedia = (chatId, limit = 100) => {
    return useQuery({
        queryKey: ['sharedMedia', chatId, limit],
        queryFn: () => fetchSharedMedia(chatId, limit),
        enabled: !!chatId && chatId !== 'new',
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
    });
};
