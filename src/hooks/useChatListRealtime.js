import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '../contexts/SupabaseContext';
import { initializeFileSystem, loadChatsFromDevice, saveChatsToDevice } from '../utils/FileSystemManager';
import { isUserOnline } from '../utils/timeUtils';

// Fetch chat list function for React Query
const fetchChatList = async ({ supabase, userId }) => {
    if (!userId) return [];
    
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
            unreadCount: parseInt(chat.unread_count) || 0
        };
    });

    // Save to device for offline access
    await saveChatsToDevice(formattedChats);
    
    return formattedChats;
};

export const useChatListRealtime = (currentUserId) => {
    const { supabase, session } = useSupabase();
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

    // Real-time channels effect - FIXED: No re-fetching
    useEffect(() => {
        if (!currentUserId) return;

        const messagesChannel = supabase
            .channel(`chat_list_messages_for_${currentUserId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                const newMessage = payload.new;
                
                // BAD CODE (Jo tum kar rahe the):
                // updateChatInList(message.chat_id);  <-- Ye DB call hai, ise hatao!

                // GOOD CODE (Local Update):
                setChats((prevChats) => {
                    return prevChats.map((chat) => {
                        if (chat.id === newMessage.chat_id) {
                            // Sirf uss chat ka last message update karo
                            return {
                                ...chat,
                                last_message: newMessage.content,
                                last_message_time: newMessage.created_at,
                                unreadCount: chat.unreadCount + 1 // Optional logic
                            };
                        }
                        return chat;
                    })
                    // Sort bhi kar do taaki nayi chat upar aa jaye
                    .sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
                });
            })
            .subscribe();

        const chatsChannel = supabase
            .channel(`chat_list_chats_for_${currentUserId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats' }, payload => {
                // Handle chat updates locally without re-fetching
                const updatedChat = payload.new;
                setChats((prevChats) => {
                    return prevChats.map((chat) => {
                        if (chat.id === updatedChat.id) {
                            return {
                                ...chat,
                                last_message: updatedChat.last_message,
                                last_message_time: updatedChat.last_message_time
                            };
                        }
                        return chat;
                    });
                });
            })
            .subscribe();

        // Subscribe to user online status changes
        const usersChannel = supabase
            .channel(`chat_list_users_for_${currentUserId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, payload => {
                const updatedUser = payload.new;
                // Update any chat where this user is the otherUser
                setChats(prevChats => prevChats.map(chat => {
                    if (chat.otherUser.id === updatedUser.id) {
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
            })
            .subscribe();

        return () => {
            supabase.removeChannel(messagesChannel);
            supabase.removeChannel(chatsChannel);
            supabase.removeChannel(usersChannel);
        };
    }, [currentUserId, supabase]);

    return { chats, setChats, loading, hasMoreChats, loadingMore, loadMoreChats };
};
