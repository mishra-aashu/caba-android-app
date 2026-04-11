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
  message_type: 'string|null', // 'text', 'image', 'video', 'audio', 'document', 'news_share'
  media_url: 'string|null',
  media_path: 'string|null',
  media_type: 'string|null',
  reply_to: 'string|null', // Message ID
  is_read: 'boolean',
  is_delivered: 'boolean',
  is_group_message: 'boolean',
  status: 'string', // 'sending', 'sent', 'delivered', 'read'
  emoji_style: 'string|null',
  vanish_at: 'string|null', // ISO timestamp
  is_vanished: 'boolean',
  vanish_duration_seconds: 'number|null',
  seen_at: 'string|null', // ISO timestamp
  is_viewed: 'boolean',
  duration: 'number|null',
  unlock_at: 'string|null', // ISO timestamp
  is_anonymous: 'boolean',
  anon_name: 'string|null',
  anon_avatar_url: 'string|null',
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
  avatar: 'string|null',
  avatar_url: 'string|null',
  created_by: 'string',
  last_message: 'string|null',
  last_message_time: 'string|null', // ISO timestamp
  admins_only_edit_info: 'boolean',
  admins_only_add_members: 'boolean',
  admins_only_messages: 'boolean',
  is_anonymous_mode: 'boolean',
  anon_session_id: 'string|null',
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
  is_favorite: 'boolean',
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
  title: 'string',
  description: 'string|null',
  reminder_time: 'string', // ISO timestamp
  location: 'string|null',
  category: 'string|null',
  priority: 'string|null', // 'low', 'medium', 'high'
  status: 'string', // pending, accepted, rejected, completed, snoozed, cancelled
  accepted_at: 'string|null', // ISO timestamp
  completed_at: 'string|null', // ISO timestamp
  sound_enabled: 'boolean',
  vibration_enabled: 'boolean',
  is_recurring: 'boolean',
  recurring_type: 'string|null', // 'daily', 'weekly', 'monthly'
  requires_acceptance: 'boolean',
  snooze_until: 'string|null', // ISO timestamp
  snooze_count: 'number',
};

// Support Message entity
export const SupportMessage = {
  ...BaseEntity,
  id: 'string',
  user_id: 'string',
  message: 'string',
  message_type: 'string',
  is_read: 'boolean',
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
  invitation_message: 'string|null',
  status: 'string', // 'pending', 'accepted', 'rejected', 'completed'
  invitation_data: 'object', // JSONB
};

// User Session entity
export const UserSession = {
  ...BaseEntity,
  id: 'string',
  user_id: 'string',
  caba_session_id: 'string',
  device_name: 'string',
  device_type: 'string',
  device_icon: 'string|null',
  browser: 'string|null',
  os: 'string|null',
  app_version: 'string|null',
  ota_version: 'string|null',
  ip_address: 'string|null',
  city: 'string|null',
  country: 'string|null',
  country_flag: 'string|null',
  is_online: 'boolean',
  is_current: 'boolean',
  last_active: 'string', // ISO timestamp
  login_method: 'string',
  ota_updated_at: 'string|null', // ISO timestamp
};

// Login History entity
export const LoginHistory = {
  ...BaseEntity,
  id: 'string',
  user_id: 'string',
  device_name: 'string|null',
  device_type: 'string|null',
  ip_address: 'string|null',
  city: 'string|null',
  country: 'string|null',
  country_flag: 'string|null',
  login_method: 'string|null',
  action: 'string', // 'login', 'revoked', etc.
};

// News Article entity
export const NewsArticle = {
  ...BaseEntity,
  id: 'string',
  title: 'string',
  content: 'string',
  image_url: 'string|null',
  category: 'string|null',
  status: 'string', // 'draft', 'published'
};

// Status entity
export const Status = {
  ...BaseEntity,
  id: 'string',
  user_id: 'string',
  content: 'string|null',
  media_url: 'string|null',
  media_type: 'string|null',
  expires_at: 'string', // ISO timestamp
};

// Media Transfer entity
export const MediaTransfer = {
  ...BaseEntity,
  id: 'string',
  sender_id: 'string',
  receiver_id: 'string',
  file_name: 'string',
  file_size: 'number',
  file_type: 'string',
  status: 'string',
};

// App Version entity
export const AppVersion = {
  ...BaseEntity,
  id: 'string',
  latest_version: 'string',
  min_required_version: 'string',
  native_hash: 'string|null',
  apk_download_url: 'string|null',
  release_notes: 'string|null',
};

// System Setting entity
export const SystemSetting = {
  ...BaseEntity,
  id: 'string',
  key: 'string',
  value: 'string', // JSON stringified
  updated_by: 'string|null',
};

// Temporary Chat Settings entity
export const TemporaryChatSettings = {
  ...BaseEntity,
  id: 'string',
  chat_id: 'string',
  user_id: 'string',
  is_enabled: 'boolean',
  vanish_duration: 'string|null',
  vanish_duration_seconds: 'number|null',
  custom_duration: 'number|null',
  auto_delete_media: 'boolean',
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
