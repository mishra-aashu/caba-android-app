import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../contexts/SupabaseContext';
import { realtimeManager } from '../utils/realtimeManager';
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

        if (!rpcError && rpcData && rpcData.length > 0) {
            // Use normalizeChat helper to create unified data structure
            const formattedChats = rpcData.map(rawItem => {
                const normalized = normalizeChat(rawItem);

                return {
                    ...normalized,
                    otherUser: {
                        id: normalized.metadata.otherUserId || normalized.id,
                        name: normalized.name,
                        phone: normalized.metadata.otherUserPhone || null,
                        avatar: normalized.avatar,
                        is_online: normalized.is_online,
                        last_seen: normalized.last_seen
                    },
                    last_message: normalized.lastMessage,
                    last_message_time: normalized.timestamp,
                    unreadCount: normalized.unreadCount,
                    isGroup: normalized.isGroup
                };
            });

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

        if (!viewError && viewData && viewData.length > 0) {
            // Use normalizeChat helper for consistent data structure
            const formattedChats = viewData.map(rawItem => {
                const normalized = normalizeChat(rawItem);
                return {
                    ...normalized,
                    otherUser: {
                        id: normalized.metadata.otherUserId || normalized.id,
                        name: normalized.name,
                        phone: normalized.metadata.otherUserPhone || null,
                        avatar: normalized.avatar,
                        is_online: normalized.is_online,
                        last_seen: normalized.last_seen
                    },
                    last_message: normalized.lastMessage,
                    last_message_time: normalized.timestamp,
                    unreadCount: normalized.unreadCount,
                    isGroup: normalized.isGroup
                };
            });

            await saveChatsToDevice(formattedChats);
            return formattedChats;
        }
    } catch (viewErr) {
        console.log('View not available:', viewErr);
    }


    // Final fallback: Original chat_list_view
    let query = supabase
        .from('chat_list_view')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('last_message_time', { ascending: false })
        .limit(20);

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching chat list:', error);
        throw error;
    }

    const formattedChats = (data || []).map(chat => {
        const isUser1 = chat.user1_id === userId;
        const otherUser = {
            id: isUser1 ? chat.user2_id : chat.user1_id,
            name: isUser1 ? chat.user2_name : chat.user1_name,
            phone: isUser1 ? chat.user2_id : chat.user1_id,
            avatar: isUser1 ? chat.user2_avatar : chat.user1_avatar,
            is_online: isUserOnline(Boolean(isUser1 ? chat.user2_online : chat.user1_online), isUser1 ? chat.user2_last_seen : chat.user1_last_seen),
            last_seen: isUser1 ? chat.user2_last_seen : chat.user1_last_seen
        };

        return {
            id: chat.chat_id,
            otherUser,
            last_message: chat.last_message,
            last_message_time: chat.last_message_time,
            unreadCount: parseInt(chat.unread_count) || 0,
            isGroup: false
        };
    });

    // Save to device for offline access
    await saveChatsToDevice(formattedChats);

    return formattedChats;
};

