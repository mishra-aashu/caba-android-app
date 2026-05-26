import { getDatabase } from '../db/DatabaseFactory';
import { supabase } from '../config/supabase';
import { addDbBreadcrumb } from '../config/sentry';
import { uuid } from '../utils/idGenerators';

/**
 * Bulletproof Offline Queue (The Muscles)
 * Handles all mutations with Idempotency, Backoff, and Dependencies.
 */

export const QUEUE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  WAITING: 'waiting', // Waiting for a dependency
};

export const QUEUE_ACTIONS = {
  INSERT_MESSAGE: 'insert_message',
  UPDATE_MESSAGE: 'update_message',
  DELETE_MESSAGE: 'delete_message',
  UPDATE_PROFILE: 'update_profile',
  CREATE_GROUP: 'create_group',
  ADD_GROUP_MEMBER: 'add_group_member',
  MARK_READ: 'mark_read',
  SEND_SIGNAL: 'send_signal',
  UPDATE_PRESENCE: 'update_presence',
  TOGGLE_MUSIC_LIKE: 'toggle_music_like',
  CREATE_REMINDER: 'create_reminder',
  UPDATE_REMINDER: 'update_reminder',
  DELETE_REMINDER: 'delete_reminder',
  REMINDER_ACTION: 'reminder_action', // Accept, Reject, Complete, Snooze
};

/**
 * Add action to offline queue with Idempotency Key
 */
export const queueAction = async (action, table, data, options = {}) => {
  const taskId = options.taskId || uuid();
  
  const queueItem = {
    id: taskId, // This is our Idempotency Key
    action,
    table,
    data,
    status: QUEUE_STATUS.PENDING,
    retries: 0,
    maxRetries: options.maxRetries || 8,
    lastRetryAt: null,
    nextRetryAt: Date.now(),
    dependencyId: options.dependencyId || null,
    createdAt: Date.now(),
    scheduledAt: options.scheduledAt || null,
    metadata: options.metadata || {},
  };

  try {
    const db = await getDatabase();
    // Check for existing task with same ID (Idempotency check)
    const existing = await db.get('sync_queue', taskId);
    if (existing) {
      console.log('[OfflineQueue] Duplicate task ignored:', taskId);
      return taskId;
    }

    await db.set('sync_queue', queueItem);
    addDbBreadcrumb('sync_queue', 'queued', { action, table, taskId, scheduledAt: options.scheduledAt });
    
    // Trigger processing (async)
    processSyncQueue().catch(err => console.error('[OfflineQueue] Trigger failed:', err));
    
    return taskId;
  } catch (error) {
    console.error('[OfflineQueue] Failed to queue action:', error);
    throw error;
  }
};

/**
 * Calculate exponential backoff delay
 * @param {number} retries - Current retry count
 */
const getBackoffDelay = (retries) => {
  const base = 1000; // 1s
  const max = 30000; // 30s
  const delay = Math.min(base * Math.pow(2, retries), max);
  // Add jitter (±20%) to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return delay + jitter;
};

let isProcessingQueue = false;

/**
 * Process pending queue items
 */
