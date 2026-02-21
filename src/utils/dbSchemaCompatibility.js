/**
 * Database schema compatibility utilities
 * Handles missing columns and provides fallbacks
 */

/**
 * Filter out fields that don't exist in the database schema
 */
export const filterNonExistentFields = (data, tableName) => {
  if (!data || typeof data !== 'object') return data;

  // Define existing columns based on database_context.md and database_setup_safe.sql
  const existingColumns = {
    users: ['id', 'email', 'phone', 'name', 'avatar', 'password', 'is_admin', 'is_online', 'last_seen', 'emoji_style', 'login_time', 'token_hash', 'email_confirmed_at', 'phone_number', 'created_at', 'updated_at'],
    messages: ['id', 'chat_id', 'sender_id', 'receiver_id', 'content', 'message_type', 'media_url', 'media_path', 'media_type', 'reply_to', 'is_read', 'is_delivered', 'is_group_message', 'status', 'emoji_style', 'created_at', 'updated_at', 'vanish_at', 'is_vanished', 'vanish_duration_seconds', 'seen_at', 'is_viewed', 'duration', 'unlock_at', 'is_anonymous', 'anon_name', 'anon_avatar_url'],
    chats: ['id', 'user1_id', 'user2_id', 'last_message', 'last_message_time', 'unread_count', 'created_at', 'updated_at'],
    call_history: ['id', 'caller_id', 'receiver_id', 'call_id', 'call_type', 'call_status', 'call_duration', 'started_at', 'answered_at', 'ended_at', 'created_at', 'updated_at'],
    reminders: ['id', 'sender_id', 'receiver_id', 'message', 'title', 'description', 'reminder_time', 'location', 'category', 'priority', 'status', 'accepted_at', 'completed_at', 'is_completed', 'sound_enabled', 'vibration_enabled', 'is_recurring', 'recurring_type', 'requires_acceptance', 'snooze_until', 'snooze_count', 'created_at', 'updated_at'],
    contacts: ['id', 'user_id', 'contact_user_id', 'contact_name', 'created_at', 'updated_at'],
    blocked_users: ['id', 'blocker_id', 'blocked_id', 'created_at', 'updated_at'],
    reports: ['id', 'reporter_id', 'reported_id', 'reason', 'description', 'status', 'admin_notes', 'resolved_at', 'created_at', 'updated_at'],
    support_messages: ['id', 'user_id', 'message', 'message_type', 'is_read', 'responded_by', 'response', 'responded_at', 'created_at', 'updated_at'],
    admin_logs: ['id', 'admin_id', 'target_user_id', 'action', 'details', 'ip_address', 'user_agent', 'created_at', 'updated_at'],
    message_reads: ['id', 'message_id', 'user_id', 'read_at', 'created_at'],
    groups: ['id', 'name', 'description', 'avatar', 'avatar_url', 'created_by', 'created_at', 'updated_at'],
    group_members: ['id', 'group_id', 'user_id', 'role', 'joined_at', 'created_at'],
    game_invitations: ['id', 'chat_id', 'sender_id', 'receiver_id', 'game_type', 'invitation_data', 'status', 'created_at', 'updated_at'],
    temporary_chat_settings: ['id', 'chat_id', 'user_id', 'is_enabled', 'vanish_duration', 'auto_delete_media', 'created_at', 'updated_at'],
  };

  const columns = existingColumns[tableName];
  if (!columns) return data; // Unknown table, return as-is

  const filtered = {};
  Object.entries(data).forEach(([key, value]) => {
    if (columns.includes(key)) {
      filtered[key] = value;
    } else {
      console.warn(`Filtering out non-existent column '${key}' for table '${tableName}'`);
    }
  });

  return filtered;
};

/**
 * Add default values for required fields that might be missing
 */
export const addDefaultValues = (data, tableName) => {
  if (!data || typeof data !== 'object') return data;

  const defaults = {
    messages: {
      is_read: false,
      is_group_message: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    users: {
      is_admin: false,
      is_online: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    reminders: {
      is_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  const tableDefaults = defaults[tableName];
  if (!tableDefaults) return data;

  const withDefaults = { ...data };
  Object.entries(tableDefaults).forEach(([key, value]) => {
    if (withDefaults[key] === undefined || withDefaults[key] === null) {
      withDefaults[key] = value;
    }
  });

  return withDefaults;
};

/**
 * Prepare data for database operation (filter non-existent fields, add defaults)
 */
export const prepareDataForDB = (data, tableName) => {
  let prepared = filterNonExistentFields(data, tableName);
  prepared = addDefaultValues(prepared, tableName);
  return prepared;
};

/**
 * Handle database errors gracefully with specific messages for missing columns
 */
export const handleDatabaseError = (error, tableName) => {
  const errorMessage = error?.message || '';

  if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
    const columnMatch = errorMessage.match(/column "([^"]+)" of relation "([^"]+)"/);
    if (columnMatch) {
      const columnName = columnMatch[1];
      const relationName = columnMatch[2];
      console.warn(`Database schema mismatch: Column '${columnName}' does not exist in table '${relationName}'`);
      return {
        isSchemaError: true,
        columnName,
        tableName: relationName,
        message: `Database schema is missing column '${columnName}' in table '${relationName}'`
      };
    }
  }

  return {
    isSchemaError: false,
    message: errorMessage
  };
};
