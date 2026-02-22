/**
 * chatHelpers.js - Polymorphic Data Adapter for Unified Chat System
 * 
 * This module normalizes data from get_unified_chat_list RPC function
 * to provide a consistent interface for both Groups and 1-on-1 Chats.
 * 
 * The UI should use these normalized properties instead of conditional logic.
 */

import { isUserOnline, formatTime } from './timeUtils';

/**
 * Normalize chat data from the RPC function or database
 * This function creates a unified data structure for both Groups and Chats
 * 
 * @param {Object} rawChat - Raw chat data from database/RPC
 * @param {string} rawChat.chat_id - The chat/group ID
 * @param {string} rawChat.chat_type - 'chat' or 'group'
 * @param {string} rawChat.other_user_name - User's name (for 1-on-1) or group name (for groups)
 * @param {string} rawChat.other_user_avatar - User's avatar (for 1-on-1) or group avatar (for groups)
 * @param {string} rawChat.other_user_id - The other user's ID (null for groups)
 * @param {boolean} rawChat.other_user_online - Whether user is online (null for groups)
 * @param {string} rawChat.other_user_last_seen - Last seen timestamp
 * @param {string} rawChat.last_message - Last message content
 * @param {string} rawChat.last_message_time - Last message timestamp
 * @param {number} rawChat.unread_count - Unread message count
 * @param {string} rawChat.group_name - Group name (only for groups)
 * @param {string} rawChat.group_avatar - Group avatar URL (only for groups)
 * 
 * @returns {Object} Normalized chat object with unified properties
 */
export const normalizeChat = (rawChat, currentUserId = null) => {
  if (!rawChat) return null;

  // 1. Identify Type (support variants)
  const chatType = rawChat.chat_type || rawChat.type || (rawChat.group_id ? 'group' : 'chat');
  const isGroup = chatType === 'group' || (rawChat.is_group === true);

  // 2. Resolve Name with multiple fallbacks
  // Check common variants for user/group names
  const rawName =
    rawChat.name ||
    rawChat.other_user_name ||
    rawChat.full_name ||
    rawChat.display_name ||
    rawChat.group_name ||
    rawChat.user_name ||
    (rawChat.other_user && (rawChat.other_user.name || rawChat.other_user.full_name)) ||
    (rawChat.sender && rawChat.sender.name) ||
    (rawChat.receiver && rawChat.receiver.name);

  // Resolve ID for fallback display
  const idForFallback = rawChat.chat_id || rawChat.id || rawChat.group_id || 'unknown';

  // Final Name Resolution
  const finalName = rawName ||
    rawChat.other_user_phone ||
    rawChat.phone ||
    rawChat.phone_number ||
    ((rawChat.other_user && (rawChat.other_user.phone || rawChat.other_user.phone_number))) ||
    (isGroup ? 'Unnamed Group' : `User ${idForFallback.toString().slice(0, 4)}`);

  // 3. Resolve Avatar
  const avatar =
    rawChat.avatar ||
    rawChat.other_user_avatar ||
    rawChat.avatar_url ||
    rawChat.profile_image ||
    rawChat.group_avatar ||
    (rawChat.other_user && (rawChat.other_user.avatar || rawChat.other_user.avatar_url || rawChat.other_user.profile_image)) ||
    (rawChat.sender && rawChat.sender.avatar) ||
    (rawChat.receiver && rawChat.receiver.avatar);

  // 4. Last Message Info
  const lastMessageContent = rawChat.last_message || rawChat.last_message_content || (isGroup ? "No messages yet" : "");
  const lastMessageSenderId = rawChat.last_message_sender_id || rawChat.sender_id;
  const lastMessageSenderName = rawChat.last_message_sender_name || (rawChat.sender && rawChat.sender.name);
  const isMyMessage = lastMessageSenderId === currentUserId;

  // 5. Unread Count
  const unreadCount = parseInt(rawChat.unread_count || rawChat.unread_messages_count || 0) || 0;

  // 6. Online Status
  const isOnline = !isGroup && (
    rawChat.other_user_online === true ||
    rawChat.is_online === true ||
    (rawChat.other_user && rawChat.other_user.is_online) ||
    isUserOnline(Boolean(rawChat.is_online || rawChat.other_user_online || (rawChat.other_user && rawChat.other_user.is_online)),
      rawChat.last_seen || rawChat.other_user_last_seen || (rawChat.other_user && rawChat.other_user.last_seen))
  );

  // 7. Resolve Final ID strings for consistent comparison
  const normalizedChatId = idForFallback ? idForFallback.toString() : null;
  let otherUserId = rawChat.other_user_id || (rawChat.other_user && rawChat.other_user.id);

  // Root Cause Fix: If other_user_id is missing (common in some views/RPCs), 
  // derive it from user1_id/user2_id by excluding currentUserId
  if (!otherUserId && !isGroup && currentUserId) {
    if (rawChat.user1_id && rawChat.user1_id !== currentUserId) {
      otherUserId = rawChat.user1_id;
    } else if (rawChat.user2_id && rawChat.user2_id !== currentUserId) {
      otherUserId = rawChat.user2_id;
    }
  }

  const normalizedOtherUserId = otherUserId ? otherUserId.toString() : null;

  return {
    id: normalizedChatId,
    type: chatType,
    isGroup,
    isChat: !isGroup,

    // Core Display Properties
    name: finalName,
    avatar: avatar,
    lastMessage: lastMessageContent,
    timestamp: rawChat.last_message_time || rawChat.last_message_at || rawChat.created_at || rawChat.updated_at,
    unreadCount: unreadCount,

    // Last Message Metadata
    lastMessageSenderId,
    lastMessageSenderName,
    isMyMessage,

    // Status
    is_online: isOnline,
    last_seen: rawChat.other_user_last_seen || rawChat.last_seen || (rawChat.other_user && rawChat.other_user.last_seen),

    // Original Data for metadata lookups
    metadata: {
      otherUserId: normalizedOtherUserId,
      otherUserName: rawName,
      otherUserAvatar: avatar,
      otherUserPhone: rawChat.other_user_phone || rawChat.phone || rawChat.phone_number || (rawChat.other_user && rawChat.other_user.phone),
    },

    // Extras
    member_count: rawChat.member_count || 0,
    member_preview: rawChat.member_preview || [],
    is_vanish_enabled: rawChat.is_vanish_enabled || false,
  };
};


