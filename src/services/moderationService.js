/**
 * Moderation Service - Handles blocking and reporting users
 * 
 * Follows Local-First pattern:
 * 1. Update Dexie immediately for instant UI feedback
 * 2. Queue for Supabase sync
 */

import { supabase } from '../config/supabase';
import { db, addToSyncQueue } from '../db/db';
import toast from 'react-hot-toast';

/**
 * Block a user
 */
export const blockUser = async (currentUserId, blockedUserId) => {
    try {
        const tempId = `block_${Date.now()}`;
        
        // 1. Update local Dexie
        await db.blocked_users.put({
            id: tempId,
            user_id: currentUserId,
            blocked_user_id: blockedUserId,
            created_at: new Date().toISOString(),
            is_syncing: true
        });

        // 2. Queue for sync
        await addToSyncQueue('block_user', {
            tempId,
            payload: {
                user_id: currentUserId,
                blocked_user_id: blockedUserId
            }
        });

        return { success: true };
    } catch (error) {
        console.error('Error blocking user:', error);
        throw error;
    }
};

/**
 * Unblock a user
 */
export const unblockUser = async (currentUserId, blockedUserId) => {
    try {
        // 1. Find local record
        const localRecord = await db.blocked_users
            .where('blocked_user_id')
            .equals(blockedUserId)
            .first();

        if (localRecord) {
            // 2. Delete from Dexie
            await db.blocked_users.delete(localRecord.id);

            // 3. Queue for sync
            await addToSyncQueue('unblock_user', {
                payload: {
                    user_id: currentUserId,
                    blocked_user_id: blockedUserId
                }
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Error unblocking user:', error);
        throw error;
    }
};

/**
 * Fetch blocked users from Supabase and sync to Dexie
 */
export const fetchBlockedUsers = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('blocked_users')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;

        // Clear and refill local cache for blocked users
        await db.blocked_users.where('user_id').equals(userId).delete();
        if (data && data.length > 0) {
            await db.blocked_users.bulkPut(data);
        }

        return data || [];
    } catch (error) {
        console.error('Error fetching blocked users:', error);
        throw error;
    }
};

/**
 * Report a user or message
 */
export const reportUser = async ({ reporterId, reportedId, reportType, reason, messageId = null }) => {
    try {
        const reportData = {
            reporter_id: reporterId,
            reported_id: reportedId,
            report_type: reportType,
            reason: reason,
            message_id: messageId,
            report_status: 'pending',
            created_at: new Date().toISOString()
        };

        // For reports, we don't necessarily need a local table since it's an admin action
        // but we queue it to ensure it goes through if offline.
        await addToSyncQueue('create_report', {
            payload: reportData
        });

        return { success: true };
    } catch (error) {
        console.error('Error reporting user:', error);
        throw error;
    }
};

export default {
    blockUser,
    unblockUser,
    fetchBlockedUsers,
    reportUser
};
