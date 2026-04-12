/**
 * Group Service - Supabase API calls for Group Chat functionality
 *
 * [FIX #8]  Deduplicate creator from memberIds to prevent duplicate group_members rows.
 * [FIX #9]  System message now includes receiver_id (creator as placeholder)
 *           to satisfy NOT NULL constraint / RLS policy.
 */

import { supabase } from '../config/supabase';
import { logUserActivity } from '../utils/activityLogger';

/**
 * Create a new group
 */
export const createGroup = async ({ name, description, avatarFile, avatarUrl: avatarUrlParam, createdBy, memberIds }) => {
    try {
        let avatarUrl = avatarUrlParam || null;

        // Step 1: Insert group into groups table
        console.log('Creating group with:', { name, description, avatarUrl, createdBy });

        const { data: group, error: groupError } = await supabase
            .from('groups')
            .insert({
                name,
                description: description || null,
                avatar_url: avatarUrl || null,
                created_by: createdBy,
            })
            .select()
            .single();

        if (groupError) {
            console.error('Group insert error:', groupError);
            throw groupError;
        }

        console.log('Group created:', group);

        // Step 2: Add creator as admin first (Deduplicated)
        const { error: creatorError } = await supabase
            .from('group_members')
            .insert({
                group_id: group.id,
                user_id: createdBy,
                role: 'admin',
                joined_at: new Date().toISOString(),
            });

        if (creatorError) {
            console.error('Error adding creator to group:', creatorError);
            throw creatorError;
        }

        // Step 3: Add other members separately
        const otherMemberIds = memberIds.filter(id => id !== createdBy);
        if (otherMemberIds.length > 0) {
            const memberRecords = otherMemberIds.map((userId) => ({
                group_id: group.id,
                user_id: userId,
                role: 'member',
                joined_at: new Date().toISOString(),
            }));

            const { error: membersError } = await supabase
                .from('group_members')
                .insert(memberRecords);

            if (membersError) {
                console.error('Error adding other members:', membersError);
                // We don't necessarily want to fail group creation if only participants fail, 
                // but for consistency with the original code, we throw.
                throw membersError;
            }
        }

        // [FIX #9] Step 3: System message with receiver_id set
        try {
            const { error: systemMsgError } = await supabase
                .from('messages')
                .insert({
                    chat_id: group.id,
                    sender_id: createdBy,
                    receiver_id: createdBy, // FIX: Use creator as placeholder — consistent with sendGroupMessage
                    content: `Group "${name}" was created`,
                    is_group_message: true,
                    message_type: 'system',
                });

            if (systemMsgError) console.warn('System message failed:', systemMsgError);
        } catch (e) {
            console.warn('System message skipped:', e);
        }

        // Log activity
        logUserActivity(createdBy, 'create_group', { group_id: group.id, name });

        return group;
    } catch (error) {
        console.error('Error creating group:', error);
        throw error;
    }
};

/**
 * Get group details by ID
 */
export const getGroupById = async (groupId) => {
    try {
        const { data, error } = await supabase
            .from('groups')
            .select(`
                *,
                creator:users!groups_created_by_fkey (
                    id,
                    name
                )
            `)
            .eq('id', groupId)
            .maybeSingle();

        if (error) throw error;

        const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', groupId);

        return { ...data, member_count: count };
    } catch (error) {
        console.error('Error getting group:', error);
        throw error;
    }
};

/**
 * Get all members of a group
 */