/**
 * Format chat for display in ChatListItem component
 * Transforms normalized data into the format expected by ChatListItem
 * 
 * @param {Object} chat - Normalized chat object from normalizeChat()
 * @returns {Object} Formatted chat for UI rendering
 */
export const formatChatForList = (chat, contactName = null) => {
  return {
    name: contactName || chat.displayName,
    avatar: chat.displayAvatar,
    lastMessage: chat.displaySubtitle,
    time: formatTime(chat.timestamp),
    unreadCount: chat.unreadCount,
    is_online: chat.isOnline,
    last_seen: chat.lastSeen,
    isGroup: chat.isGroup,
    isMyMessage: false,
    status: null,
    type: 'text',
  };
};

/**
 * Format timestamp for display
 * @param {string|Date} timestamp - Timestamp to format
 * @returns {string} Formatted time string
 */
// formatTime is now imported from timeUtils and re-exported
export { formatTime };

/**
 * Get chat route path based on chat type
 * 
 * @param {Object} chat - Normalized chat object
 * @returns {string} Route path
 */
export const getChatRoute = (chat) => {
  if (chat.isGroup) {
    return `/chat/${chat.id}/group`;
  }
  return `/chat/${chat.id}/${chat.metadata.otherUserId}`;
};

/**
 * Check if a chat is a group chat
 * 
 * @param {Object} chat - Chat object
 * @returns {boolean} True if group chat
 */
export const isGroupChat = (chat) => {
  if (!chat) return false;
  return chat.isGroup === true || chat.chatType === 'group' || chat.type === 'group' || chat.chat_type === 'group';
};

/**
 * Truncate message text for preview
 * 
 * @param {string} text - Message text
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateMessage = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export default {
  normalizeChat,
  formatChatForList,
  formatTime,
  getChatRoute,
  isGroupChat,
  truncateMessage,
};
