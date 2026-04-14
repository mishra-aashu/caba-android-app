import { db } from '../db/db';
import { supabase } from '../config/supabase';

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
    
    // 1. Check what we have in Dexie
    const latestMsg = await db.messages
        .where('chatId')
        .equals(chatId)
        .reverse()
        .sortBy('createdAt')
        .then(msgs => msgs[0]);

    if (!latestMsg) {
        await fetchMessagesPage({ chatId });
        return;
    }

    // ── Background catch-up & enrichment retry ──
    if (navigator.onLine) {
        // 1. Retry stale profile enrichments
        enrichStaleMessages(chatId).catch(() => {});
        try {
            const { data, error } = await supabase
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
                .gt('created_at', latestMsg.createdAt)
                .order('created_at', { ascending: true });

            if (!error && data?.length > 0) {
                // [FIX] Use safeDbConversion to match the frontend expectations
                const { safeDbConversion } = await import('../utils/dbFieldMapping');
                const converted = safeDbConversion(data);
                
                await db.messages.bulkPut(converted);
                // Also update the chat list lastMessageAt
                await db.chats_list.update(chatId, { 
                    lastMessageAt: converted[converted.length - 1].createdAt 
                });
            }
        } catch (err) {
            console.warn('[Sync] Background catch-up failed:', err);
        }
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
