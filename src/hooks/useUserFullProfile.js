import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';

/**
 * Consolidated hook to fetch a user's full profile including relationships,
 * common groups, and media statistics in a single orchestration.
 */
export const useUserFullProfile = (targetUserId, currentUserId) => {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: ['userFullProfile', targetUserId, currentUserId],
        queryFn: async () => {
            if (!targetUserId || !currentUserId) return null;

            // 1. Check if we already have this specific user in the cache or contacts list
            const allContacts = queryClient.getQueryData(['contacts', currentUserId]);
            const existingContact = allContacts?.find(c => c.contact_user_id === targetUserId);

            // We perform these fetches in parallel, but skip those we already have in cache
            const [
                userResult,
                blockResult,
                groupsResult,
                mediaResult
            ] = await Promise.all([
                // Fetch target user profile
                supabase
                    .from('users')
                    .select('*')
                    .eq('id', targetUserId)
                    .single(),

                // Check block status
                supabase
                    .from('blocked_users')
                    .select('id')
                    .eq('blocker_id', currentUserId)
                    .eq('blocked_id', targetUserId)
                    .maybeSingle(),

                // Fetch common groups
                fetchCommonGroups(currentUserId, targetUserId),

                // Fetch media and chat info
                fetchMediaAndChat(currentUserId, targetUserId)
            ]);

            if (userResult.error) throw userResult.error;

            return {
                ...userResult.data,
                contact_info: existingContact || null,
                is_blocked: !!blockResult.data,
                common_groups: groupsResult || [],
                media_counts: mediaResult.counts,
                chat_id: mediaResult.chatId
            };
        },
        enabled: !!targetUserId && !!currentUserId,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    });
};

/**
 * Helper to fetch common groups between two users
 */
async function fetchCommonGroups(user1Id, user2Id) {
    try {
        // Get groups for user1
        const { data: user1Groups } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', user1Id);

        if (!user1Groups?.length) return [];
        const groupIds = user1Groups.map(g => g.group_id);

        // Get groups for user2 that interesection with user1
        const { data: commonGroups } = await supabase
            .from('group_members')
            .select(`
                group:group_id (
                    id,
                    name,
                    avatar_url
                )
            `)
            .eq('user_id', user2Id)
            .in('group_id', groupIds);

        return commonGroups?.map(g => g.group).filter(Boolean) || [];
    } catch (err) {
        console.error('Error fetching common groups:', err);
        return [];
    }
}

/**
 * Helper to fetch media counts and chat ID from shared chat
 */
async function fetchMediaAndChat(user1Id, user2Id) {
    try {
        // Find the chat first
        const { data: chat } = await supabase
            .from('chats')
            .select('id')
            .or(`and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`)
            .maybeSingle();

        if (!chat) return { counts: { images: 0, links: 0, docs: 0 }, chatId: null };

        // Query messages for media types
        const { data: messages } = await supabase
            .from('messages')
            .select('message_type, content')
            .eq('chat_id', chat.id);

        if (!messages) return { counts: { images: 0, links: 0, docs: 0 }, chatId: chat.id };

        let images = 0, links = 0, docs = 0;
        messages.forEach(msg => {
            if (msg.message_type === 'image') images++;
            else if (msg.message_type === 'document') docs++;
            else if (msg.content && (msg.content.includes('http://') || msg.content.includes('https://'))) links++;
        });

        return { 
            counts: { images, links, docs }, 
            chatId: chat.id 
        };
    } catch (err) {
        console.error('Error fetching media counts:', err);
        return { counts: { images: 0, links: 0, docs: 0 }, chatId: null };
    }
}
