import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

export const useChatListRealtime = (currentUserId) => {
    const { supabase, session } = useSupabase();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasMoreChats, setHasMoreChats] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const loadChats = useCallback(async (userId, isLoadMore = false) => {
        if (!userId) {
            setLoading(false);
            return;
        }

        if (isLoadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }

        try {
            let query = supabase
                .from('chat_list_view')
                .select('*')
                .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
                .order('last_message_time', { ascending: false });

            if (isLoadMore && chats.length > 0) {
                // Load more chats older than the last one
                const lastChat = chats[chats.length - 1];
                query = query.lt('last_message_time', lastChat.last_message_time);
            }

            // Load 20 chats at a time
            query = query.limit(20);

            const { data, error } = await query;

            if (error) {
                console.error('Error loading chats from view:', error);
                if (!isLoadMore) {
                    const storedChats = localStorage.getItem(`chats_${userId}`);
                    const localChats = storedChats ? JSON.parse(storedChats) : [];
                    setChats(localChats);
                }
                setLoading(false);
                setLoadingMore(false);
                return;
            }

            const formattedChats = (data || []).map(chat => {
                const isUser1 = chat.user1_id === userId;
                const otherUser = {
                    id: isUser1 ? chat.user2_id : chat.user1_id,
                    name: isUser1 ? chat.user2_name : chat.user1_name,
                    phone: isUser1 ? chat.user2_id : chat.user1_id,
                    avatar: isUser1 ? chat.user2_avatar : chat.user1_avatar,
                    is_online: isUser1 ? chat.user2_online : chat.user1_online
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
                setChats(prev => [...prev, ...formattedChats]);
                setHasMoreChats(formattedChats.length === 20);
            } else {
                setChats(formattedChats);
                setHasMoreChats(formattedChats.length === 20);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
            if (!isLoadMore) {
                setChats([]);
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [supabase, chats]);

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
                is_online: isUser1 ? data.user2_online : data.user1_online
            };
            
            const updatedChat = {
                id: data.chat_id,
                otherUser,
                last_message: data.last_message,
                last_message_time: data.last_message_time,
                unreadCount: parseInt(data.unread_count) || 0
            };

            setChats(prev => {
                const index = prev.findIndex(c => c.id === chatId);
                if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = updatedChat;
                    return updated.sort((a, b) =>
                        new Date(b.last_message_time) - new Date(a.last_message_time)
                    );
                } else {
                    return [updatedChat, ...prev];
                }
            });
        }
    }, [currentUserId, supabase]);

    useEffect(() => {
        if (currentUserId) {
            loadChats(currentUserId);
        } else {
            setChats([]);
            setLoading(false);
        }
    }, [currentUserId, loadChats]);

    useEffect(() => {
        // Channel Start karne ka function
        const startChannels = () => {
            // Agar purane channels zinde hain, toh pehle unhe maaro (Cleanup)
            const existingChannels = supabase.getChannels ? supabase.getChannels() : [];
            existingChannels.forEach(channel => {
                if (channel.topic && (channel.topic.includes('chat_list_messages') || channel.topic.includes('chat_list_chats'))) {
                    supabase.removeChannel(channel);
                }
            });

            if (!currentUserId) return;

            console.log(`🔌 Connecting to chat list realtime updates for user: ${currentUserId}...`);

            // Messages channel banao
            const messagesChannel = supabase
                .channel('chat_list_messages')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages'
                    },
                    async (payload) => {
                        const message = payload.new;
                        if (message.sender_id === currentUserId || message.receiver_id === currentUserId) {
                            console.log('⚡ New message in chat list:', payload);
                            await updateChatInList(message.chat_id);
                        }
                    }
                )
                .subscribe((status) => {
                    console.log(`Chat list messages status: ${status}`);

                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Chat list messages connected!');
                    }

                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.log('❌ Chat list messages connection died. Retrying in 1s...');
                        setTimeout(startChannels, 1000);
                    }
                });

            // Chats channel banao
            const chatsChannel = supabase
                .channel('chat_list_chats')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'chats'
                    },
                    (payload) => {
                        if (payload.new.user1_id === currentUserId || payload.new.user2_id === currentUserId) {
                            console.log('⚡ Chat update in chat list:', payload);
                            updateChatInList(payload.new.id);
                        }
                    }
                )
                .subscribe((status) => {
                    console.log(`Chat list chats status: ${status}`);

                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Chat list chats connected!');
                    }

                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.log('❌ Chat list chats connection died. Retrying in 1s...');
                        setTimeout(startChannels, 1000);
                    }
                });
        };

        // Initial Start
        startChannels();

        // Cleanup when component unmounts
        return () => {
            const existingChannels = supabase.getChannels ? supabase.getChannels() : [];
            existingChannels.forEach(channel => {
                if (channel.topic && (channel.topic.includes('chat_list_messages') || channel.topic.includes('chat_list_chats'))) {
                    supabase.removeChannel(channel);
                }
            });
        };
    }, [currentUserId, updateChatInList, supabase, session]);

    const loadMoreChats = useCallback(() => {
        if (currentUserId && hasMoreChats && !loadingMore) {
            loadChats(currentUserId, true);
        }
    }, [currentUserId, hasMoreChats, loadingMore, loadChats]);

    return { chats, setChats, loading, hasMoreChats, loadingMore, loadMoreChats };
};
