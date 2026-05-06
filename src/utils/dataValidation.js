/**
 * Data validation and type coercion utilities
 * Ensures frontend data matches database expectations
 */

import { DB_TO_FRONTEND_MAP } from './dbFieldMapping';

/**
 * Coerce data types to match database schema
 */
export const coerceDataTypes = (data, tableName) => {
  if (!data || typeof data !== 'object') return data;

  const coerced = { ...data };

  switch (tableName) {
    case 'messages':
      // Ensure specific numeric fields are numbers
      if (coerced.duration !== undefined) {
        coerced.duration = parseInt(coerced.duration) || null;
      }
      break;

    case 'chats':
      // Ensure unreadCount is always a number (Mapped from unread_count)
      if (coerced.unreadCount !== undefined) {
        coerced.unreadCount = parseInt(coerced.unreadCount) || 0;
      }
      break;

    case 'call_history':
      // Ensure callDuration is a number (Mapped from call_duration)
      if (coerced.callDuration !== undefined) {
        coerced.callDuration = parseInt(coerced.callDuration) || null;
      }
      break;

    case 'users':
      // Ensure boolean fields are actually boolean
      if (coerced.isAdmin !== undefined) {
        coerced.isAdmin = Boolean(coerced.isAdmin);
      }
      if (coerced.isOnline !== undefined) {
        coerced.isOnline = Boolean(coerced.isOnline);
      }
      break;

    case 'reminders':
      // Ensure boolean fields
      if (coerced.isCompleted !== undefined) {
        coerced.isCompleted = Boolean(coerced.isCompleted);
      }
      if (coerced.snoozeCount !== undefined) {
        coerced.snoozeCount = parseInt(coerced.snoozeCount) || 0;
      }
      break;
  }

  return coerced;
};

/**
 * Validate required fields before database operations
 */
export const validateRequiredFields = (data, tableName) => {
  const errors = [];

  const requiredFields = {
    messages: ['chat_id', 'sender_id', 'content'],
    users: ['id', 'name'],
    chats: ['user1_id', 'user2_id'],
    call_history: ['caller_id', 'receiver_id', 'call_id'],
    reminders: ['sender_id', 'receiver_id', 'title', 'reminder_time'],
    contacts: ['user_id', 'contact_user_id'],
    blocked_users: ['blocker_id', 'blocked_id'],
    reports: ['reporter_id', 'reported_id', 'reason'],
    support_messages: ['user_id', 'message', 'message_type'],
  };

  const fields = requiredFields[tableName];
  if (fields) {
    fields.forEach(field => {
      if (!data[field] || data[field] === '' || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    });
  }

  return errors;
};

/**
 * Sanitize data before sending to database
 */
export const sanitizeDataForDB = (data, tableName) => {
  const sanitized = { ...data };
  
  // Remove fields that don't exist in database
  const frontendOnlyFields = [
    'isOwn', 'isRead', 'timestamp', 'formattedTime', 
    'otherUser', 'sender', 'receiver', 'read_by'
  ];
  
  frontendOnlyFields.forEach(field => {
    delete sanitized[field];
  });

  // Coerce data types
  return coerceDataTypes(sanitized, tableName);
};

/**
 * Validate and sanitize data before database operation
 */
export const validateAndSanitize = (data, tableName) => {
  const errors = validateRequiredFields(data, tableName);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return sanitizeDataForDB(data, tableName);
};
