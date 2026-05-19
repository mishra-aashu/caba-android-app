/**
 * dataGateway.js - Centralized Data Adapter Service
 * 
 * This service acts as the single source for transforming database records
 * (snake_case) into frontend-friendly objects (camelCase). 
 * It ensures consistency across the app and prevents fragmented normalization logic.
 */

import { isUserOnline } from '../utils/dateFormatter';

/**
 * Normalizes a message object
 */
export const mapMessage = (msg) => {
  if (!msg) return null;
  return {
    ...msg,
    id: msg.id,
    chatId: String(msg.chat_id ?? msg.chatId ?? ''),
    senderId: msg.sender_id ?? msg.senderId,
    receiverId: msg.receiver_id ?? msg.receiverId,
    content: msg.content,
    mediaPath: msg.media_path ?? msg.mediaPath,
    mediaUrl: msg.media_url ?? msg.mediaUrl,
    mediaType: msg.media_type ?? msg.mediaType,
    messageType: msg.message_type ?? msg.messageType ?? 'text',
    createdAt: msg.created_at ?? msg.createdAt,
    updatedAt: msg.updated_at ?? msg.updatedAt,
    replyTo: msg.reply_to ?? msg.replyTo,
    vanishAt: msg.vanish_at ?? msg.vanishAt,
    seenAt: msg.seen_at ?? msg.seenAt,
    status: msg.status || 'read', // pending, sending, failed, read
    metadata: msg.metadata || {},
    isDeleted: msg.is_deleted ?? msg.isDeleted ?? false
  };
};

/**
 * Normalizes a chat/group object
 */
export const mapChat = (raw, currentUserId = null) => {
  if (!raw) return null;

  const chatType = raw.chat_type || raw.type || (raw.group_id ? 'group' : 'chat');
  const isGroup = chatType === 'group' || (raw.is_group === true);

  // ── Resolve Name ────────────────────────────────────────────
  // SECURITY: Phone numbers must NEVER be used as display name fallbacks.
  // If server returns no name, show a generic placeholder only.
  const rawName =
    raw.name ||
    raw.other_user_name ||
    raw.full_name ||
    raw.display_name ||
    raw.group_name ||
    raw.user_name ||
    (raw.other_user?.name || raw.other_user?.full_name);

  const idForFallback = raw.chat_id || raw.id || raw.group_id || 'unknown';

  // Generic fallback — no phone number, no partial ID exposure
  const finalName = rawName ||
    (isGroup ? 'Unnamed Group' : 'Unknown User');

  // ── Resolve Avatar ───────────────────────────────────────────
  const avatar =
    raw.avatar ||
    raw.other_user_avatar ||
    raw.avatar_url ||
    raw.profile_image ||
    raw.group_avatar ||
    (raw.other_user?.avatar || raw.other_user?.avatar_url || raw.other_user?.profile_image);

  // ── Unread Count ─────────────────────────────────────────────
  const unreadCount = parseInt(raw.unread_count || raw.unread_messages_count || 0) || 0;

  // ── Online Status ─────────────────────────────────────────────
  // Only compute for DMs, groups never have "online" status
  const isOnline = !isGroup && (
    raw.other_user_online === true ||
    raw.is_online === true ||
    raw.other_user?.is_online ||
    isUserOnline(
        Boolean(raw.is_online || raw.other_user_online || raw.other_user?.is_online),
        raw.last_seen || raw.other_user_last_seen || raw.other_user?.last_seen
    )
  );

  return {
    id: String(idForFallback),
    type: chatType,
    isGroup,
    name: finalName,
    avatar: avatar,
    lastMessage: raw.last_message || raw.last_message_content || (isGroup ? 'No messages yet' : ''),
    lastMessageAt: raw.last_message_at || raw.last_message_time || raw.created_at || raw.lastMessageAt,
    unreadCount,
    isOnline,
    lastSeen: raw.other_user_last_seen || raw.last_seen || raw.other_user?.last_seen,
    status: raw.status, // pending, failed, synced
    isVanishEnabled: raw.is_vanish_enabled || raw.isVanishEnabled || false,
    memberCount: raw.member_count || raw.memberCount || 0,
    // SECURITY: otherUserId stored only for routing (chat URL), never exposed in UI
    otherUserId: raw.other_user_id || raw.other_user?.id || null
  };
};

/**
 * Normalizes a user profile
 */
export const mapUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone || user.phone_number,
    name: user.name || user.full_name || user.display_name,
    avatar: user.avatar || user.avatar_url || user.profile_image,
    about: user.about || user.status_message,
    isOnline: Boolean(user.is_online ?? user.isOnline),
    lastSeen: user.last_seen ?? user.lastSeen,
    createdAt: user.created_at ?? user.createdAt,
    updatedAt: user.updated_at ?? user.updatedAt
  };
};


const dataGateway = {
  mapMessage,
  mapChat,
  mapUser
};

export default dataGateway;
