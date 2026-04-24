import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../contexts/SupabaseContext';
import { realtimeManager } from '../utils/realtimeManager';
import { normalizeChat } from '../utils/chatHelpers';

// Fetch group list function for React Query
const fetchGroupList = async ({ supabase, userId }) => {
    if (!userId) return [];

    try {
        // Step 1: Try the optimized RPC (No N+1 queries)
        const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_group_list_v2', { user_id_param: userId });

        if (!rpcError && rpcData) {
            return rpcData.map(group => {
                const normalized = normalizeChat({
                    chat_id: group.group_id,
                    chat_type: 'group',
                    group_name: group.group_name,
                    group_avatar: group.group_avatar,
                    last_message: group.last_message_content,
                    last_message_time: group.last_message_time,
                    unread_count: 0
                }, userId);

                return {
                    ...normalized,
                    description: group.group_description,
                    role: group.role,
                    member_count: group.member_count || 0,
                    created_at: group.group_created_at
                };
            });
        }
    } catch (rpcErr) {
        console.log('get_group_list_v2 RPC not available, using fallback.');
    }

    // Step 2: Fallback (N+1 Queries - only used if RPC fails)
    let query = supabase
        .from('group_members')
        .select(`
            group_id,
            role,
            joined_at,
            group:group_id (
                id,
                name,
                avatar_url,
                description,
                created_at,
                last_message_at
            )
        `)
        .eq('user_id', userId);

    const { data, error } = await query;
    if (error) return [];

    const groupsWithInfo = await Promise.all((data || []).map(async (member) => {
        const group = member.group;
        const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('chat_id', group.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

        const normalized = normalizeChat({
            chat_id: group.id,
            chat_type: 'group',
            group_name: group.name,
            group_avatar: group.avatar_url,
            last_message: lastMsg?.content,
            last_message_time: group.last_message_at || lastMsg?.created_at || group.created_at,
            unread_count: 0
        }, userId);

        return {
            ...normalized,
            description: group.description,
            role: member.role,
            member_count: count || 0,
            created_at: group.created_at
        };
    }));

    return groupsWithInfo || [];
};


export const useMixedChatList = (currentUserId, dmChats, setDmChats, dmLoading) => {
    const { supabase } = useSupabase();
    const queryClient = useQueryClient();

    // TanStack Query for group list caching
    const { data: groupData, isLoading: groupLoading } = useQuery({
        queryKey: ['groupList', currentUserId],
        queryFn: () => fetchGroupList({ supabase, userId: currentUserId }),
        enabled: !!currentUserId && !!supabase,
        staleTime: 1000 * 60 * 3,
        gcTime: 1000 * 60 * 30,
    });

    // Merge and sort the lists
    const [mixedList, setMixedList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const mergeLists = () => {
            // DM chats are already formatted by useChatListRealtime
            const formattedDMs = (dmChats || []);

            // Groups are already formatted by fetchGroupList
            const formattedGroups = (groupData || []);

            // Merge both lists
            const merged = [...formattedDMs, ...formattedGroups];

            // Sort by timestamp (newest first)
            const sorted = merged.sort((a, b) => {
                const timeA = a.timestamp ? new Date(a.timestamp) : new Date(0);
                const timeB = b.timestamp ? new Date(b.timestamp) : new Date(0);
                return timeB - timeA;
            });

            setMixedList(sorted);
            setLoading(dmLoading || groupLoading);
        };

        mergeLists();
    }, [dmChats, groupData, dmLoading, groupLoading]);

    // Add a new group to the list
    const addGroupToList = useCallback((group) => {
        const normalized = normalizeChat({
            chat_id: group.id,
            chat_type: 'group',
            group_name: group.name,
            group_avatar: group.avatar_url,
            last_message: 'Group created',
            last_message_time: new Date().toISOString(),
        }, currentUserId);

        setMixedList(prev => {
            const updated = [normalized, ...prev];
            return updated.sort((a, b) => {
                const timeA = a.timestamp ? new Date(a.timestamp) : new Date(0);
                const timeB = b.timestamp ? new Date(b.timestamp) : new Date(0);
                return timeB - timeA;
            });
        });
    }, []);


    // Real-time subscription for groups
    const currentUserIdRef = useRef(currentUserId);
    const mountedRef = useRef(true);

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, [currentUserId]);

    // Real-time: when we are added to a new group, refresh the group list
    const handleGroupMemberChange = useCallback((payload) => {
        if (!mountedRef.current) return;
        console.log('[useMixedChatList] group_members change detected, refreshing group list');
        queryClient.invalidateQueries({ queryKey: ['groupList', currentUserIdRef.current] });
    }, [queryClient]);

    const handleGroupMemberChangeRef = useRef(handleGroupMemberChange);
    handleGroupMemberChangeRef.current = handleGroupMemberChange;


    useEffect(() => {
        if (!currentUserId) return;

        const channelName = `mixed_list_groups_${currentUserId}`;
        console.log(`[useMixedChatList] Subscribing: ${currentUserId}`);

        realtimeManager.subscribe(
            channelName,
            {},
            {
                postgres_changes: [
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'group_members',
                        handler: (payload) => handleGroupMemberChangeRef.current?.(payload)
                    }
                ],
                onReconnect: () => {
                    if (mountedRef.current) {
                        console.log('[useMixedChatList] Reconnected, refreshing group list');
                        queryClient.invalidateQueries({ queryKey: ['groupList', currentUserIdRef.current] });
                    }
                }
            }
        );

        return () => {
            console.log(`[useMixedChatList] Unsubscribing: ${currentUserId}`);
            realtimeManager.unsubscribe(channelName);
        };
    }, [currentUserId]);


    return {
        mixedList,
        loading,
        addGroupToList,
        isDmLoading: dmLoading,
        isGroupLoading: groupLoading
    };
};

export default useMixedChatList;