export const getGroupMembers = async (groupId) => {
    try {
        const { data, error } = await supabase
            .from('group_members')
            .select(`
                *,
                users (
                    id,
                    name,
                    avatar,
                    phone,
                    is_online,
                    last_seen
                )
            `)
            .eq('group_id', groupId)
            .order('role', { ascending: true })
            .order('name', { referencedTable: 'users', ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting group members:', error);
        throw error;
    }
};

/**
 * Get user's role in a group
 */
export const getUserRole = async (groupId, userId) => {
    try {
        const { data, error } = await supabase
            .from('group_members')
            .select('role')
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return data?.role || null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
};

/**
 * Add members to a group
 */
export const addGroupMembers = async (groupId, memberIds) => {
    try {
        const memberRecords = memberIds.map((userId) => ({
            group_id: groupId,
            user_id: userId,
            role: 'member',
            joined_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('group_members')
            .insert(memberRecords);

        if (error) throw error;
    } catch (error) {
        console.error('Error adding members:', error);
        throw error;
    }
};

/**
 * Remove a member from a group
 */
export const removeGroupMember = async (groupId, userId) => {
    try {
        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', userId);

        if (error) throw error;
    } catch (error) {
        console.error('Error removing member:', error);
        throw error;
    }
};

/**
 * Promote a member to admin
 */
export const makeAdmin = async (groupId, userId) => {
    try {
        const { error } = await supabase
            .from('group_members')
            .update({ role: 'admin' })
            .eq('group_id', groupId)
            .eq('user_id', userId);

        if (error) throw error;
    } catch (error) {
        console.error('Error making admin:', error);
        throw error;
    }
};

/**
 * Demote an admin to member
 */
export const demoteAdmin = async (groupId, userId) => {
    try {
        const { error } = await supabase
            .from('group_members')
            .update({ role: 'member' })
            .eq('group_id', groupId)
            .eq('user_id', userId);

        if (error) throw error;
    } catch (error) {
        console.error('Error demoting admin:', error);
        throw error;
    }
};

/**
 * Leave a group
 */
export const leaveGroup = async (groupId, userId) => {
    try {
        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', userId);

        if (error) throw error;

        logUserActivity(userId, 'leave_group', { group_id: groupId });
    } catch (error) {
        console.error('Error leaving group:', error);
        throw error;
    }
};

/**
 * Update group details
 */
export const updateGroup = async (groupId, updates) => {
    try {
        const { error } = await supabase
            .from('groups')
            .update(updates)
            .eq('id', groupId);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating group:', error);
        throw error;
    }
};

/**
 * Get user's groups
 */
export const getUserGroups = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('group_members')
            .select(`
                *,
                group:group_id (
                    id,
                    name,
                    avatar_url,
                    description,
                    created_by,
                    created_at
                )
            `)
            .eq('user_id', userId);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting user groups:', error);
        throw error;
    }
};

/**
 * Fetch group messages
 */
export const fetchGroupMessages = async (groupId, limit = 50) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                sender:sender_id (
                    id,
                    name,
                    avatar,
                    is_online,
                    last_seen
                )
            `)
            .eq('chat_id', groupId)
            .eq('is_group_message', true)
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching group messages:', error);
        throw error;
    }
};

/**
 * Send a group message with optional special features
 */
export const sendGroupMessage = async ({
    chatId,
    senderId,
    content,
    mediaPath = null,
    mediaType = null,
    isAnonymous = false,
    unlockAt = null,
    replyTo = null,
}) => {
    try {
        const messageData = {
            chat_id: chatId,
            sender_id: senderId,
            receiver_id: senderId, // Required field - use sender as placeholder for groups
            content,
            is_group_message: true,
            is_anonymous: isAnonymous,
            unlock_at: unlockAt ? unlockAt.toISOString() : null,
            media_path: mediaPath,
            media_type: mediaType,
            reply_to: replyTo,
        };

        const { data, error } = await supabase
            .from('messages')
            .insert(messageData)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error sending group message:', error);
        throw error;
    }
};

/**
 * Report screenshot in group
 */
export const reportScreenshot = async (groupId, senderId, messageId) => {
    try {
        const { data: user } = await supabase
            .from('users')
            .select('name')
            .eq('id', senderId)
            .single();

        const senderName = user?.name || 'Someone';

        await supabase
            .from('messages')
            .insert({
                chat_id: groupId,
                sender_id: senderId,
                receiver_id: senderId, // Required field
                content: `📸 ${senderName} took a screenshot!`,
                is_group_message: true,
                message_type: 'system',
            });
    } catch (error) {
        console.error('Error reporting screenshot:', error);
    }
};

/**
 * Upload group avatar to Supabase Storage
 */
export const uploadGroupAvatar = async (file, groupId, userId) => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/avatars/${groupId}_${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('media')
            .upload(fileName, file, {
                upsert: true,
                contentType: file.type,
            });

        if (error) throw error;

        const { data: urlData } = supabase.storage
            .from('media')
            .getPublicUrl(fileName);

        return urlData.publicUrl;
    } catch (error) {
        console.error('Error uploading group avatar:', error);
        throw error;
    }
};

/**
 * Check if user is admin of a group
 */
export const isUserAdmin = async (groupId, userId) => {
    try {
        const role = await getUserRole(groupId, userId);
        return role === 'admin';
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
};

export default {
    createGroup,
    getGroupById,
    getGroupMembers,
    getUserRole,
    addGroupMembers,
    removeGroupMember,
    makeAdmin,
    demoteAdmin,
    leaveGroup,
    updateGroup,
    getUserGroups,
    fetchGroupMessages,
    sendGroupMessage,
    reportScreenshot,
    uploadGroupAvatar,
    isUserAdmin,
};