export const useChatListRealtime = (currentUserId) => {
    const { supabase, session } = useSupabase();
    const queryClient = useQueryClient();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasMoreChats, setHasMoreChats] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // TanStack Query for chat list caching - provides instant loading from cache
    const { data: queryChats, isLoading: queryLoading, isFetching } = useQuery({
        queryKey: ['chatList', currentUserId],
        queryFn: () => fetchChatList({ supabase, userId: currentUserId }),
        enabled: !!currentUserId && !!supabase,
        staleTime: 1000 * 60 * 3, // 3 minutes - data stays fresh
        gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache
        refetchOnWindowFocus: false,
    });

    // Initial load from device storage - runs once on mount
    useEffect(() => {
        const loadInitialData = async () => {
            if (!currentUserId) return;

            try {
                await initializeFileSystem();
                const localChats = await loadChatsFromDevice();

                if (localChats && localChats.length > 0) {
                    // Apply online status logic
                    const updatedChats = localChats.map(chat => ({
                        ...chat,
                        otherUser: {
                            ...chat.otherUser,
                            is_online: isUserOnline(Boolean(chat.otherUser.is_online), chat.otherUser.last_seen)
                        }
                    }));
                    setChats(updatedChats);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error loading initial chats:', error);
            }
        };

        loadInitialData();
    }, [currentUserId]);

    // Sync query data to chats state - shows fresh data from server
    useEffect(() => {
        if (queryChats && queryChats.length > 0) {
            // Apply online status logic
            const updatedChats = queryChats.map(chat => ({
                ...chat,
                otherUser: {
                    ...chat.otherUser,
                    is_online: isUserOnline(Boolean(chat.otherUser.is_online), chat.otherUser.last_seen)
                }
            }));
            setChats(updatedChats);
            setHasMoreChats(queryChats.length === 20);
        }
        // Only set loading false after query has loaded
        if (!queryLoading && !isFetching) {
            setLoading(false);
        }
    }, [queryChats, queryLoading, isFetching]);

    // Handle load more with React Query
    const loadMoreChats = useCallback(() => {
        // With React Query, we can use refetch or implement cursor-based pagination
        // For now, let's keep the existing sync logic for load more
        if (currentUserId && hasMoreChats && !loadingMore) {
            setLoadingMore(true);
        }
    }, [currentUserId, hasMoreChats, loadingMore]);


    const updateChatInList = useCallback(async (chatId) => {
        const { data } = await supabase
            .from('chat_list_view')
            .select('*')
            .eq('chat_id', chatId)
            .single();

        if (data && (data.user1_id === currentUserId || data.user2_id === currentUserId)) {
            const isUser1 = data.user1_id === currentUserId;
            const otherUser = {
                id: isUser1 ? data.user2_id : data.user1_id,
                name: isUser1 ? data.user2_name : data.user1_name,
                phone: isUser1 ? data.user2_id : data.user1_id,
                avatar: isUser1 ? data.user2_avatar : data.user1_avatar,
                is_online: isUserOnline(Boolean(isUser1 ? data.user2_online : data.user1_online), isUser1 ? data.user2_last_seen : data.user1_last_seen),
                last_seen: isUser1 ? data.user2_last_seen : data.user1_last_seen
            };

            const updatedChat = {
                id: data.chat_id,
                otherUser,
                last_message: data.last_message,
                last_message_time: data.last_message_time,
                unreadCount: parseInt(data.unread_count) || 0
            };

            const updatedList = (prev) => {
                const index = prev.findIndex(c => c.id === chatId);
                let newChats;
                if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = updatedChat;
                    newChats = updated;
                } else {
                    newChats = [updatedChat, ...prev];
                }
                const sorted = newChats.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
                saveChatsToDevice(sorted); // Save after update
                return sorted;
            };
            setChats(updatedList);
        }
    }, [currentUserId, supabase]);

    // Real-time channels effect - OPTIMIZED: Uses a SINGLE channel with consolidated table listeners
    useEffect(() => {
        if (!currentUserId) return;

        console.log(`🔌 Setting up consolidated real-time subscription for user: ${currentUserId}`);

        const channelName = `chat_list_updates_${currentUserId}`;

        let isCancelled = false;

        const setupSubscription = async () => {
            const channel = await realtimeManager.subscribe(
                channelName,
                {},
                {
                    postgres_changes: [
                        // 1. Messages listener (handles INSERT and DELETE)
                        {
                            event: '*',
                            schema: 'public',
                            table: 'messages',
                            handler: (payload) => {
                                if (isCancelled) return;
                                if (payload.eventType === 'INSERT') {
                                    const newMessage = payload.new;
                                    // Only update locally if we are the receiver
                                    if (newMessage.receiver_id === currentUserId) {
                                        setChats((prevChats) => {
                                            return prevChats.map((chat) => {
                                                if (chat.id === newMessage.chat_id) {
                                                    const senderPrefix = newMessage.is_group_message && newMessage.sender_id !== currentUserId
                                                        ? `${newMessage.sender_name || 'Someone'}: `
                                                        : '';
                                                    return {
                                                        ...chat,
                                                        last_message: senderPrefix + (newMessage.content || ''),
                                                        last_message_time: newMessage.created_at,
                                                        unreadCount: chat.unreadCount + 1
                                                    };
                                                }
                                                return chat;
                                            }).sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
                                        });
                                    }
                                } else if (payload.eventType === 'DELETE') {
                                    queryClient.invalidateQueries({ queryKey: ['chatList', currentUserId] });
                                }
                            }
                        },
                        // 2. Chats listener
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'chats',
                            handler: (payload) => {
                                if (isCancelled) return;
                                const updatedChat = payload.new;
                                setChats((prevChats) => {
                                    return prevChats.map((chat) => {
                                        if (chat.id === updatedChat.id && !chat.isGroup) {
                                            return {
                                                ...chat,
                                                last_message: updatedChat.last_message,
                                                last_message_time: updatedChat.last_message_time
                                            };
                                        }
                                        return chat;
                                    });
                                });
                            }
                        },
                        // 3. Users listener
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'users',
                            handler: (payload) => {
                                if (isCancelled) return;
                                const updatedUser = payload.new;
                                setChats(prevChats => prevChats.map(chat => {
                                    if (chat.otherUser?.id === updatedUser.id) {
                                        return {
                                            ...chat,
                                            otherUser: {
                                                ...chat.otherUser,
                                                is_online: isUserOnline(Boolean(updatedUser.is_online), updatedUser.last_seen),
                                                last_seen: updatedUser.last_seen
                                            }
                                        };
                                    }
                                    return chat;
                                }));
                            }
                        },
                        // 4. Group Members listener (handles all membership changes)
                        {
                            event: '*',
                            schema: 'public',
                            table: 'group_members',
                            handler: (payload) => {
                                if (isCancelled) return;
                                if (payload.eventType === 'INSERT') {
                                    if (payload.new.user_id === currentUserId) {
                                        queryClient.invalidateQueries({ queryKey: ['chatList', currentUserId] });
                                    }
                                } else {
                                    queryClient.invalidateQueries({ queryKey: ['chatList', currentUserId] });
                                }
                            }
                        },
                        // 5. Groups listener
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'groups',
                            handler: () => {
                                if (isCancelled) return;
                                queryClient.invalidateQueries({ queryKey: ['chatList', currentUserId] });
                            }
                        }
                    ]
                }
            );

            if (isCancelled && channel) {
                realtimeManager.unsubscribe(channelName);
            }
        };

        setupSubscription();

        return () => {
            isCancelled = true;
            console.log(`🔌 Cleaning up consolidated real-time subscription for user: ${currentUserId}`);
            realtimeManager.unsubscribe(channelName);
        };
    }, [currentUserId, supabase, queryClient]);

    return { chats, setChats, loading, hasMoreChats, loadingMore, loadMoreChats };
};
