/**
 * Support Service - Handles user support inquiries
 */

import { supabase } from '../config/supabase';
import { db, addToSyncQueue } from '../db/db';

/**
 * Send a support message
 */
export const sendSupportMessage = async (userId, message) => {
    try {
        const tempId = `support_${Date.now()}`;
        
        // Queue for sync
        await addToSyncQueue('send_support_message', {
            tempId,
            payload: {
                user_id: userId,
                message: message,
                created_at: new Date().toISOString()
            }
        });

        // We don't necessarily store support messages in Dexie 
        // unless there's a specific Support UI. 
        // If there is, we would add to db.support_messages here.

        return { success: true, tempId };
    } catch (error) {
        console.error('Error sending support message:', error);
        throw error;
    }
};

/**
 * Fetch user's support history
 */
export const getSupportHistory = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('support_messages')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching support history:', error);
        throw error;
    }
};

export default {
    sendSupportMessage,
    getSupportHistory
};
