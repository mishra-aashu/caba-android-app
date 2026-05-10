/**
 * Group Service - Supabase API calls for Group Chat functionality
 *
 * [FIX #8]  Deduplicate creator from memberIds to prevent duplicate group_members rows.
 * [FIX #9]  System message now includes receiver_id (creator as placeholder)
 *           to satisfy NOT NULL constraint / RLS policy.
 */

import { supabase } from '../config/supabase';
import { logUserActivity } from '../utils/activityLogger';
import { db, addToSyncQueue } from '../db/db';

/**
 * Create a new group (Local-First Pattern)
 */
export const createGroup = async ({ name, description, avatarUrl: avatarUrlParam, createdBy, memberIds }) => {
    try {
        const tempId = `tmp_${Date.now()}`;
        const avatarUrl = avatarUrlParam || null;

        // Step 1: Prepare local record
        const localGroup = {
            id: tempId,
            name,
            description: description || null,
            avatar_url: avatarUrl || null,
            created_by: createdBy,
            created_at: new Date().toISOString(),
            is_syncing: true, // UI indicator
            tempId,
        };

        // Step 2: Insert into local DB immediately
        await db.set('groups', localGroup);

        // [FIX #9] Ensure unified chat list view also sees the new group locally
        // This prevents the chat from "disappearing" until the next sync
        // [FIX #9] Ensure unified chat list view also sees the new group locally
        // This prevents the chat from "disappearing" until the next sync
        await db.set('chats_list', {
            id: tempId,
            name,
            avatar_url: avatarUrl,
            last_message: `You created group "${name}"`,
            last_message_time: new Date().toISOString(),
            is_group: true,
            tempId,
        });

        // Step 3: Add other members separately in Dexie (group_members table)
        // Note: db.group_members was missing from db.js version 4, check if we need to add it or just use groups table details
        // Existing db.js version 4 has 'groups: "id, name"'. 
        // We'll store members in a nested way if needed, or update Dexie schema later.

        // Step 4: Queue for Supabase sync
        await addToSyncQueue('create_group', {
            tempId,
            payload: {
                name,
                description,
                avatar_url: avatarUrl,
                created_by: createdBy,
                memberIds, // Include members in payload for the sync handler
            }
        });

        // Log activity locally
        logUserActivity(createdBy, 'create_group_local', { tempId, name });

        return localGroup;
    } catch (error) {
        console.error('Error in local-first group creation:', error);
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