import { useEffect } from 'react';
import db from '../db/db';
import { supabase } from '../config/supabase';

/**
 * useNetworkSync monitors online/offline status and processes the sync_queue
 * when the internet connection is restored.
 */
const useNetworkSync = () => {
    useEffect(() => {
        const processQueue = async () => {
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
                            const { error: msgError } = await supabase
                                .from('messages')
                                .insert(item.payload);
                            error = msgError;
                            break;

                        case 'update_profile':
                            const { error: profileError } = await supabase
                                .from('users')
                                .update(item.payload.data)
                                .eq('id', item.payload.id);
                            error = profileError;
                            break;

                        // Add more cases as needed (groups, contacts, etc.)
                        default:
                            console.warn(`Unknown sync item type: ${item.type}`);
                            break;
                    }

                    if (!error) {
                        await db.sync_queue.update(item.id, { status: 'completed' });
                    } else {
                        console.error(`Failed to sync item ${item.id}:`, error);
                        // Optionally mark as failed or retry later
                    }
                } catch (err) {
                    console.error(`Error processing sync item ${item.id}:`, err);
                }
            }
        };

        const handleOnline = () => {
            console.log('App is online. Starting sync...');
            processQueue();
        };

        window.addEventListener('online', handleOnline);

        // Initial check in case we just loaded while online
        if (navigator.onLine) {
            processQueue();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, []);
};

export default useNetworkSync;
