/**
 * Activity Logging Utility
 * Logs user and admin actions to the database
 */
import { supabase } from './supabase';

/**
 * Log a user activity
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Action performed (e.g., 'login', 'create_group')
 * @param {Object} details - Additional details about the action
 */
export const logUserActivity = async (userId, action, details = {}) => {
    try {
        const { error } = await supabase
            .from('user_activity_logs')
            .insert({
                user_id: userId,
                action,
                details,
                created_at: new Date().toISOString()
            });

        if (error) console.error('Error logging user activity:', error);
    } catch (err) {
        console.error('Failed to log user activity:', err);
    }
};

/**
 * Log an admin action
 * @param {string} adminId - ID of the admin performing the action
 * @param {string} targetUserId - ID of the user affected by the action
 * @param {string} action - Action performed
 * @param {Object} details - Additional details
 */
export const logAdminAction = async (adminId, targetUserId, action, details = {}) => {
    try {
        const { error } = await supabase
            .from('admin_logs')
            .insert({
                admin_id: adminId,
                target_user_id: targetUserId,
                action,
                details,
                ip_address: null, // Could be gathered if needed
                user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
                created_at: new Date().toISOString()
            });

        if (error) console.error('Error logging admin action:', error);
    } catch (err) {
        console.error('Failed to log admin action:', err);
    }
};

export default {
    logUserActivity,
    logAdminAction
};
