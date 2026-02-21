import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../contexts/SupabaseContext';
import { realtimeManager } from '../utils/realtimeManager';
import useUserStore from '../store/userStore';
import { initializeFileSystem, loadChatsFromDevice, saveChatsToDevice } from '../utils/FileSystemManager';
import { isUserOnline } from '../utils/timeUtils';
import { normalizeChat, isGroupChat } from '../utils/chatHelpers';

// Fetch chat list function for React Query - Unified (chats + groups)
const fetchChatList = async ({ supabase, userId }) => {
    if (!userId) return [];

    try {
        // Try the RPC function first (more reliable for unified view)
        const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_unified_chat_list', { user_id: userId });

        if (!rpcError && rpcData) {
            // Use normalizeChat helper to create unified data structure
            const formattedChats = rpcData.map(rawItem => normalizeChat(rawItem, userId));

            // Save to device for offline access
            await saveChatsToDevice(formattedChats);
            return formattedChats;
        }
    } catch (rpcErr) {
        console.log('RPC function not available, falling back to view:', rpcErr);
    }

    // Fallback: Try unified_chat_list view
    try {
        const { data: viewData, error: viewError } = await supabase
            .from('unified_chat_list')
            .select('*')
            .order('last_message_time', { ascending: false })
            .limit(20);

        if (!viewError && viewData) {
            const formattedChats = viewData.map(rawItem => normalizeChat(rawItem, userId));
            await saveChatsToDevice(formattedChats);
            return formattedChats;
        }
    } catch (viewErr) {
        console.log('View not available:', viewErr);
    }

    return [];
};

export const useChatListRealtime = (currentUserId) => {
    const { supabase } = useSupabase();
    const queryClient = useQueryClient();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasMoreChats, setHasMoreChats] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // TanStack Query for chat list caching
    const { data: queryChats, isLoading: queryLoading, isFetching } = useQuery({
        queryKey: ['chatList', currentUserId],
        queryFn: () => fetchChatList({ supabase, userId: currentUserId }),
        enabled: !!currentUserId && !!supabase,
        staleTime: 1000 * 60 * 3,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
    });

    // Initial load from device storage
    useEffect(() => {
        const loadInitialData = async () => {
            if (!currentUserId) return;
            try {
                await initializeFileSystem();
                const localChats = await loadChatsFromDevice();
                if (localChats && localChats.length > 0) {
                    setChats(localChats);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error loading initial chats:', error);
            }
        };
        loadInitialData();
    }, [currentUserId]);

    // Sync query data to chats state
    useEffect(() => {
        if (queryChats) {
            const updatedChats = queryChats.map(chat => ({
                ...chat,
                is_online: isUserOnline(Boolean(chat.is_online), chat.last_seen)
            }));
            setChats(updatedChats);
            setHasMoreChats(queryChats.length >= 20);
        }
        if (!queryLoading && !isFetching) {
            setLoading(false);
        }
    }, [queryChats, queryLoading, isFetching]);

    // Handle load more with pagination - Unified
    const loadMoreChats = useCallback(async () => {
        if (!currentUserId || !hasMoreChats || loadingMore || !supabase) return;

        setLoadingMore(true);
        try {
            const lastChat = chats[chats.length - 1];
            const lastTimestamp = lastChat?.timestamp;

            let query = supabase
                .from('unified_chat_list')
                .select('*')
                .order('last_message_time', { ascending: false })
                .limit(20);

            if (lastTimestamp) {
                query = query.lt('last_message_time', lastTimestamp);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                const formattedChats = data.map(rawItem => normalizeChat(rawItem, currentUserId));
                setChats(prev => {
                    const combined = [...prev, ...formattedChats];
                    saveChatsToDevice(combined);
                    return combined;
                });
                setHasMoreChats(data.length === 20);
            } else {
                setHasMoreChats(false);
            }
        } catch (error) {
            console.error('Error loading more chats:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [currentUserId, hasMoreChats, loadingMore, chats, supabase]);

    // Real-time channels effect - Consolidated
    useEffect(() => {
        if (!currentUserId) return;

        const channelName = `chat_list_updates_${currentUserId}`;
        let isCancelled = false;

        const setupSubscription = async () => {
            await realtimeManager.subscribe(
                channelName,
                {},
                {
                    postgres_changes: [
                        {
                            event: '*',
                            schema: 'public',
                            table: 'messages',
                            handler: (payload) => {
                                if (isCancelled) return;

                                // Invalidate query for structural changes or deletions
                                if (payload.eventType === 'DELETE' || payload.eventType === 'UPDATE') {
                                    queryClient.invalidateQueries({ queryKey: ['chatList', currentUserId] });
                                    return;
                                }

                                if (payload.eventType === 'INSERT' && payload.new) {
                                    const newMessage = payload.new;
                                    if (isCancelled) return;
                                    setChats(prev => {
                                        const chatIndex = prev.findIndex(c => c.id === newMessage.chat_id);
                                        if (chatIndex === -1) {
                                            queryClient.invalidateQueries({ queryKey: ['chatList', currentUserId] });
                                            return prev;
                                        }
                                        const chat = { ...prev[chatIndex] };
                                        chat.lastMessage = newMessage.content || (newMessage.message_type !== 'text' ? `[${newMessage.message_type}]` : '');
                                        chat.timestamp = newMessage.created_at;
                                        if (newMessage.sender_id !== currentUserId) chat.unreadCount = (chat.unreadCount || 0) + 1;
                                        const next = [...prev];
                                        next.splice(chatIndex, 1);
                                        next.unshift(chat);
                                        return next;
                                    });
                                }
                            }
                        },
                        {
                            event: '*',
                            schema: 'public',
                            table: 'chats',
                            handler: () => {
                                if (!isCancelled) queryClient.invalidateQueries({ queryKey: ['chatList', currentUserId] });
                            }
                        },
                        {
                            event: '*',
                            schema: 'public',
                            table: 'groups',
                            handler: () => {
                                if (!isCancelled) queryClient.invalidateQueries({ queryKey: ['chatList', currentUserId] });
                            }
                        },
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'users',
                            handler: (payload) => {
                                if (isCancelled || !payload?.new) return;
                                const updatedUser = payload.new;
                                setChats(prev => prev.map(chat => {
                                    // otherUserId is stored in metadata for chats
                                    if (chat.metadata?.otherUserId === updatedUser.id) {
                                        return {
                                            ...chat,
                                            is_online: isUserOnline(Boolean(updatedUser.is_online), updatedUser.last_seen),
                                            last_seen: updatedUser.last_seen
                                        };
                                    }
                                    return chat;
                                }));
                            }
                        },
                        {
                            event: '*',
                            schema: 'public',
                            table: 'group_members',
                            handler: (payload) => {
                                if (isCancelled) return;
                                if (payload?.new?.user_id === currentUserId || payload?.old?.user_id === currentUserId) {
                                    queryClient.invalidateQueries({ queryKey: ['chatList', currentUserId] });
                                }
                            }
                        }
                    ]
                }
            );
        };

        setupSubscription();

        return () => {
            isCancelled = true;
            realtimeManager.unsubscribe(channelName);
        };
    }, [currentUserId, supabase, queryClient]);

    return { chats, setChats, loading, hasMoreChats, loadingMore, loadMoreChats };
};
