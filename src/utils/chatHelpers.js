/**
 * chatHelpers.js - Polymorphic Data Adapter for Unified Chat System
 * 
 * This module normalizes data from get_unified_chat_list RPC function
 * to provide a consistent interface for both Groups and 1-on-1 Chats.
 * 
 * The UI should use these normalized properties instead of conditional logic.
 */

import { formatTime } from './dateFormatter';
import { mapChat } from '../services/dataGateway';

/**
 * Normalize chat data from the RPC function or database
 * This function creates a unified data structure for both Groups and Chats
 */
export const normalizeChat = (rawChat, currentUserId = null) => {
  const mapped = mapChat(rawChat, currentUserId);
  if (!mapped) return null;
  
  // Maintain backward compatibility for properties expected by some components
  return {
    ...mapped,
    timestamp: mapped.lastMessageAt,
    isChat: !mapped.isGroup,
    metadata: {
        ...mapped.metadata,
        otherUserId: mapped.otherUserId
    }
  };
};

/**
 * Format chat for display in ChatListItem component
 */
export const formatChatForList = (chat, contactName = null) => {
  return {
    name: contactName || chat.name,
    avatar: chat.avatar,
    lastMessage: chat.lastMessage,
    time: formatTime(chat.lastMessageAt),
    unreadCount: chat.unreadCount,
    is_online: chat.isOnline,
    last_seen: chat.lastSeen,
    isGroup: chat.isGroup,
    isMyMessage: false,
    status: chat.status,
    type: 'text',
  };
};

/**
 * Get chat route path based on chat type
 */
export const getChatRoute = (chat) => {
  if (chat.isGroup) {
    return `/chat/${chat.id}/group`;
  }
  const otherId = chat.otherUserId || (chat.metadata && chat.metadata.otherUserId);
  return `/chat/${chat.id}/${otherId}`;
};

/**
 * Check if a chat is a group chat
 */
export const isGroupChat = (chat) => {
  if (!chat) return false;
  return chat.isGroup === true || chat.type === 'group';
};

/**
 * Truncate message text for preview
 */
export const truncateMessage = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export { formatTime };

export default {
  normalizeChat,
  formatChatForList,
  formatTime,
  getChatRoute,
  isGroupChat,
  truncateMessage,
};
