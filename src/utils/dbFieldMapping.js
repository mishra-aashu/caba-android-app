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
  'phone_number': 'phoneNumber',
  'profile_image': 'profileImage',
  'emoji_style': 'emojiStyle',

  // Message fields
  'sender_id': 'senderId',
  'receiver_id': 'receiverId',
  'chat_id': 'chatId',
  'media_path': 'mediaPath',
  'media_type': 'mediaType',
  'reply_to': 'replyTo',
  'is_read': 'isRead',
  'is_group_message': 'isGroupMessage',
  'status': 'status',

  // Call fields
  'caller_id': 'callerId',
  'call_id': 'callId',
  'call_type': 'callType',
  'call_status': 'callStatus',
  'call_duration': 'callDuration',
  'started_at': 'startedAt',
  'ended_at': 'endedAt',
  'answered_at': 'answeredAt',

  // Chat fields
  'user1_id': 'user1Id',
  'user2_id': 'user2Id',
  'last_message': 'lastMessage',
  'last_message_time': 'lastMessageTime',

  // Group fields
  'created_by': 'createdBy',
  'group_id': 'groupId',

  // Contact fields
  'contact_user_id': 'contactUserId',
  'contact_name': 'contactName',

  // Reminder fields
  'reminder_time': 'reminderTime',
  'is_completed': 'isCompleted',
  'accepted_at': 'acceptedAt',

  // Support Message fields
  'message_type': 'messageType',
  'responded_by': 'respondedBy',
  'responded_at': 'respondedAt',

  // Report fields
  'reporter_id': 'reporterId',
  'reported_id': 'reportedId',
  'admin_notes': 'adminNotes',
  'resolved_at': 'resolvedAt',

  // Admin Log fields
  'admin_id': 'adminId',
  'target_user_id': 'targetUserId',
  'ip_address': 'ipAddress',
  'user_agent': 'userAgent',

  // Message Read fields
  'message_id': 'messageId',
  'read_at': 'readAt',

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
  if (Array.isArray(data)) {
    return data.map(item => {
      const converted = dbToFrontend(item);
      // Convert nested objects too
      if (item.sender) converted.sender = dbToFrontend(item.sender);
      if (item.receiver) converted.receiver = dbToFrontend(item.receiver);
      if (item.other_user) converted.otherUser = dbToFrontend(item.other_user);
      return converted;
    });
  } else if (data && typeof data === 'object') {
    const converted = dbToFrontend(data);
    // Convert nested objects
    if (data.sender) converted.sender = dbToFrontend(data.sender);
    if (data.receiver) converted.receiver = dbToFrontend(data.receiver);
    if (data.other_user) converted.otherUser = dbToFrontend(data.other_user);
    return converted;
  }
  return data;
};
