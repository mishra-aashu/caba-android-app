import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';

/**
 * Fetches comprehensive details for a group, including its members and their user profiles,
 * in a single heavily-cached relational query to prevent redundant network calls and 
 * infinite re-render loops in group chat components.
 */
export const useGroupDetails = (groupId) => {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: ['group', groupId],
        queryFn: async () => {
            if (!groupId) return null;

            // Deep relational join to fetch group + all members + their user profiles
            const { data, error } = await supabase
                .from('groups')
                .select(`
                    id, name, avatar_url, description, created_by, created_at,
                    group_members (
                        user_id, role,
                        users (id, name, avatar)
                    )
                `)
                .eq('id', groupId)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: Boolean(groupId),
        // Extremely aggressive caching to stop infinite fetch loops
        staleTime: 5 * 60 * 1000, // 5 minutes fresh
        gcTime: 30 * 60 * 1000,   // 30 minutes in garbage collection cache
        refetchOnWindowFocus: false, // Prevent focus fetching spam
        refetchOnReconnect: true,
        retry: 2,
    });
};

// Export method for imperative cache invalidation when members join/leave/are removed
export const invalidateGroupDetails = (queryClient, groupId) => {
    queryClient.invalidateQueries({ queryKey: ['group', groupId] });
};
