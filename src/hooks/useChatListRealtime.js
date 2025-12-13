import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

export const useChatListRealtime = (currentUserId) => {
    const { supabase } = useSupabase();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadChats = useCallback(async (userId) => {
        if (!userId) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('chat_list_view')
                .select('*')
                .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
                .order('last_message_time', { ascending: false });

            if (error) {
                console.error('Error loading chats from view:', error);
                const storedChats = localStorage.getItem(`chats_${userId}`);
                const localChats = storedChats ? JSON.parse(storedChats) : [];
                setChats(localChats);
                setLoading(false);
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
            setChats(formattedChats);
        } catch (error) {
            console.error('Error loading chats:', error);
            setChats([]);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

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
        if (!currentUserId) return;

        const messagesChannel = supabase
            .channel('chat_list_messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, async (payload) => {
                const message = payload.new;
                if (message.sender_id === currentUserId ||
                    message.receiver_id === currentUserId) {
                    await updateChatInList(message.chat_id);
                }
            })
            .subscribe();

        const chatsChannel = supabase
            .channel('chat_list_chats')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'chats'
            }, (payload) => {
                if (payload.new.user1_id === currentUserId || payload.new.user2_id === currentUserId) {
                    updateChatInList(payload.new.id);
                }
            })
            .subscribe();

        return () => {
            if (messagesChannel) messagesChannel.unsubscribe();
            if (chatsChannel) chatsChannel.unsubscribe();
        };
    }, [currentUserId, updateChatInList, supabase]);

    return { chats, setChats, loading };
};
