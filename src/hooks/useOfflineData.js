import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db/db';
import { supabase } from '../config/supabase';
import { useQuery } from '@tanstack/react-query';

/**
 * useOfflineData serves data from Dexie first and syncs from Supabase in background.
 * Uses TanStack Query to ensure we don't spam Supabase on every mount.
 * @param {string} tableName - Dexie table name
 * @param {string} supabaseTable - Supabase table name
 * @param {object} queryBuilder - Function to refine supabase query
 */
const useOfflineData = (tableName, supabaseTable, queryBuilder = null) => {
    // 1. serve data from Dexie instantly
    const data = useLiveQuery(() => db[tableName].toArray());

    // 2. Use useQuery to handle background sync throttle
    useQuery({
        queryKey: ['bgSync', tableName, supabaseTable],
        queryFn: async () => {
            if (!navigator.onLine) return null;

            try {
                let query = supabase.from(supabaseTable).select('*');
                if (queryBuilder) {
                    query = queryBuilder(query);
                }

                const { data: remoteData, error } = await query;
                if (error) throw error;

                if (remoteData) {
                    const { safeDbConversion } = await import('../utils/dbFieldMapping');
                    await db[tableName].bulkPut(safeDbConversion(remoteData));
                }
                return { lastSync: new Date().toISOString() };
            } catch (err) {
                console.error(`Background sync failed for ${tableName}:`, err);
                throw err;
            }
        },
        staleTime: 1000 * 60 * 5, // Only sync every 5 minutes
        gcTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false,
        refetchOnMount: true,
    });

    return { data, loading: data === undefined };
};

/**
 * Specialized hook for messages with chat_id filtering
 */
export const useOfflineMessages = (chatId) => {
    const messages = useLiveQuery(
        () => db.messages.where('chatId').equals(chatId).sortBy('createdAt'),
        [chatId]
    );

    useQuery({
        queryKey: ['bgSyncMessages', chatId],
        queryFn: async () => {
            if (!chatId || !navigator.onLine) return null;

            const { data: remoteMessages, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            if (remoteMessages) {
                const { safeDbConversion } = await import('../utils/dbFieldMapping');
                await db.messages.bulkPut(safeDbConversion(remoteMessages));
            }
            return { lastSync: new Date().toISOString() };
        },
        enabled: !!chatId,
        staleTime: 1000 * 60 * 2, // Sync messages every 2 minutes
        refetchOnWindowFocus: false,
    });

    return messages || [];
};

/**
 * Specialized hook for chat list
 */
export const useOfflineChats = (userId) => {
    const chats = useLiveQuery(
        () => db.chats_list.orderBy('lastMessageAt').reverse().toArray(),
        []
    );

    useQuery({
        queryKey: ['bgSyncChats', userId],
        queryFn: async () => {
            if (!userId || !navigator.onLine) return null;

            const { data: remoteChats, error } = await supabase
                .from('chats')
                .select('*')
                .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

            if (error) throw error;
            if (remoteChats) {
                const { safeDbConversion } = await import('../utils/dbFieldMapping');
                await db.chats_list.bulkPut(safeDbConversion(remoteChats));
            }
            return { lastSync: new Date().toISOString() };
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });

    return chats || [];
};

export default useOfflineData;
