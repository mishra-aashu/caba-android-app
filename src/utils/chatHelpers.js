/**
 * chatHelpers.js - Polymorphic Data Adapter for Unified Chat System
 * 
 * This module normalizes data from get_unified_chat_list RPC function
 * to provide a consistent interface for both Groups and 1-on-1 Chats.
 * 
 * The UI should use these normalized properties instead of conditional logic.
 */

import { isUserOnline } from './timeUtils';

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
export const normalizeChat = (rawChat) => {
  const isGroup = rawChat.chat_type === 'group';
  
  return {
    // Common ID - use chat_id for both
    id: rawChat.chat_id,
    
    // Type indicator - 'chat' or 'group'
    type: rawChat.chat_type,
    
    // Unified Display Properties (The UI only cares about these)
    displayName: isGroup 
      ? (rawChat.group_name || rawChat.other_user_name || 'Unnamed Group')
      : (rawChat.other_user_name || 'Unknown'),
    
    displayAvatar: isGroup 
      ? rawChat.group_avatar 
      : rawChat.other_user_avatar,
    
    displaySubtitle: rawChat.last_message || (isGroup ? "No messages yet" : ""),
    
    // Meta Data
    timestamp: rawChat.last_message_time,
    unreadCount: parseInt(rawChat.unread_count) || 0,
    isOnline: !isGroup && rawChat.other_user_online === true,
    lastSeen: !isGroup ? rawChat.other_user_last_seen : null,
    
    // Original Data (Keep for specific logic that needs raw data)
    metadata: {
      otherUserId: rawChat.other_user_id,
      otherUserName: rawChat.other_user_name,
      otherUserAvatar: rawChat.other_user_avatar,
      otherUserPhone: rawChat.other_user_phone,
      groupName: rawChat.group_name,
      groupAvatar: rawChat.group_avatar,
    },
    
    // Convenience flags
    isGroup,
    isChat: !isGroup,
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
export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // If today, show time
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // If yesterday, show "Yesterday"
  if (diffDays === 1) {
    return 'Yesterday';
  }
  
  // If this week, show day name
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  
  // Otherwise show date
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

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
  return chat.isGroup === true || chat.chatType === 'group' || chat.type === 'group';
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