export const processSyncQueue = async () => {
  if (isProcessingQueue) return { processed: 0, failed: 0 };
  isProcessingQueue = true;

  try {
    const now = Date.now();
    const db = await getDatabase();
    
    // Find items that are not COMPLETED or FAILED
    const allItems = await db.getAll('sync_queue');
    const pendingItems = allItems.filter(item => {
        if (item.status === QUEUE_STATUS.COMPLETED || item.status === QUEUE_STATUS.FAILED) return false;
        
        // If it's processing, check if it's stuck (older than 30s)
        if (item.status === QUEUE_STATUS.PROCESSING) {
          const stuckThreshold = 30000; // 30 seconds
          return (now - (item.lastRetryAt || item.createdAt)) > stuckThreshold;
        }

        if (item.status === QUEUE_STATUS.WAITING) return false; // Handled by dependency logic
        
        // Check for scheduled time
        if (item.scheduledAt && item.scheduledAt > now) return false;

        return !item.nextRetryAt || item.nextRetryAt <= now;
    });

    if (pendingItems.length === 0) return { processed: 0, failed: 0 };

    console.log(`[OfflineQueue] ⚙️ Processing ${pendingItems.length} items`);

  let processed = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      // 1. Dependency Check
      if (item.dependencyId) {
        const dep = await db.get('sync_queue', item.dependencyId);
        if (dep && dep.status !== QUEUE_STATUS.COMPLETED) {
          await db.update('sync_queue', item.id, { status: QUEUE_STATUS.WAITING });
          continue;
        }
      }

      // 2. Mark as processing
      await db.update('sync_queue', item.id, { status: QUEUE_STATUS.PROCESSING });

      // 3. Execute action
      await executeQueueAction(item);

      // 4. Mark as completed
      await db.update('sync_queue', item.id, {
        status: QUEUE_STATUS.COMPLETED,
        completedAt: Date.now(),
      });

      processed++;
      
      // 5. Wake up dependent tasks
      const dependents = await db.getAll('sync_queue', { dependencyId: item.id });
      for (const dep of dependents) {
        await db.update('sync_queue', dep.id, {
            status: QUEUE_STATUS.PENDING,
            nextRetryAt: Date.now()
        });
      }

    } catch (error) {
      console.error('[OfflineQueue] ❌ Execution failed:', item.id, error);

      const newRetries = (item.retries || 0) + 1;
      const isFatal = error.status === 400 || error.status === 403; // Bad Request/Forbidden are usually fatal

      if (newRetries >= item.maxRetries || isFatal) {
        await db.update('sync_queue', item.id, {
          status: QUEUE_STATUS.FAILED,
          error: error.message,
          failedAt: Date.now(),
        });
        failed++;
        
        // Root Fix for messages
        if (item.action === QUEUE_ACTIONS.INSERT_MESSAGE && item.data?.tempId) {
          // This is still a bit Dexie specific but we'll leave it for now or use db.modify if we had it
          const msgs = await db.getAll('messages', { tempId: item.data.tempId });
          for (const m of msgs) await db.update('messages', m.id, { status: 'failed' });
        }
      } else {
        // Schedule Retry with Backoff
        await db.update('sync_queue', item.id, {
          status: QUEUE_STATUS.PENDING,
          retries: newRetries,
          lastRetryAt: Date.now(),
          nextRetryAt: Date.now() + getBackoffDelay(newRetries),
        });

        // Visual Healing: Update message retry count
        if (item.action === QUEUE_ACTIONS.INSERT_MESSAGE && item.data?.tempId) {
          const msgs = await db.getAll('messages', { tempId: item.data.tempId });
          for (const m of msgs) await db.update('messages', m.id, { 
            retryCount: newRetries,
            status: 'repairing'
          });
        }
      }
    }
  }

  return { processed, failed };
  } finally {
    isProcessingQueue = false;
  }
};

export const getQueueStats = async () => {
  const db = await getDatabase();
  const pending = (await db.getAll('sync_queue', { status: QUEUE_STATUS.PENDING })).length;
  const processing = (await db.getAll('sync_queue', { status: QUEUE_STATUS.PROCESSING })).length;
  const failed = (await db.getAll('sync_queue', { status: QUEUE_STATUS.FAILED })).length;
  const completed = (await db.getAll('sync_queue', { status: QUEUE_STATUS.COMPLETED })).length;
  
  return { pending, processing, failed, completed };
};

/**
 * Helper: Execute Supabase insert with Idempotency fallback
 */
const safeInsert = async (table, payload, taskId) => {
  const { data, error } = await supabase.from(table).insert({
    ...payload,
    idempotency_key: taskId
  }).select().single();

  if (error) {
    // 1. Column missing fallback (Postgres code 42703 is undefined_column)
    if (error.code === '42703' || (error.message && error.message.includes('column "idempotency_key" does not exist'))) {
      console.warn(`⚠️ [OfflineQueue] Column 'idempotency_key' missing on ${table}. Falling back...`);
      const { data: retryData, error: retryError } = await supabase.from(table).insert(payload).select().single();
      if (retryError) throw retryError;
      return retryData;
    }
    
    // 2. Conflict handling (Postgres code 23505 is unique_violation)
    if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
      console.log(`ℹ️ [OfflineQueue] Conflict detected on ${table}, checking for existing record via idempotency_key...`);
      const { data: existing } = await supabase.from(table).select().eq('idempotency_key', taskId).maybeSingle();
      if (existing) {
        console.log(`✅ [OfflineQueue] Found existing record for taskId: ${taskId}`);
        return existing;
      }
    }
    throw error;
  }
  return data;
};

/**
 * Execute individual queue action (Atomic Mutations)
 */
