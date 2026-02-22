import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db/db';
import { supabase } from '../config/supabase';

/**
 * useOfflineData serves data from Dexie first and syncs from Supabase in background.
 * @param {string} tableName - Dexie table name
 * @param {string} supabaseTable - Supabase table name
 * @param {object} queryBuilder - Function to refine supabase query
 */
const useOfflineData = (tableName, supabaseTable, queryBuilder = null) => {
    // 1. serve data from Dexie instantly
    const data = useLiveQuery(() => db[tableName].toArray());

    useEffect(() => {
        // 2. Silently fetch from Supabase in background
        const syncData = async () => {
            try {
                let query = supabase.from(supabaseTable).select('*');
                if (queryBuilder) {
                    query = queryBuilder(query);
                }

                const { data: remoteData, error } = await query;

                if (error) throw error;

                if (remoteData) {
                    // 3. Update Dexie with fresh server data
                    // We use bulkPut to update existing and add new ones
                    await db[tableName].bulkPut(remoteData);
                }
            } catch (err) {
                console.error(`Background sync failed for ${tableName}:`, err);
            }
        };

        syncData();
    }, [tableName, supabaseTable, queryBuilder]);

    return { data, loading: data === undefined };
};

/**
 * Specialized hook for messages with chat_id filtering
 */
export const useOfflineMessages = (chatId) => {
    const messages = useLiveQuery(
        () => db.messages.where('chat_id').equals(chatId).sortBy('created_at'),
        [chatId]
    );

    useEffect(() => {
        if (!chatId) return;

        const syncMessages = async () => {
            const { data: remoteMessages, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true });

            if (!error && remoteMessages) {
                await db.messages.bulkPut(remoteMessages);
            }
        };

        syncMessages();
    }, [chatId]);

    return messages || [];
};

/**
 * Specialized hook for chat list
 */
export const useOfflineChats = (userId) => {
    const chats = useLiveQuery(
        () => db.chats_list.orderBy('last_message_at').reverse().toArray(),
        []
    );

    useEffect(() => {
        if (!userId) return;

        const syncChats = async () => {
            // This is a simplified fetch, actual app might use a more complex join
            const { data: remoteChats, error } = await supabase
                .from('chats')
                .select('*')
                .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

            if (!error && remoteChats) {
                await db.chats_list.bulkPut(remoteChats);
            }
        };

        syncChats();
    }, [userId]);

    return chats || [];
};

export default useOfflineData;
