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

    // Patch up sender/receiver but keep everything else snake_case
    const validMessages = rawMessages.map((msg) => ({
        ...msg,
        sender: msg.sender || {
            id: msg.sender_id,
            name: 'Unknown',
            avatar: null,
        },
        receiver: msg.receiver || (
            msg.receiver_id
                ? { id: msg.receiver_id, name: 'Unknown', avatar: null }
                : null
        ),
    }));

    // Save fetched messages directly into Dexie
    if (validMessages.length > 0) {
        await db.messages.bulkPut(validMessages);
    }

    return {
        count: validMessages.length,
        lastFetchedTimestamp: validMessages.length > 0
            ? validMessages[validMessages.length - 1].created_at
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
        .where('chat_id')
        .equals(chatId)
        .reverse()
        .sortBy('created_at')
        .then(msgs => msgs[0]);

    // 2. If we have nothing, fetch first page
    if (!latestMsg) {
        await fetchMessagesPage({ chatId });
        return;
    }

    // 3. If we have data, try to fetch ONLY new messages since the latest one
    // only if online. This is a background "catch-up".
    if (navigator.onLine) {
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
                .gt('created_at', latestMsg.created_at)
                .order('created_at', { ascending: true });

            if (!error && data?.length > 0) {
                // [FIX] Use safeDbConversion to match the frontend expectations
                const { safeDbConversion } = await import('../utils/dbFieldMapping');
                const converted = safeDbConversion(data);
                
                await db.messages.bulkPut(converted);
                // Also update the chat list last_message_at
                await db.chats_list.update(chatId, { 
                    last_message_at: converted[converted.length - 1].created_at 
                });
            }
        } catch (err) {
            console.warn('[Sync] Background catch-up failed:', err);
        }
    }
};