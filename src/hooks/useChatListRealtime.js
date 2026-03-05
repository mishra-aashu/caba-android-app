import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../contexts/SupabaseContext';
import { realtimeManager } from '../utils/realtimeManager';
import { initializeFileSystem, loadChatsFromDevice, saveChatsToDevice } from '../utils/FileSystemManager';
import { isUserOnline } from '../utils/dateFormatter';
import { normalizeChat } from '../utils/chatHelpers';

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

    const _log = (message, detail = {}) => {
        console.log(`[RT] ${message}`, { userId: currentUserId, ...detail });
    };

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

    // Real-time: single channel, strict cleanup to prevent leaks and setState-after-unmount
    const mountedRef = useRef(true);
    const currentUserIdRef = useRef(currentUserId);
    const queryClientRef = useRef(queryClient);

    useEffect(() => {
        mountedRef.current = true;
        currentUserIdRef.current = currentUserId;
        queryClientRef.current = queryClient;
    }, [currentUserId, queryClient]);

    const handlePayload = useCallback((payload) => {
        if (!mountedRef.current) return;
        const currentId = currentUserIdRef.current;
        const qClient = queryClientRef.current;

        _log('Chat list real-time update', { event: payload.eventType });

        // For updates/deletes, just invalidate the whole list
        if (payload.eventType === 'DELETE' || payload.eventType === 'UPDATE') {
            qClient.invalidateQueries({ queryKey: ['chatList', currentId] });
            return;
        }

        // For inserts, try to move the chat to top optimistically
        if (payload.eventType === 'INSERT' && payload.new) {
            const newMessage = payload.new;
            setChats(prev => {
                const chatIndex = prev.findIndex(c => c.id === newMessage.chat_id);
                if (chatIndex === -1) {
                    // New chat started, refetch list
                    qClient.invalidateQueries({ queryKey: ['chatList', currentId] });
                    return prev;
                }
                const chat = { ...prev[chatIndex] };
                chat.lastMessage = newMessage.content ?? (newMessage.message_type !== 'text' ? `[${newMessage.message_type}]` : '');
                chat.timestamp = newMessage.created_at;
                if (newMessage.sender_id !== currentId) chat.unreadCount = (chat.unreadCount || 0) + 1;

                const next = [...prev];
                next.splice(chatIndex, 1);
                next.unshift(chat);
                return next;
            });
        }
    }, []);


    useEffect(() => {
        if (!currentUserId) return;

        const channelName = `chat_list_updates_${currentUserId}`;
        console.log(`[useChatListRealtime] Subscribing: ${currentUserId}`);

        realtimeManager.subscribe(
            channelName,
            {},
            {
                postgres_changes: [
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        handler: handlePayload
                    },
                    {
                        event: '*',
                        schema: 'public',
                        table: 'chats',
                        handler: (payload) => {
                            _log('Chat record changed', { id: payload.new?.id });
                            if (mountedRef.current) queryClientRef.current.invalidateQueries({ queryKey: ['chatList', currentUserIdRef.current] });
                        }
                    },
                    {
                        event: '*',
                        schema: 'public',
                        table: 'groups',
                        handler: (payload) => {
                            _log('Group record changed', { id: payload.new?.id });
                            if (mountedRef.current) queryClientRef.current.invalidateQueries({ queryKey: ['chatList', currentUserIdRef.current] });
                        }
                    },
                    {
                        event: '*',
                        schema: 'public',
                        table: 'group_members',
                        handler: (payload) => {
                            if (!mountedRef.current) return;
                            const currentId = currentUserIdRef.current;
                            if (payload?.new?.user_id === currentId || payload?.old?.user_id === currentId) {
                                _log('User group membership changed');
                                queryClientRef.current.invalidateQueries({ queryKey: ['chatList', currentId] });
                            }
                        }
                    }
                ],
                onReconnect: () => {
                    if (mountedRef.current) {
                        _log('Re-syncing chat list after reconnect');
                        queryClientRef.current.invalidateQueries({ queryKey: ['chatList', currentUserIdRef.current] });
                    }
                }
            }
        );

        return () => {
            console.log(`[useChatListRealtime] Unsubscribing: ${currentUserId}`);
            realtimeManager.unsubscribe(channelName);
        };
    }, [currentUserId, handlePayload]);

    return { chats, setChats, loading, hasMoreChats, loadingMore, loadMoreChats };
};

export default useChatListRealtime;
