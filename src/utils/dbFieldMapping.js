/**
 * Database field mapping utility
 * Handles conversion between snake_case (database) and camelCase (frontend)
 */

// Database column to frontend field mapping
export const DB_TO_FRONTEND_MAP = {
  // User fields
  'is_admin': 'isAdmin',
  'is_online': 'isOnline',
  'last_seen': 'lastSeen',
  'created_at': 'createdAt',
  'updated_at': 'updatedAt',
  'phone': 'phone',
  'phoneNumber': 'phone',
  'profile_image': 'profileImage',
  'emoji_style': 'emojiStyle',
  'preferred_emojis': 'preferredEmojis',
  'auth_provider': 'authProvider',
  'email_confirmed_at': 'emailConfirmedAt',
  'auth_password': 'authPassword',
  'fcm_token_android': 'fcmTokenAndroid',
  'fcm_token_web': 'fcmTokenWeb',

  // Message fields
  'sender_id': 'senderId',
  'receiver_id': 'receiverId',
  'chat_id': 'chatId',
  'media_path': 'mediaPath',
  'media_url': 'mediaUrl',
  'media_type': 'mediaType',
  'reply_to': 'replyTo',
  'is_read': 'isRead',
  'avatar_url': 'avatarUrl',
  'is_group_message': 'isGroupMessage',
  'status': 'status',
  'is_edited': 'isEdited',
  'vanish_at': 'vanishAt',
  'client_id': 'clientId',

  // Call fields
  'caller_id': 'callerId',
  'call_id': 'callId',
  'call_type': 'callType',
  'call_status': 'callStatus',
  'call_duration': 'callDuration',
  'started_at': 'startedAt',
  'ended_at': 'endedAt',
  'answered_at': 'answeredAt',
  'room_id': 'roomId',
  'group_id': 'groupId',
  'is_group_call': 'isGroupCall',
  'call_participants': 'callParticipants',
  'max_participants': 'maxParticipants',
  'host_id': 'hostId',
  'call_settings': 'callSettings',
  'recording_enabled': 'recordingEnabled',
  'screen_sharing_enabled': 'screenSharingEnabled',

  // Chat fields
  'user1_id': 'user1Id',
  'user2_id': 'user2Id',
  'last_message': 'lastMessage',
  'last_message_time': 'lastMessageTime',
  'unread_count': 'unreadCount',

  // Group fields
  'created_by': 'createdBy',
  'group_id': 'groupId',
  'avatar_url': 'avatarUrl',
  'member_count': 'memberCount',

  // Contact fields
  'contact_user_id': 'contactUserId',
  'contact_name': 'contactName',

  // Reminder fields
  'reminder_time': 'reminderTime',
  'is_completed': 'isCompleted',
  'accepted_at': 'acceptedAt',
  'snooze_until': 'snoozeUntil',
  'snooze_count': 'snoozeCount',
  'is_recurring': 'isRecurring',
  'recurring_type': 'recurringType',
  'priority': 'priority',
  'category': 'category',
  'location': 'location',
  'description': 'description',

  // Support Message fields (DB: admin_response)
  'message_type': 'messageType',
  'responded_by': 'respondedBy',
  'responded_at': 'respondedAt',
  'admin_response': 'adminResponse',

  'report_type': 'reportType',
  'reporter_id': 'reporterId',
  'reported_id': 'reportedId',
  'admin_notes': 'adminNotes',
  'resolved_at': 'resolvedAt',
  'report_status': 'reportStatus',

  // Admin Log fields
  'admin_id': 'adminId',
  'target_user_id': 'targetUserId',
  'ip_address': 'ipAddress',
  'user_agent': 'userAgent',

  // Message Read fields
  'message_id': 'messageId',
  'read_at': 'readAt',

  // Group Call Participants fields
  'joined_at': 'joinedAt',
  'left_at': 'leftAt',
  'is_muted': 'isMuted',
  'is_video_enabled': 'isVideoEnabled',
  'is_screen_sharing': 'isScreenSharing',
  'is_speaking': 'isSpeaking',
  'audio_level': 'audioLevel',
  'participant_role': 'participantRole',

  // Call Recordings fields
  'recording_url': 'recordingUrl',
  'file_size': 'fileSize',
  'duration': 'duration',
  'recording_type': 'recordingType',
  'thumbnail_url': 'thumbnailUrl',
  'is_processed': 'isProcessed',
  'uploaded_at': 'uploadedAt',
  'expires_at': 'expiresAt',
  'created_by': 'createdBy',

  // WebRTC Signals fields
  'from_user_id': 'fromUserId',
  'to_user_id': 'toUserId',
  'signal_type': 'signalType',
  'signal_data': 'signalData',
  'is_processed': 'isProcessed',
  'broadcast_type': 'broadcastType',

  // Game Invitations fields
  'invitation_data': 'invitationData',
  'game_type': 'gameType',

  // Custom Admin fields
  'message_count': 'messageCount',

  // Common fields
  'user_id': 'userId'
};

// Frontend field to database column mapping (reverse of above)
export const FRONTEND_TO_DB_MAP = Object.fromEntries(
  Object.entries(DB_TO_FRONTEND_MAP).map(([key, value]) => [value, key])
);

/**
 * Convert database field names to frontend field names
 * @param {Object} dbObject - Object with database field names
 * @returns {Object} Object with frontend field names
 */
export const dbToFrontend = (dbObject) => {
  if (!dbObject || typeof dbObject !== 'object') return dbObject;

  const converted = {};
  for (const [dbKey, value] of Object.entries(dbObject)) {
    const frontendKey = DB_TO_FRONTEND_MAP[dbKey] || dbKey;
    converted[frontendKey] = value;
  }
  return converted;
};

/**
 * Convert frontend field names to database field names
 * @param {Object} frontendObject - Object with frontend field names
 * @returns {Object} Object with database field names
 */
export const frontendToDb = (frontendObject) => {
  if (!frontendObject || typeof frontendObject !== 'object') return frontendObject;

  const converted = {};
  for (const [frontendKey, value] of Object.entries(frontendObject)) {
    const dbKey = FRONTEND_TO_DB_MAP[frontendKey] || frontendKey;
    converted[dbKey] = value;
  }
  return converted;
};

/**
 * Convert a single field name from database to frontend format
 * @param {string} dbField - Database field name
 * @returns {string} Frontend field name
 */
export const convertDbField = (dbField) => {
  return DB_TO_FRONTEND_MAP[dbField] || dbField;
};

/**
 * Convert a single field name from frontend to database format
 * @param {string} frontendField - Frontend field name
 * @returns {string} Database field name
 */
export const convertFrontendField = (frontendField) => {
  return FRONTEND_TO_DB_MAP[frontendField] || frontendField;
};

/**
 * Safe database query result conversion
 * Ensures all nested objects are also converted
 * @param {Array|Object} data - Database result
 * @returns {Array|Object} Converted data with frontend field names
 */
export const safeDbConversion = (data) => {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    return data.map(item => safeDbConversion(item));
  } else if (data && typeof data === 'object') {
    const converted = dbToFrontend(data);
    // Convert all values: if they are objects or arrays, convert them too
    for (const [key, value] of Object.entries(converted)) {
      if (value && typeof value === 'object') {
        // Special case for Supabase count joins which are often [ { count: 123 } ] or { count: 123 }
        if (Array.isArray(value) && value.length === 1 && value[0]?.count !== undefined) {
          converted[key] = value[0].count;
        } else {
          converted[key] = safeDbConversion(value);
        }
      }
    }
    return converted;
  }
  return data;
};
