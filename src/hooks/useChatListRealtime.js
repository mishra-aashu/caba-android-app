import { useEffect, useState, useCallback, useRef } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { realtimeManager } from '../utils/realtimeManager';
import { initializeFileSystem, loadChatsFromDevice, saveChatsToDevice } from '../utils/FileSystemManager';
import { isUserOnline } from '../utils/dateFormatter';
import { normalizeChat } from '../utils/chatHelpers';
import { db } from '../db/db';
import useChatStore from '../store/useChatStore';

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
    const activeChat = useChatStore(state => state.activeChat);
    const [loading, setLoading] = useState(true);
    const [hasMoreChats, setHasMoreChats] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const _log = (message, detail = {}) => {
        console.log(`[RT] ${message}`, { userId: currentUserId, ...detail });
    };

    const loadAndSyncChats = useCallback(async (silent = false) => {
        if (!currentUserId || !supabase) return;
        if (!silent) setLoading(true);
        try {
            const freshChats = await fetchChatList({ supabase, userId: currentUserId });
            const updatedChats = freshChats.map(chat => ({
               ...chat,
               is_online: isUserOnline(Boolean(chat.is_online), chat.last_seen)
            }));
            
            await db.transaction('rw', db.chats_list, async () => {
                await db.chats_list.bulkPut(updatedChats);
            });
            setHasMoreChats(updatedChats.length >= 20);
        } catch (error) {
            console.error('Error syncing chats:', error);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [currentUserId, supabase]);

    // Initial load from device storage
    useEffect(() => {
        const loadInitialData = async () => {
            if (!currentUserId) return;
            try {
                // 1. Check if Dexie already has data (from previous session / SyncService)
                const localChatCount = await db.chats_list.count();
                
                if (localChatCount === 0) {
                    // 2. Dexie is empty — try filesystem fallback first
                    await initializeFileSystem();
                    const localChats = await loadChatsFromDevice();
                    if (localChats && localChats.length > 0) {
                        await db.transaction('rw', db.chats_list, async () => {
                            await db.chats_list.bulkPut(localChats);
                        });
                    }
                    // 3. Still empty — do a full network fetch
                    loadAndSyncChats();
                }
                // If data exists, SyncService handles background catch-up — no network call needed here
            } catch (error) {
                console.warn('Initial data load failed, falling back to network:', error);
                loadAndSyncChats();
            }
        };
        loadInitialData();
    }, [currentUserId, loadAndSyncChats]);

    const loadMoreChats = useCallback(async () => {
        if (!currentUserId || !hasMoreChats || loadingMore || !supabase) return;

        setLoadingMore(true);
        try {
            const currentChats = await db.chats_list.orderBy('lastMessageAt').reverse().toArray();
            const lastChat = currentChats[currentChats.length - 1];
            const lastTimestamp = lastChat?.lastMessageAt;

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

    const handlePayload = useCallback(async (payload) => {
        if (!mountedRef.current || !currentUserId) return;
        
        const { eventType, new: newRecord, table } = payload;
        _log('Real-time event received', { event: eventType, table });

        if (table === 'messages' && eventType === 'INSERT') {
            const chatId = newRecord.chat_id;
            const isMyMessage = newRecord.sender_id === currentUserId;
            const msgTime = newRecord.created_at;

            // Direct update is faster than a transaction for single records
            const existingChat = await db.chats_list.get(chatId);
            const isActive = activeChat?.id === chatId;

            if (existingChat) {
                db.chats_list.update(chatId, {
                    lastMessage: newRecord.content,
                    lastMessageAt: msgTime,
                    timestamp: msgTime, // Sort key
                    unreadCount: (isActive || isMyMessage) ? 0 : (existingChat.unreadCount || 0) + 1,
                    isMyMessage: isMyMessage
                }).catch(err => console.warn('[RT] Fast update failed:', err));
            } else {
                // Chat doesn't exist locally? Then it's a new chat, better refetch
                loadAndSyncChats(true);
            }
            return;
        }

        // For other events (UPDATE/DELETE or other tables), do a silent refetch
        const now = Date.now();
        if (now - lastSyncTimeRef.current < 2000) return;
        lastSyncTimeRef.current = now;
        loadAndSyncChats(true);
    }, [loadAndSyncChats, currentUserId, _log]);


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
