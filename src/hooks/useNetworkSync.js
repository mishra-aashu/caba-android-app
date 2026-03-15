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
                useChatStore.getState().setSyncing(true);
                // 1. Auth Check: Ensure session is valid/refreshed before sync
                const { data: { session }, error: authError } = await supabase.auth.getSession();

                if (authError || !session) {
                    console.warn('Sync postponed: No active session');
                    // ✅ If specifically a session error, we might need to notify authStore
                    return;
                }

                // 2. Recovery: Reset failed items that are recent (< 24h) back to pending
                const now = new Date();
                const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
                
                await db.sync_queue
                    .where('status').equals('failed')
                    .and(item => item.failed_at && item.failed_at > twentyFourHoursAgo)
                    .modify({ status: 'pending', retry_count: 0 });

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

                                // Group Message Fix: receiver_id must be sender placeholder for groups
                                if (finalPayload.is_group_message && !finalPayload.receiver_id) {
                                    finalPayload.receiver_id = session.user.id;
                                }

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
                                    // 2. Precision Reconciliation: Atomic Swap
                                    // Wrap everything in a single transaction to prevent duplicates/ghost messages
                                    await db.transaction('rw', [db.messages, db.sync_queue], async () => {
                                        if (tempId) {
                                            const recordByTempId = await db.messages.where('tempId').equals(tempId).first();
                                            if (recordByTempId) {
                                                await db.messages.delete(recordByTempId.id);
                                            }
                                        }
                                        await db.messages.add(msgData);

                                        // Mark sync item as completed ATOMICALLY with the DB update
                                        await db.sync_queue.update(item.id, {
                                            status: 'completed',
                                            synced_at: new Date().toISOString()
                                        });
                                    });

                                    // [FIX 2] Real-time UI Invalidation (TanStack Query)
                                    // Instantly update the UI status from 'pending' to 'sent'
                                    if (tempId && finalPayload.chat_id) {
                                        queryClient.setQueryData(['messages', finalPayload.chat_id], (old) => {
                                            if (!old) return old;
                                            return {
                                                ...old,
                                                pages: old.pages.map(page => ({
                                                    ...page,
                                                    data: page.data.map(m => m.tempId === tempId ? { ...msgData, status: 'sent', sender: m.sender } : m)
                                                }))
                                            };
                                        });
                                    }

                                    // Invalidate React Query if applicable
                                    if (finalPayload.chat_id) {
                                        queryClient.invalidateQueries({ queryKey: ['messages', finalPayload.chat_id] });
                                    }

                                    // Reset error so the outer loop doesn't try to mark it again
                                    error = null;
                                } else {
                                    error = msgError;
                                }
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

                        // 2. Atomic Update: Mark as completed only if it wasn't already handled in the 'send_message' block
                        if (!error) {
                            const currentItem = await db.sync_queue.get(item.id);
                            if (currentItem.status === 'pending') {
                                await db.sync_queue.update(item.id, {
                                    status: 'completed',
                                    synced_at: new Date().toISOString()
                                });
                            }
                        } else {
                            console.error(`Failed to sync item ${item.id}:`, error);

                            // Increment retry count or mark as failed
                            const currentRetryCount = (item.retry_count || 0) + 1;
                            if (currentRetryCount >= 3) {
                                console.warn(`Item ${item.id} failed after 3 attempts. Marking as failed.`);
                                await db.sync_queue.update(item.id, {
                                    status: 'failed',
                                    failed_at: new Date().toISOString(),
                                    last_error: error.message || 'Unknown error'
                                });

                                // Update local message status for UI
                                if (item.type === 'send_message' && item.payload?.tempId) {
                                    await db.messages.where('tempId').equals(item.payload.tempId).modify({ status: 'failed' });
                                }
                            } else {
                                await db.sync_queue.update(item.id, {
                                    retry_count: currentRetryCount,
                                    last_error: error.message || 'Unknown error'
                                });
                            }
                        }
                    } catch (err) {
                        console.error(`Error processing sync item ${item.id}:`, err);
                        // Ensure we don't hang the loop; mark as failed on unexpected exception
                        await db.sync_queue.update(item.id, {
                            status: 'failed',
                            last_error: err.message || 'Unexpected exception'
                        });
                    }

                }
            } finally {
                isSyncing.current = false;
                useChatStore.getState().setSyncing(false);
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

