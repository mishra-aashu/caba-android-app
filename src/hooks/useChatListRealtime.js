import { useEffect, useState, useCallback, useRef } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { realtimeManager } from '../utils/realtimeManager';
import { initializeFileSystem, loadChatsFromDevice, saveChatsToDevice } from '../utils/FileSystemManager';
import { isUserOnline } from '../utils/dateFormatter';
import { normalizeChat } from '../utils/chatHelpers';
import { db } from '../db/db';
import useChatStore from '../store/useChatStore';
import { EncryptionService } from '../services/EncryptionService';

// ══════════════════════════════════════════════════════════════
// Fetch Chat List - Unified (chats + groups)
// ══════════════════════════════════════════════════════════════

const fetchChatList = async ({ supabase, userId }) => {
    if (!userId) return [];

    try {
        // Try RPC first (most reliable)
        const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_unified_chat_list', { user_id: userId });

        if (!rpcError && rpcData) {
            return rpcData.map(rawItem => normalizeChat(rawItem, userId));
        }
    } catch (rpcErr) {
        console.log('[ChatList] RPC unavailable, using view fallback:', rpcErr.message);
    }

    // Fallback: Use view
    try {
        const { data: viewData, error: viewError } = await supabase
            .from('unified_chat_list')
            .select('*')
            .order('last_message_time', { ascending: false })
            .limit(20);

        if (!viewError && viewData) {
            return viewData.map(rawItem => normalizeChat(rawItem, userId));
        }
    } catch (viewErr) {
        console.warn('[ChatList] View unavailable:', viewErr.message);
    }

    return [];
};

// ══════════════════════════════════════════════════════════════
// Batch Decryption Worker (Non-blocking)
// ══════════════════════════════════════════════════════════════

const decryptChatsBatched = async (chats) => {
    const BATCH_SIZE = 10;
    const decryptedChats = [];

    for (let i = 0; i < chats.length; i += BATCH_SIZE) {
        const batch = chats.slice(i, i + BATCH_SIZE);
        
        // Decrypt batch
        const decryptedBatch = batch.map(chat => {
            if (chat?.lastMessage) {
                try {
                    chat.lastMessage = EncryptionService.decrypt(
                        chat.lastMessage,
                        chat.id,
                        chat.otherUserId
                    );
                } catch (err) {
                    console.warn(`[Decrypt] Failed for chat ${chat.id}:`, err.message);
                    chat.lastMessage = '[Encrypted]';
                }
            }
            return chat;
        });

        decryptedChats.push(...decryptedBatch);

        // Yield to main thread between batches
        if (i + BATCH_SIZE < chats.length) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    return decryptedChats;
};

// ══════════════════════════════════════════════════════════════
// Main Hook
// ══════════════════════════════════════════════════════════════

export const useChatListRealtime = (currentUserId) => {
    const { supabase } = useSupabase();
    const activeChat = useChatStore(state => state.activeChat);
    
    const [loading, setLoading] = useState(true);
    const [hasMoreChats, setHasMoreChats] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Refs for stable access in callbacks
    const mountedRef = useRef(true);
    const lastSyncTimeRef = useRef(0);
    const activeChatIdRef = useRef(activeChat?.id);

    // Update active chat ref when it changes
    useEffect(() => {
        activeChatIdRef.current = activeChat?.id;
    }, [activeChat?.id]);

    // ──────────────────────────────────────────────────────────
    // Load & Sync Chats
    // ──────────────────────────────────────────────────────────

    const loadAndSyncChats = useCallback(async (silent = false) => {
        if (!currentUserId || !supabase) return;
        if (!silent) setLoading(true);

        try {
            const freshChats = await fetchChatList({ supabase, userId: currentUserId });
            
            // Batch decrypt (non-blocking)
            const decryptedChats = await decryptChatsBatched(freshChats);
            
            // Add online status (Ensure camelCase field name for UI)
            const updatedChats = decryptedChats.map(chat => ({
                ...chat,
                isOnline: isUserOnline(Boolean(chat.is_online || chat.isOnline), chat.lastSeen || chat.last_seen),
            }));

            // Atomic DB write
            await db.transaction('rw', db.chats_list, async () => {
                await db.chats_list.clear();
                await db.chats_list.bulkAdd(updatedChats);
            });

            // Save to filesystem (background)
            saveChatsToDevice(updatedChats).catch(err => 
                console.warn('[ChatList] Filesystem save failed:', err.message)
            );

            setHasMoreChats(updatedChats.length >= 20);
        } catch (error) {
            console.error('[ChatList] Sync failed:', error);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [currentUserId, supabase]);

    // ──────────────────────────────────────────────────────────
    // Initial Load from Cache
    // ──────────────────────────────────────────────────────────

    useEffect(() => {
        const loadInitialData = async () => {
            if (!currentUserId) return;

            try {
                // Check Dexie first
                const localCount = await db.chats_list.count();

                if (localCount === 0) {
                    // Dexie empty - try filesystem
                    await initializeFileSystem();
                    const localChats = await loadChatsFromDevice();

                    if (localChats?.length > 0) {
                        await db.transaction('rw', db.chats_list, async () => {
                            await db.chats_list.bulkAdd(localChats);
                        });
                        setLoading(false); // Show cached data immediately
                    }
                }

                // Background sync (silent)
                loadAndSyncChats(true);
            } catch (error) {
                console.warn('[ChatList] Cache load failed:', error);
                loadAndSyncChats();
            }
        };

        loadInitialData();
    }, [currentUserId, loadAndSyncChats]);

    // ──────────────────────────────────────────────────────────
    // Load More (Pagination)
    // ──────────────────────────────────────────────────────────

    const loadMoreChats = useCallback(async () => {
        if (!currentUserId || !hasMoreChats || loadingMore || !supabase) return;

        setLoadingMore(true);

        try {
            const currentChats = await db.chats_list
                .orderBy('lastMessageAt')
                .reverse()
                .toArray();

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

            if (data?.length > 0) {
                const formattedChats = data.map(rawItem =>
                    normalizeChat(rawItem, currentUserId)
                );

                const decryptedChats = await decryptChatsBatched(formattedChats);

                await db.transaction('rw', db.chats_list, async () => {
                    await db.chats_list.bulkAdd(decryptedChats);
                });

                const combined = [...currentChats, ...decryptedChats];
                saveChatsToDevice(combined).catch(err =>
                    console.warn('[ChatList] Filesystem save failed:', err.message)
                );

                setHasMoreChats(data.length === 20);
            } else {
                setHasMoreChats(false);
            }
        } catch (error) {
            console.error('[ChatList] Load more failed:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [currentUserId, hasMoreChats, loadingMore, supabase]);

    // ──────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────

    return {
        loading,
        hasMoreChats,
        loadingMore,
        loadMoreChats,
        refetch: loadAndSyncChats,
    };
};


export default useChatListRealtime;