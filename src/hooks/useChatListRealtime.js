import { useEffect, useState, useCallback, useRef } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { realtimeManager } from '../utils/realtimeManager';
import { initializeFileSystem, loadChatsFromDevice, saveChatsToDevice } from '../utils/FileSystemManager';
import { isUserOnline } from '../utils/dateFormatter';
import { normalizeChat } from '../utils/chatHelpers';
import { db } from '../db/db';

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
    const [loading, setLoading] = useState(true);
    const [hasMoreChats, setHasMoreChats] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const _log = (message, detail = {}) => {
        console.log(`[RT] ${message}`, { userId: currentUserId, ...detail });
    };

    const loadAndSyncChats = useCallback(async () => {
        if (!currentUserId || !supabase) return;
        setLoading(true);
        try {
            const freshChats = await fetchChatList({ supabase, userId: currentUserId });
            const updatedChats = freshChats.map(chat => ({
               ...chat,
               is_online: isUserOnline(Boolean(chat.is_online), chat.last_seen)
            }));
            
            await db.transaction('rw', db.chats_list, async () => {
                // Remove clear() - we want surgical updates
                await db.chats_list.bulkPut(updatedChats);
                
                // Optional: Cleanup old chats that are no longer in the top 20/first page
                // But generally bulkPut is enough for performance
            });
            setHasMoreChats(updatedChats.length >= 20);
        } catch (error) {
            console.error('Error syncing chats:', error);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, supabase]);

    // Initial load from device storage
    useEffect(() => {
        const loadInitialData = async () => {
            if (!currentUserId) return;
            try {
                await initializeFileSystem();
                const localChats = await loadChatsFromDevice();
                if (localChats && localChats.length > 0) {
                    await db.transaction('rw', db.chats_list, async () => {
                        // Surgical update for initial load too
                        await db.chats_list.bulkPut(localChats);
                    });
                }
            } catch (error) {}
            // Then fetch from remote
            loadAndSyncChats();
        };
        loadInitialData();
    }, [currentUserId, loadAndSyncChats]);

    const loadMoreChats = useCallback(async () => {
        if (!currentUserId || !hasMoreChats || loadingMore || !supabase) return;

        setLoadingMore(true);
        try {
            const currentChats = await db.chats_list.orderBy('timestamp').reverse().toArray();
            const lastChat = currentChats[currentChats.length - 1];
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
                
                await db.transaction('rw', db.chats_list, async () => {
                    await db.chats_list.bulkPut(formattedChats);
                });
                
                const combined = [...currentChats, ...formattedChats];
                saveChatsToDevice(combined);
                
                setHasMoreChats(data.length === 20);
            } else {
                setHasMoreChats(false);
            }
        } catch (error) {
            console.error('Error loading more chats:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [currentUserId, hasMoreChats, loadingMore, supabase]);

    // Real-time
    const mountedRef = useRef(true);
    const lastSyncTimeRef = useRef(0);
    const currentUserIdRef = useRef(currentUserId);
    
    useEffect(() => {
        mountedRef.current = true;
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    const handlePayload = useCallback((payload) => {
        if (!mountedRef.current) return;
        
        const now = Date.now();
        if (now - lastSyncTimeRef.current < 1000) {
            _log('Throttling chat list update');
            return;
        }
        
        lastSyncTimeRef.current = now;
        _log('Chat list real-time update', { event: payload.eventType });
        loadAndSyncChats();
    }, [loadAndSyncChats]);


    useEffect(() => {
        if (!currentUserId) return;

        const channelName = `chat_list_updates_${currentUserId}`;
        console.log(`[useChatListRealtime] Subscribing: ${currentUserId}`);

        realtimeManager.subscribe(
            channelName,
            {},
            {
                postgres_changes: [
                    { event: '*', schema: 'public', table: 'messages', handler: handlePayload },
                    { event: '*', schema: 'public', table: 'chats', handler: handlePayload },
                    { event: '*', schema: 'public', table: 'groups', handler: handlePayload },
                    { event: '*', schema: 'public', table: 'group_members', handler: handlePayload }
                ],
                onReconnect: () => {
                    if (mountedRef.current) loadAndSyncChats();
                }
            }
        );

        return () => {
            console.log(`[useChatListRealtime] Unsubscribing: ${currentUserId}`);
            realtimeManager.unsubscribe(channelName);
        };
    }, [currentUserId, handlePayload, loadAndSyncChats]);

    return { loading, hasMoreChats, loadingMore, loadMoreChats, refetch: loadAndSyncChats };
};

export default useChatListRealtime;
