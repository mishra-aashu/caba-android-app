import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { initializeFileSystem, loadChatsFromDevice, saveChatsToDevice } from '../utils/FileSystemManager';
import { isUserOnline } from '../utils/timeUtils';

export const useChatListRealtime = (currentUserId) => {
    const { supabase, session } = useSupabase();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasMoreChats, setHasMoreChats] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const syncChatsWithSupabase = useCallback(async (userId, isLoadMore = false) => {
        if (!userId) {
            setLoading(false);
            return;
        }

        if (isLoadMore) {
            setLoadingMore(true);
        }
        // Don't set main loading to true, so the UI doesn't flash a loader
        // setLoading(true); 

        try {
            let query = supabase
                .from('chat_list_view')
                .select('*')
                .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
                .order('last_message_time', { ascending: false });

            if (isLoadMore && chats.length > 0) {
                const lastChat = chats[chats.length - 1];
                query = query.lt('last_message_time', lastChat.last_message_time);
            }

            query = query.limit(20);
            const { data, error } = await query;

            if (error) {
                console.error('Error syncing chats from view:', error);
                return; // Don't wipe local chats if sync fails
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

            if (isLoadMore) {
                const newChats = [...chats, ...formattedChats];
                setChats(newChats);
                await saveChatsToDevice(newChats); // Save updated list
                setHasMoreChats(formattedChats.length === 20);
            } else {
                setChats(formattedChats);
                await saveChatsToDevice(formattedChats); // Save fresh list
                setHasMoreChats(formattedChats.length === 20);
            }
        } catch (error) {
            console.error('Error syncing chats:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [supabase]); // 'chats' is needed for pagination

    // Initial load from device, then sync
    useEffect(() => {
        const initialLoad = async () => {
            if (currentUserId) {
                setLoading(true);
                await initializeFileSystem();
                let localChats = await loadChatsFromDevice();

                // Apply current online status logic to cached chats
                localChats = localChats.map(chat => ({
                    ...chat,
                    otherUser: {
                        ...chat.otherUser,
                        is_online: isUserOnline(Boolean(chat.otherUser.is_online), chat.otherUser.last_seen)
                    }
                }));

                setChats(localChats);
                setLoading(false); // Stop loading to show cached data

                // Now sync with supabase in the background
                await syncChatsWithSupabase(currentUserId);
            } else {
                setChats([]);
                setLoading(false);
            }
        };
        initialLoad();
    }, [currentUserId]);


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

    // Real-time channels effect
    useEffect(() => {
        if (!currentUserId) return;

        const messagesChannel = supabase
            .channel(`chat_list_messages_for_${currentUserId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                const message = payload.new;
                if (message.sender_id === currentUserId || message.receiver_id === currentUserId) {
                    updateChatInList(message.chat_id);
                }
            })
            .subscribe();

        const chatsChannel = supabase
            .channel(`chat_list_chats_for_${currentUserId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats' }, payload => {
                if (payload.new.user1_id === currentUserId || payload.new.user2_id === currentUserId) {
                    updateChatInList(payload.new.id);
                }
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
    }, [currentUserId, supabase, updateChatInList]);

    const loadMoreChats = useCallback(() => {
        if (currentUserId && hasMoreChats && !loadingMore) {
            syncChatsWithSupabase(currentUserId, true);
        }
    }, [currentUserId, hasMoreChats, loadingMore, syncChatsWithSupabase]);

    return { chats, setChats, loading, hasMoreChats, loadingMore, loadMoreChats };
};
