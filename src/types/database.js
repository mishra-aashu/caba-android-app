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
  emoji_style: 'string|null', // 'native', 'twitter', 'google'
  auth_provider: 'string', // 'phone', 'google'
  email_confirmed_at: 'string|null', // ISO timestamp
  auth_password: 'string|null',
  fcm_token_android: 'string|null',
  fcm_token_web: 'string|null',
  about: 'string|null',
  password: 'string|null',
};

// Message entity
export const Message = {
  ...BaseEntity,
  id: 'string',
  chat_id: 'string',
  sender_id: 'string',
  receiver_id: 'string|null',
  content: 'string',
  media_path: 'string|null',
  media_type: 'string|null', // 'image', 'video', 'audio', 'document', 'news_share'
  reply_to: 'string|null', // Message ID
  is_read: 'boolean',
  is_group_message: 'boolean',
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
  unread_count: 'number',
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

// Reminder entity (DB: title, description, status — no message/is_completed)
export const Reminder = {
  ...BaseEntity,
  id: 'string',
  sender_id: 'string',
  receiver_id: 'string',
  title: 'string',
  description: 'string|null',
  reminder_time: 'string',
  status: 'string', // pending, accepted, rejected, completed, snoozed, cancelled
};

// Support Message entity (DB: admin_response not response)
export const SupportMessage = {
  ...BaseEntity,
  id: 'string',
  user_id: 'string',
  message: 'string',
  message_type: 'string',
  responded_by: 'string|null',
  admin_response: 'string|null',
  responded_at: 'string|null',
};

// Report entity (DB: details not description; reviewed_at not resolved_at; no admin_notes)
export const Report = {
  ...BaseEntity,
  id: 'string',
  reporter_id: 'string',
  reported_id: 'string',
  reason: 'string', // spam, harassment, inappropriate, other
  details: 'string|null',
  status: 'string',
  reviewed_at: 'string|null',
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

// Call entity (from 'calls' table)
export const Call = {
  ...BaseEntity,
  id: 'string',
  caller_id: 'string',
  receiver_id: 'string',
  call_id: 'string',
  call_type: 'string', // 'voice', 'video'
  status: 'string', // 'initiated', 'ringing', 'answered', 'ended', 'missed', 'rejected', 'failed'
  started_at: 'string', // ISO timestamp
  answered_at: 'string|null', // ISO timestamp
  ended_at: 'string|null', // ISO timestamp
  duration: 'number',
  room_id: 'string|null',
  group_id: 'string|null',
  is_group_call: 'boolean',
  call_participants: 'array', // JSONB
  max_participants: 'number',
  host_id: 'string|null',
  call_settings: 'object', // JSONB
  recording_enabled: 'boolean',
  screen_sharing_enabled: 'boolean',
};

// Group Call Participant entity
export const GroupCallParticipant = {
  ...BaseEntity,
  id: 'string',
  call_id: 'string',
  user_id: 'string',
  joined_at: 'string', // ISO timestamp
  left_at: 'string|null', // ISO timestamp
  is_muted: 'boolean',
  is_video_enabled: 'boolean',
  is_screen_sharing: 'boolean',
  is_speaking: 'boolean',
  audio_level: 'number',
  participant_role: 'string', // 'host', 'moderator', 'participant'
  metadata: 'object', // JSONB
};

// Call Recording entity
export const CallRecording = {
  ...BaseEntity,
  id: 'string',
  call_id: 'string',
  recording_url: 'string',
  file_size: 'number',
  duration: 'number',
  recording_type: 'string', // 'audio', 'video', 'screen'
  thumbnail_url: 'string|null',
  is_processed: 'boolean',
  uploaded_at: 'string', // ISO timestamp
  expires_at: 'string|null', // ISO timestamp
  created_by: 'string',
};

// WebRTC Signal entity
export const WebRTCSignal = {
  ...BaseEntity,
  id: 'string',
  from_user_id: 'string',
  to_user_id: 'string',
  signal_type: 'string', // 'offer', 'answer', 'ice_candidate', 'call_end'
  signal_data: 'object', // JSONB
  room_id: 'string',
  is_processed: 'boolean',
  expires_at: 'string', // ISO timestamp
  group_id: 'string|null',
  call_id: 'string|null',
  broadcast_type: 'string', // 'direct', 'broadcast', 'room'
};

// Game Invitation entity
export const GameInvitation = {
  ...BaseEntity,
  id: 'string',
  chat_id: 'string',
  sender_id: 'string',
  receiver_id: 'string',
  game_type: 'string',
  status: 'string', // 'pending', 'accepted', 'rejected', 'completed'
  invitation_data: 'object', // JSONB
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
