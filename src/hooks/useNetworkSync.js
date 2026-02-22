import { useEffect, useRef } from 'react';
import db from '../db/db';
import { supabase } from '../config/supabase';

/**
 * useNetworkSync monitors online/offline status and processes the sync_queue
 * when the internet connection is restored.
 */
const useNetworkSync = () => {
    const isSyncing = useRef(false);

    useEffect(() => {
        const processQueue = async () => {
            if (isSyncing.current) return;
            isSyncing.current = true;

            try {
                // 1. Auth Check: Ensure session is valid/refreshed before sync
                const { data: { session }, error: authError } = await supabase.auth.getSession();

                if (authError || !session) {
                    console.warn('Sync postponed: No active session');
                    return;
                }

                const pendingItems = await db.sync_queue
                    .where('status')
                    .equals('pending')
                    .toArray();

                if (pendingItems.length === 0) return;

                console.log(`Processing ${pendingItems.length} pending sync items...`);

                for (const item of pendingItems) {
                    try {
                        let error = null;

                        switch (item.type) {
                            case 'send_message':
                                const { data: syncedData, error: msgError } = await supabase
                                    .from('messages')
                                    .insert(item.payload)
                                    .select()
                                    .single();

                                if (!msgError && syncedData) {
                                    // 2. Reconciliation: Update local Dexie with real ID and remove temp
                                    await db.transaction('rw', db.messages, async () => {
                                        // We need a way to find the temp message. 
                                        // Since we don't have the temp ID in the payload, 
                                        // we use content and created_at as a heuristic.
                                        const tempMsg = await db.messages
                                            .where('content').equals(item.payload.content)
                                            .and(m => m.created_at === item.payload.created_at)
                                            .first();

                                        if (tempMsg) {
                                            await db.messages.delete(tempMsg.id);
                                        }
                                        await db.messages.add(syncedData);
                                    });
                                }
                                error = msgError;
                                break;


                            case 'update_profile':
                                const { error: profileError } = await supabase
                                    .from('users')
                                    .update(item.payload.data)
                                    .eq('id', item.payload.id);
                                error = profileError;
                                break;

                            default:
                                console.warn(`Unknown sync item type: ${item.type}`);
                                break;
                        }

                        // 2. Atomic Update: Use Dexie transaction to mark as completed
                        if (!error) {
                            await db.transaction('rw', db.sync_queue, async () => {
                                await db.sync_queue.update(item.id, {
                                    status: 'completed',
                                    synced_at: new Date().toISOString()
                                });
                            });
                        } else {
                            console.error(`Failed to sync item ${item.id}:`, error);
                        }
                    } catch (err) {
                        console.error(`Error processing sync item ${item.id}:`, err);
                    }
                }
            } finally {
                isSyncing.current = false;
            }
        };

        const handleOnline = () => {
            console.log('App is online. Starting sync...');
            processQueue();
        };

        window.addEventListener('online', handleOnline);

        if (navigator.onLine) {
            processQueue();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, []);
};

export default useNetworkSync;

