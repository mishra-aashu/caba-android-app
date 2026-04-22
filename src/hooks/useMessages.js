import { supabase } from '../config/supabase';
import { EncryptionService } from '../services/EncryptionService';
import { db } from '../db/db';
import { dbToFrontend } from '../utils/dbFieldMapping';

/**
 * Fetch messages for a specific chat with pagination
 *
 * [NOTE] We store the raw Supabase response (with sender/receiver objects)
 * into Dexie. This means cached sender data can go stale if a user updates
 * their name/avatar. For now this is acceptable — the data is refreshed on
 * each new fetch. A future improvement could store only IDs and hydrate
 * at render time.
 */
export const fetchMessagesPage = async ({ chatId, beforeTimestamp = null, limit = 50 }) => {
    if (!chatId || chatId === 'new') return { count: 0, lastFetchedTimestamp: null };

    let query = supabase
        .from('messages')
        .select(`
            *,
            sender:sender_id (
                id,
                name,
                avatar,
                is_online,
                last_seen
            ),
            receiver:receiver_id (
                id,
                name,
                avatar,
                is_online,
                last_seen
            )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (beforeTimestamp) {
        query = query.lt('created_at', beforeTimestamp);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching messages page:', error);
        throw error;
    }

    const rawMessages = data || [];
    
    // Decrypt messages if they are from a 1-on-1 chat
    // For groups, we'd need to know if it's a group or 1-on-1 here.
    // fetchMessagesPage doesn't have otherUserId, so we'll try to find it from chats_list
    const chat = await db.chats_list.get(chatId);
    const otherUserId = chat?.otherUserId;

    rawMessages.forEach(msg => {
        if (msg.content) {
            msg.content = EncryptionService.decrypt(msg.content, chatId, otherUserId);
        }
    });

    const { safeDbConversion } = await import('../utils/dbFieldMapping');
    const converted = safeDbConversion(rawMessages);

    // Save fetched messages directly into Dexie
    if (converted.length > 0) {
        await db.messages.bulkPut(converted);
    }

    return {
        count: converted.length,
        lastFetchedTimestamp: converted.length > 0
            ? converted[converted.length - 1].createdAt
            : null,
    };
};


/**
 * Utility to load initial messages for a chat if Dexie is empty
 * Returns a promise so callers can track when loading is done.
 */
export const loadInitialMessagesIfNeeded = async (chatId) => {
    if (!chatId || chatId === 'new') return;
    
    // 1. Check if we have anything in Dexie
    const latestMsg = await db.messages
        .where('chatId')
        .equals(chatId)
        .reverse()
        .sortBy('createdAt')
        .then(msgs => msgs[0]);

    // 2. If empty, do a quick sync
    if (!latestMsg && navigator.onLine) {
        await fetchMessagesPage({ chatId });
        return;
    }

    // 3. Otherwise, let SyncService handle background catch-up
    if (navigator.onLine) {
        import('../services/syncService').then(({ syncService }) => {
            syncService.syncChat(chatId).catch(() => {});
        });
    }
};
/**
 * Lazy-retry enrichment for messages that failed profile fetch previously.
 */
export const enrichStaleMessages = async (chatId) => {
    if (!chatId || chatId === 'new' || !navigator.onLine) return;

    try {
        const staleMessages = await db.messages
            .where('chatId')
            .equals(chatId)
            .filter(m => m.needsEnrichment === true)
            .toArray();

        if (staleMessages.length === 0) return;

        console.log(`[Sync] Retrying enrichment for ${staleMessages.length} messages`);
        
        const { useUserStore } = await import('../store/userStore');
        const userStore = useUserStore.getState();

        for (const msg of staleMessages) {
            try {
                const senderId = msg.sender_id || msg.senderId;
                const profile = await userStore.fetchUserIfNeeded(senderId);
                
                if (profile && profile.name && profile.name !== 'Unknown') {
                    await db.messages.update(msg.id, {
                        sender: profile,
                        needsEnrichment: false
                    });
                }
            } catch (err) {
                // Silently skip; will retry on next chat open
            }
        }
    } catch (err) {
        console.warn('[Sync] Stale enrichment retry failed:', err);
    }
};
