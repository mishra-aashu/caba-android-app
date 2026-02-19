/**
 * Group Service - Supabase API calls for Group Chat functionality
 * Handles group creation, member management, and message operations
 */

import { supabase } from '../config/supabase';

/**
 * Create a new group
 * @param {Object} params - The parameters object
 * @param {string} params.name - Group name
 * @param {string} params.description - Group description (optional)
 * @param {File} params.avatarFile - Group avatar file (optional)
 * @param {string} params.createdBy - User ID of creator
 * @param {string[]} params.memberIds - Array of user IDs to add as members
 * @returns {Promise<Object>} - Created group object
 */
export const createGroup = async ({ name, description, avatarFile, avatarUrl: avatarUrlParam, createdBy, memberIds }) => {
  try {
    let avatarUrl = avatarUrlParam || null;

    // Skip avatar upload for now - can add later
    // The DP picker returns a URL directly, so we just use that

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

    // Step 2: Add all members (including creator)
    const allMembers = [...memberIds, createdBy];
    const memberRecords = allMembers.map((userId, index) => ({
      group_id: group.id,
      user_id: userId,
      role: index === allMembers.length - 1 ? 'admin' : 'member', // Creator is admin
      joined_at: new Date().toISOString(),
    }));

    const { error: membersError } = await supabase
      .from('group_members')
      .insert(memberRecords);

    if (membersError) throw membersError;

    // Step 3: Send system message about group creation (optional - don't fail if it doesn't work)
    try {
      const { error: systemMsgError } = await supabase
        .from('messages')
        .insert({
          chat_id: group.id,
          sender_id: createdBy,
          receiver_id: createdBy, // Use sender as dummy receiver for group messages
          content: `Group "${name}" was created`,
          is_group_message: true,
          message_type: 'system',
        });

      if (systemMsgError) console.warn('System message failed:', systemMsgError);
    } catch (e) {
      console.warn('System message skipped:', e);
    }

    return group;
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
};

/**
 * Get group details by ID
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} - Group object with member count
 */
export const getGroupById = async (groupId) => {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error) throw error;

    // Get member count
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
 * @param {string} groupId - Group ID
 * @returns {Promise<Array>} - Array of member objects with user details
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
      .order('role', { ascending: true }) // Admins first
      .order('user.name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting group members:', error);
    throw error;
  }
};

/**
 * Get user's role in a group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID
 * @returns {Promise<string>} - User's role ('admin' or 'member')
 */
export const getUserRole = async (groupId, userId) => {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data?.role || null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

/**
 * Add members to a group
 * @param {string} groupId - Group ID
 * @param {string[]} memberIds - Array of user IDs to add
 * @returns {Promise<void>}
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
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to remove
 * @returns {Promise<void>}
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
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to promote
 * @returns {Promise<void>}
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
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to demote
 * @returns {Promise<void>}
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
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID leaving
 * @returns {Promise<void>}
 */
export const leaveGroup = async (groupId, userId) => {
  try {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error leaving group:', error);
    throw error;
  }
};

/**
 * Update group details
 * @param {string} groupId - Group ID
 * @param {Object} updates - Fields to update (name, description, avatar_url)
 * @returns {Promise<void>}
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
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of groups user is member of
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
 * @param {string} groupId - Group ID
 * @param {number} limit - Number of messages to fetch
 * @returns {Promise<Array>} - Array of messages
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
 * @param {Object} params - Message parameters
 * @param {string} params.chatId - Group/Chat ID
 * @param {string} params.senderId - Sender user ID
 * @param {string} params.content - Message content
 * @param {string} params.mediaPath - Media file path (optional)
 * @param {string} params.mediaType - Media type (optional)
 * @param {boolean} params.isAnonymous - Send anonymously
 * @param {Date} params.unlockAt - Time capsule unlock time (optional)
 * @param {string} params.replyTo - Reply to message ID (optional)
 * @returns {Promise<Object>} - Created message
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
 * @param {string} groupId - Group ID
 * @param {string} senderId - User who took screenshot
 * @param {string} messageId - Message that was screenshotted
 * @returns {Promise<void>}
 */
export const reportScreenshot = async (groupId, senderId, messageId) => {
  try {
    // Get sender name
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', senderId)
      .single();

    const senderName = user?.name || 'Someone';

    // Insert system message about screenshot
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
    // Don't throw - this is a non-critical feature
  }
};

/**
 * Upload group avatar to Supabase Storage
 * @param {File} file - Image file
 * @param {string} groupId - Group ID for naming
 * @returns {Promise<string>} - Public URL of uploaded avatar
 */
export const uploadGroupAvatar = async (file, groupId) => {
  try {
    const fileName = `${groupId}_${Date.now()}.${file.name.split('.').pop()}`;

    const { data, error } = await supabase.storage
      .from('group-avatars')
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('group-avatars')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading group avatar:', error);
    throw error;
  }
};

/**
 * Check if user is admin of a group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>}
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
