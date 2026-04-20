import { useEffect, useRef } from 'react';
import db from '../db/db';
import { supabase } from '../config/supabase';
import { uploadMedia, uploadVoiceMessage } from '../services/mediaService';
import useChatStore from '../store/useChatStore';
import { safeDbConversion } from '../utils/dbFieldMapping';

/**
 * useNetworkSync monitors online/offline status and processes the sync_queue
 * when the internet connection is restored.
 */
const useNetworkSync = () => {
    const isSyncing = useRef(false);

    useEffect(() => {
        const processQueue = async () => {
            // [FIX] Phased Loading: Wait for app to settle (2s) before hitting the DB
            // Especially during the Cinematic Intro on desktop.
            await new Promise(r => setTimeout(r, 2000));

            if (isSyncing.current) return;
            isSyncing.current = true;

            try {
                useChatStore.getState().setSyncing(true);

                // [FIX #16] Single auth check before processing
                const { data: { session }, error: authError } = await supabase.auth.getSession();

                if (authError || !session) {
                    console.warn('Sync postponed: No active session');
                    return;
                }

                let currentSession = session;

                // [FIX #10] Recovery: Reset failed items that are recent (< 24h)
                // BUT limit total automatic resets to 3 to prevent infinite loops
                const now = new Date();
                const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

                await db.sync_queue
                    .where('status').equals('failed')
                    .and(item =>
                        item.failedAt &&
                        item.failedAt > twentyFourHoursAgo &&
                        (item.totalResets || 0) < 3
                    )
                    .modify(item => {
                        item.status = 'pending';
                        item.retryCount = 0;
                        item.totalResets = (item.totalResets || 0) + 1;
                    });

                const pendingItems = await db.sync_queue
                    .where('status')
                    .equals('pending')
                    .sortBy('id'); // Ensure strict creation order (ASC)

                if (pendingItems.length === 0) return;

                console.log(`Processing ${pendingItems.length} pending sync items...`);

                for (const item of pendingItems) {
                    try {
                        let error = null;

                        switch (item.type) {
                            case 'send_message': {
                                // [FIX #3] Extract serialized file data instead of raw File object
                                const {
                                    tempId,
                                    file,        // legacy — may be a dead plain object
                                    fileData,    // ArrayBuffer (correct serialized form)
                                    fileName,
                                    fileType,
                                    ...supabasePayload
                                } = item.payload;

                                let finalPayload = { ...supabasePayload };

                                // Group Message Fix: receiver_id must be sender placeholder for groups
                                if (finalPayload.is_group_message && !finalPayload.receiver_id) {
                                    finalPayload.receiver_id = currentSession.user.id;
                                }

                                // [FIX #3] Reconstruct File from serialized ArrayBuffer
                                if (fileData && fileName) {
                                    console.log('Syncing media file for message...', item.id);
                                    let mediaPath = null;
                                    const reconstructedFile = new File(
                                        [fileData],
                                        fileName,
                                        { type: fileType || 'application/octet-stream' }
                                    );

                                    if (supabasePayload.media_type === 'voice') {
                                        mediaPath = await uploadVoiceMessage(reconstructedFile, currentSession.user.id);
                                    } else {
                                        mediaPath = await uploadMedia(reconstructedFile, currentSession.user.id);
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
                                    const normalizedMsg = safeDbConversion(msgData);

                                    // Atomic swap in Dexie: delete temp, insert final
                                    await db.transaction('rw', [db.messages, db.sync_queue], async () => {
                                        if (tempId) {
                                            const recordByTempId = await db.messages
                                                .where('tempId')
                                                .equals(tempId)
                                                .first();
                                            if (recordByTempId) {
                                                await db.messages.delete(recordByTempId.id);
                                            }
                                        }
                                        await db.messages.put(normalizedMsg);

                                        // Mark sync item as completed ATOMICALLY
                                        await db.sync_queue.update(item.id, {
                                            status: 'completed',
                                            syncedAt: new Date().toISOString(),
                                        });
                                    });

                                    error = null;
                                } else {
                                    error = msgError;
                                }
                                break;
                            }

                            case 'create_group': {
                                const { tempId, payload } = item.payload;
                                const { name, description, avatar_url, created_by, memberIds } = payload;

                                // Step 1: Insert group
                                const { data: groupData, error: groupError } = await supabase
                                    .from('groups')
                                    .insert({ name, description, avatar_url, created_by })
                                    .select()
                                    .single();

                                if (groupError) {
                                    error = groupError;
                                    break;
                                }

                                const groupId = groupData.id;

                                // Step 2: Add members
                                // Creator first (admin)
                                await supabase.from('group_members').insert({
                                    group_id: groupId,
                                    user_id: created_by,
                                    role: 'admin',
                                    joined_at: new Date().toISOString(),
                                });

                                // Others
                                const otherMemberIds = (memberIds || []).filter(id => id !== created_by);
                                if (otherMemberIds.length > 0) {
                                    const memberRecords = otherMemberIds.map(userId => ({
                                        group_id: groupId,
                                        user_id: userId,
                                        role: 'member',
                                        joined_at: new Date().toISOString(),
                                    }));
                                    await supabase.from('group_members').insert(memberRecords);
                                }

                                // Step 3: System message
                                await supabase.from('messages').insert({
                                    chat_id: groupId,
                                    sender_id: created_by,
                                    receiver_id: created_by,
                                    content: `Group "${name}" was created`,
                                    is_group_message: true,
                                    message_type: 'system',
                                });

                                // Step 4: Atomic swap in Dexie
                                await db.transaction('rw', [db.groups, db.chats_list, db.sync_queue], async () => {
                                    if (tempId) {
                                        // Update group ID
                                        const localGroup = await db.groups.where('id').equals(tempId).first();
                                        if (localGroup) {
                                            await db.groups.delete(tempId);
                                            await db.groups.put({ ...safeDbConversion(groupData), is_syncing: false });
                                        }

                                        // Update chats_list ID
                                        const localChat = await db.chats_list.where('id').equals(tempId).first();
                                        if (localChat) {
                                            await db.chats_list.delete(tempId);
                                            await db.chats_list.put({
                                                ...localChat,
                                                id: groupId,
                                                tempId: null, // Clear temp ID
                                            });
                                        }
                                    }

                                    await db.sync_queue.update(item.id, {
                                        status: 'completed',
                                        syncedAt: new Date().toISOString(),
                                    });
                                });

                                error = null;
                                break;
                            }

                            case 'update_profile': {
                                const { error: profileError } = await supabase
                                    .from('users')
                                    .update(item.payload.data)
                                    .eq('id', item.payload.id);
                                error = profileError;
                                break;
                            }

                            default:
                                console.warn(`Unknown sync item type: ${item.type}`);
                                break;
                        }

                        // Mark as completed only if not already handled in the transaction above
                        if (!error) {
                            const currentItem = await db.sync_queue.get(item.id);
                            if (currentItem && currentItem.status === 'pending') {
                                await db.sync_queue.update(item.id, {
                                    status: 'completed',
                                    syncedAt: new Date().toISOString(),
                                });
                            }
                        } else {
                            console.error(`Failed to sync item ${item.id}:`, error);

                            // [FIX #16] Check if it's an auth error — refresh session if so
                            const errorMsg = error.message || '';
                            if (errorMsg.includes('401') || errorMsg.includes('JWT') || errorMsg.includes('token')) {
                                const refreshResult = await supabase.auth.getSession();
                                if (!refreshResult.data.session) {
                                    console.warn('Session expired during sync. Aborting.');
                                    break;
                                }
                                currentSession = refreshResult.data.session;
                            }

                            // Increment retry count or mark as permanently failed
                            const currentRetryCount = (item.retryCount || 0) + 1;
                            if (currentRetryCount >= 3) {
                                console.warn(`Item ${item.id} failed after 3 attempts. Marking as failed.`);
                                await db.sync_queue.update(item.id, {
                                    status: 'failed',
                                    retryCount: currentRetryCount,
                                    failedAt: new Date().toISOString(),
                                    lastError: errorMsg || 'Unknown error',
                                });

                                // Update local message status for UI
                                if (item.type === 'send_message' && item.payload?.tempId) {
                                    await db.messages
                                        .where('tempId')
                                        .equals(item.payload.tempId)
                                        .modify({ status: 'failed' });
                                }

                                // [FIX #11] New: Update local group/chat status for UI
                                if (item.type === 'create_group' && item.payload?.tempId) {
                                    const tempId = item.payload.tempId;
                                    await db.groups
                                        .where('id')
                                        .equals(tempId)
                                        .modify({ status: 'failed' });

                                    await db.chats_list
                                        .where('id')
                                        .equals(tempId)
                                        .modify({ status: 'failed' });
                                }
                            } else {
                                await db.sync_queue.update(item.id, {
                                    retryCount: currentRetryCount,
                                    lastError: errorMsg || 'Unknown error',
                                });
                            }
                        }
                    } catch (err) {
                        console.error(`Error processing sync item ${item.id}:`, err);
                        await db.sync_queue.update(item.id, {
                            status: 'failed',
                            failedAt: new Date().toISOString(),
                            lastError: err.message || 'Unexpected exception',
                        }).catch(() => {});
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
    }, []);
};

export default useNetworkSync;