const executeQueueAction = async (item) => {
  const { action, table, data, id: taskId } = item;

  switch (action) {
    case QUEUE_ACTIONS.INSERT_MESSAGE: {
      const { tempId: tId, client_id: cId, fileData, fileName, fileType, ...payload } = data;
      const tempId = tId || cId;
      
      // Handle media upload
      if (fileData && fileName) {
        const { uploadMedia, uploadVoiceMessage } = await import('./mediaService');
        const reconstructedFile = new File([fileData], fileName, { type: fileType });
        const mediaPath = payload.media_type === 'voice'
          ? await uploadVoiceMessage(reconstructedFile, payload.sender_id)
          : await uploadMedia(reconstructedFile, payload.sender_id);

        if (!mediaPath) throw new Error('Media upload failed');
        payload.media_path = mediaPath;
      }

      const msgData = await safeInsert(table, payload, taskId);
      await swapMessageInDexie(tempId, msgData);
      break;
    }

    case QUEUE_ACTIONS.MARK_READ: {
      const { messageId, chatId } = data;
      const { error } = await supabase.rpc('mark_message_as_read', { 
        p_message_id: messageId,
        p_chat_id: chatId 
      });
      if (error) throw error;
      break;
    }

    case QUEUE_ACTIONS.SEND_SIGNAL: {
      const { to, signal } = data;
      await safeInsert('webrtc_signals', {
        to_user_id: to,
        signal_data: signal
      }, taskId);
      break;
    }

    case QUEUE_ACTIONS.UPDATE_PRESENCE: {
      const { status, lastSeen } = data;
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from('users').update({
        is_online: status === 'online',
        last_seen: lastSeen
      }).eq('id', session?.user?.id);
      if (error) throw error;
      break;
    }

    case QUEUE_ACTIONS.CREATE_GROUP: {
      const { tempId, payload } = data;
      const groupData = await safeInsert('groups', payload, taskId);
      // Optional: Add logic to update local group ID if tempId was used
      break;
    }

    case QUEUE_ACTIONS.TOGGLE_MUSIC_LIKE: {
      const { userId, songId, songMetadata, isLiked } = data;
      if (isLiked) {
        // We are unliking
        const { error } = await supabase
          .from('music_likes')
          .delete()
          .eq('user_id', userId)
          .eq('song_id', songId);
        if (error) throw error;
      } else {
        // We are liking
        await safeInsert('music_likes', {
          user_id: userId,
          song_id: songId,
          song_metadata: songMetadata,
          created_at: new Date().toISOString()
        }, taskId);
      }
      break;
    }

    case QUEUE_ACTIONS.CREATE_REMINDER: {
      await safeInsert('reminders', data, taskId);
      break;
    }

    case QUEUE_ACTIONS.UPDATE_REMINDER: {
      const { id, ...updates } = data;
      const { error } = await supabase
        .from('reminders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      break;
    }

    case QUEUE_ACTIONS.DELETE_REMINDER: {
      const { id } = data;
      const { error } = await supabase
        .from('reminders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      break;
    }

    case QUEUE_ACTIONS.REMINDER_ACTION: {
      const { id, updates } = data;
      const { error } = await supabase
        .from('reminders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};

const swapMessageInDexie = async (tempId, serverMsg) => {
  if (!tempId) return;
  const { safeDbConversion } = await import('../utils/dbFieldMapping');
  const normalizedMsg = safeDbConversion(serverMsg);
  const db = await getDatabase();

  // 1. Delete all temporary versions (handles both temp_ID and records with the tempId field)
  try {
    // Delete by ID if it followed the temp_ID pattern
    await db.delete('messages', `temp_${tempId}`).catch(() => {});
    
    // Also delete any other records that might have this tempId indexed
    const msgs = await db.getAll('messages', { tempId });
    for (const m of msgs) {
        await db.delete('messages', m.id);
    }
  } catch (err) {
    console.warn('[OfflineQueue] Swap deletion failed:', err);
  }

  // 2. Insert/Update with real server record
  await db.set('messages', normalizedMsg);
};

/**
 * Capacitor Background Sync Listener
 */
if (typeof window !== 'undefined') {
  import('@capacitor/app').then(({ App }) => {
    App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) {
        console.log('[OfflineQueue] App backgrounded - initiating final sync');
        
        // Guard: BackgroundTask is only available on Native
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { BackgroundTask } = await import('@capawesome/capacitor-background-task');
          const taskId = await BackgroundTask.beforeExit(async () => {
            await processSyncQueue();
            BackgroundTask.finish({ taskId });
          });
        } else {
          // Web fallback: Just try to process once before visibility ends
          processSyncQueue().catch(() => {});
        }
      } else {
        processSyncQueue();
      }
    });
  });
}

export const cleanupQueue = async () => {
  const db = await getDatabase();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const completedItems = await db.getAll('sync_queue', { status: QUEUE_STATUS.COMPLETED });
  
  for (const item of completedItems) {
    if (item.completedAt < cutoff) {
      await db.delete('sync_queue', item.id);
    }
  }
};
