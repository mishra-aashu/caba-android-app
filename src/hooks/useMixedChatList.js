/**
 * useMixedChatList - Merges Direct Messages and Groups into a single sorted list
 * WhatsApp Web style: DMs and Groups mixed together, sorted by last_message_at
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '../contexts/SupabaseContext';
import { useChatListRealtime } from './useChatListRealtime';
import { useGroupActions } from './useGroupActions';
import { isUserOnline } from '../utils/timeUtils';

// Fetch group list function for React Query
const fetchGroupList = async ({ supabase, userId }) => {
    if (!userId) return [];
    
    // Get groups where user is a member
    let query = supabase
        .from('group_members')
        .select(`
            group_id,
            role,
            joined_at,
            groups:group_id (
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
    
    if (error) {
        console.error('Error fetching group list:', error);
        return [];
    }

    // For each group, get last message and member preview
    const groupsWithInfo = await Promise.all((data || []).map(async (member) => {
        const group = member.groups;
        
        // Get last message for this group
        const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('chat_id', group.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Get member count
        const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

        // Get member names for preview
        const { data: members } = await supabase
            .from('group_members')
            .select('user_id, role, users!inner(name)')
            .eq('group_id', group.id)
            .limit(4);

        const memberPreview = members?.map(m => ({
            name: m.users?.name || 'Unknown',
            role: m.role
        })) || [];

        return {
            id: group.id,
            type: 'group',
            name: group.name || 'Unnamed Group',
            avatar_url: group.avatar_url,
            description: group.description,
            role: member.role,
            member_count: count || 0,
            member_preview: memberPreview,
            last_message: lastMsg?.content || 'No messages yet',
            last_message_time: group.last_message_at || lastMsg?.created_at || group.created_at,
            created_at: group.created_at
        };
    }));

    return groupsWithInfo || [];
};

export const useMixedChatList = (currentUserId) => {
    const { supabase } = useSupabase();
    
    // Use existing DM chat list hook
    const { chats: dmChats, setChats: setDmChats, loading: dmLoading } = useChatListRealtime(currentUserId);
    
    // TanStack Query for group list caching
    const { data: groupData, isLoading: groupLoading } = useQuery({
        queryKey: ['groupList', currentUserId],
        queryFn: () => fetchGroupList({ supabase, userId: currentUserId }),
        enabled: !!currentUserId && !!supabase,
        staleTime: 1000 * 60 * 3, // 3 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
    });

    // Merge and sort the lists
    const [mixedList, setMixedList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const mergeLists = () => {
            // Format DM chats
            const formattedDMs = (dmChats || []).map(chat => ({
                ...chat,
                type: 'chat',
                name: chat.otherUser?.name || 'Unknown',
                avatar_url: chat.otherUser?.avatar,
            }));

            // Format groups
            const formattedGroups = (groupData || []).map(group => ({
                ...group,
                type: 'group',
            }));

            // Merge both lists
            const merged = [...formattedDMs, ...formattedGroups];

            // Sort by last_message_time (newest first)
            const sorted = merged.sort((a, b) => {
                const timeA = a.last_message_time ? new Date(a.last_message_time) : new Date(0);
                const timeB = b.last_message_time ? new Date(b.last_message_time) : new Date(0);
                return timeB - timeA;
            });

            setMixedList(sorted);
            setLoading(dmLoading || groupLoading);
        };

        mergeLists();
    }, [dmChats, groupData, dmLoading, groupLoading]);

    // Update DM chat and refresh mixed list
    const updateChatInList = useCallback((chatId) => {
        setDmChats(prev => {
            // The useChatListRealtime handles the update
            return prev;
        });
    }, [setDmChats]);

    // Add a new group to the list
    const addGroupToList = useCallback((group) => {
        const newGroup = {
            ...group,
            type: 'group',
            last_message: 'Group created',
            last_message_time: new Date().toISOString(),
        };
        
        setMixedList(prev => {
            const updated = [newGroup, ...prev];
            return updated.sort((a, b) => {
                const timeA = a.last_message_time ? new Date(a.last_message_time) : new Date(0);
                const timeB = b.last_message_time ? new Date(b.last_message_time) : new Date(0);
                return timeB - timeA;
            });
        });
    }, []);

    // Real-time subscription for groups
    useEffect(() => {
        if (!currentUserId) return;

        const groupsChannel = supabase
            .channel(`mixed_list_groups_${currentUserId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'group_members' 
            }, payload => {
                const newMember = payload.new;
                // If current user was added to a group, refresh
                if (newMember.user_id === currentUserId) {
                    // Query will auto-refresh due to staleTime
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(groupsChannel);
        };
    }, [currentUserId, supabase]);

    return { 
        mixedList, 
        loading, 
        updateChatInList,
        addGroupToList,
        isDmLoading: dmLoading,
        isGroupLoading: groupLoading
    };
};

export default useMixedChatList;
