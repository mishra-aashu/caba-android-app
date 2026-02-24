import { useEffect, useRef } from 'react';
import db from '../db/db';
import { supabase } from '../config/supabase';
import { uploadMedia, uploadVoiceMessage } from '../services/mediaService';
import useChatStore from '../store/useChatStore';
import { useQueryClient } from '@tanstack/react-query';

/**
 * useNetworkSync monitors online/offline status and processes the sync_queue
 * when the internet connection is restored.
 */
const useNetworkSync = () => {
    const isSyncing = useRef(false);
    const queryClient = useQueryClient();

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
                    .sortBy('id'); // Ensure strict creation order (ASC)

                if (pendingItems.length === 0) return;

                console.log(`Processing ${pendingItems.length} pending sync items...`);

                for (const item of pendingItems) {
                    try {
                        // 1. Per-item Auth Verification: Protect against session expiry mid-sync
                        const { data: { session }, error: authError } = await supabase.auth.getSession();
                        if (authError || !session) {
                            console.warn('Sync aborted mid-loop: Invalid session');
                            break; // Stop processing further items until re-authenticated
                        }

                        let error = null;
                        let syncedData = null;

                        switch (item.type) {
                            case 'send_message':
                                // [FIX 1] Offline Media Upload
                                // Extract payload and potential local file
                                const { tempId, file, ...supabasePayload } = item.payload;

                                let finalPayload = { ...supabasePayload };

                                // If there's a local file, upload it first
                                if (file) {
                                    console.log('Syncing media file for message...', item.id);
                                    let mediaPath = null;

                                    if (supabasePayload.media_type === 'voice') {
                                        mediaPath = await uploadVoiceMessage(file, session.user.id);
                                    } else {
                                        mediaPath = await uploadMedia(file, session.user.id);
                                    }

                                    if (!mediaPath) {
                                        error = { message: 'Failed to upload media during sync' };
                                        break;
                                    }

                                    finalPayload.media_path = mediaPath;
                                }

                                const { data: msgData, error: msgError } = await supabase
                                    .from('messages')
                                    .insert(finalPayload)
                                    .select()
                                    .single();

                                if (!msgError && msgData) {
                                    syncedData = msgData;
                                    // 2. Precision Reconciliation: Use indexed tempId for O(1) lookup
                                    await db.transaction('rw', db.messages, async () => {
                                        if (tempId) {
                                            const recordByTempId = await db.messages.where('tempId').equals(tempId).first();
                                            if (recordByTempId) {
                                                await db.messages.delete(recordByTempId.id);
                                            }
                                        }
                                        await db.messages.add(msgData);
                                    });

                                    // [FIX 2] Real-time UI Invalidation (Zustand)
                                    // Instantly update the UI status from 'pending' to 'sent'
                                    if (tempId) {
                                        useChatStore.getState().replaceTempMessage(tempId, {
                                            ...msgData,
                                            status: 'sent',
                                            sender: useChatStore.getState().messages.find(m => m.tempId === tempId)?.sender
                                        });
                                    }

                                    // Invalidate React Query if applicable
                                    if (finalPayload.chat_id) {
                                        queryClient.invalidateQueries({ queryKey: ['messages', finalPayload.chat_id] });
                                    }
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
    }, [queryClient]);
};

export default useNetworkSync;

