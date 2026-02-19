/**
 * Database schema type definitions
 * Provides TypeScript-like type checking for JavaScript
 */

// Base entity with common fields
export const BaseEntity = {
  id: 'string',
  created_at: 'string', // ISO timestamp
  updated_at: 'string', // ISO timestamp
};

// User entity
export const User = {
  ...BaseEntity,
  id: 'string',
  email: 'string',
  phone: 'string',
  name: 'string',
  avatar: 'string|null',
  is_admin: 'boolean',
  is_online: 'boolean',
  last_seen: 'string', // ISO timestamp
  emoji_style: 'string|null', // Added from database schema
};

// Message entity
export const Message = {
  ...BaseEntity,
  id: 'string',
  chat_id: 'string',
  sender_id: 'string',
  receiver_id: 'string',
  content: 'string',
  media_path: 'string|null',
  media_type: 'string|null', // 'image', 'video', 'audio', 'document'
  reply_to: 'string|null', // Message ID
  is_read: 'boolean',
  is_group_message: 'boolean',
  emoji_style: 'string|null', // Added from database schema
  status: 'string', // 'sending', 'sent', 'delivered', 'read'
};

// Chat entity
export const Chat = {
  ...BaseEntity,
  id: 'string',
  user1_id: 'string',
  user2_id: 'string',
  last_message: 'string|null',
  last_message_time: 'string|null', // ISO timestamp
};

// Group entity
export const Group = {
  ...BaseEntity,
  id: 'string',
  name: 'string',
  description: 'string|null',
  avatar_url: 'string|null',
  created_by: 'string',
};

// Group Member entity
export const GroupMember = {
  ...BaseEntity,
  id: 'string',
  group_id: 'string',
  user_id: 'string',
  role: 'string', // 'admin', 'moderator', 'member'
  joined_at: 'string', // ISO timestamp
};

// Call History entity
export const CallHistory = {
  ...BaseEntity,
  id: 'string',
  caller_id: 'string',
  receiver_id: 'string',
  call_id: 'string',
  call_type: 'string', // 'voice', 'video'
  call_status: 'string', // 'initiated', 'answered', 'ended', 'missed', 'rejected', 'failed'
  call_duration: 'number|null', // seconds
  started_at: 'string', // ISO timestamp
  answered_at: 'string|null', // ISO timestamp
  ended_at: 'string|null', // ISO timestamp
};

// Contact entity
export const Contact = {
  ...BaseEntity,
  id: 'string',
  user_id: 'string',
  contact_user_id: 'string',
  contact_name: 'string',
};

// Blocked User entity
export const BlockedUser = {
  ...BaseEntity,
  id: 'string',
  blocker_id: 'string',
  blocked_id: 'string',
};

// Reminder entity
export const Reminder = {
  ...BaseEntity,
  id: 'string',
  sender_id: 'string',
  receiver_id: 'string',
  message: 'string',
  reminder_time: 'string', // ISO timestamp
  is_completed: 'boolean',
};

// Support Message entity
export const SupportMessage = {
  ...BaseEntity,
  id: 'string',
  user_id: 'string',
  message: 'string',
  message_type: 'string', // 'user', 'admin'
  responded_by: 'string|null',
  response: 'string|null',
  responded_at: 'string|null', // ISO timestamp
};

// Report entity
export const Report = {
  ...BaseEntity,
  id: 'string',
  reporter_id: 'string',
  reported_id: 'string',
  reason: 'string',
  description: 'string',
  status: 'string', // 'pending', 'resolved', 'dismissed'
  admin_notes: 'string|null',
  resolved_at: 'string|null', // ISO timestamp
};

// Admin Log entity
export const AdminLog = {
  ...BaseEntity,
  id: 'string',
  admin_id: 'string',
  target_user_id: 'string|null',
  action: 'string',
  details: 'object',
  ip_address: 'string',
  user_agent: 'string',
};

// Message Read entity
export const MessageRead = {
  ...BaseEntity,
  id: 'string',
  message_id: 'string',
  user_id: 'string',
  read_at: 'string', // ISO timestamp
};

// Type validation functions
export const validateType = (value, expectedType, fieldName) => {
  if (value === null || value === undefined) {
    return expectedType.includes('null');
  }

  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      // Handle union types like 'string|null'
      if (expectedType.includes('|')) {
        const types = expectedType.split('|').map(t => t.trim());
        return types.some(type => validateType(value, type, fieldName));
      }
      return false;
  }
};

// Validate entity against schema
export const validateEntity = (entity, schema, entityName) => {
  const errors = [];
  
  for (const [fieldName, expectedType] of Object.entries(schema)) {
    if (!validateType(entity[fieldName], expectedType, fieldName)) {
      errors.push(`${entityName}.${fieldName}: Expected ${expectedType}, got ${typeof entity[fieldName]}`);
    }
  }
  
  return errors;
};

// Safe entity conversion with validation
export const safeEntityConvert = (data, schema, entityName) => {
  if (!data) return null;
  
  const errors = validateEntity(data, schema, entityName);
  if (errors.length > 0) {
    console.warn(`Validation errors for ${entityName}:`, errors);
    // In development, you might want to throw an error
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`Entity validation failed: ${errors.join(', ')}`);
    }
  }
  
  return data;
};
