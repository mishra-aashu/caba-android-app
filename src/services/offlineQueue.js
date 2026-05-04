import { db } from '../db/db';
import { supabase } from '../config/supabase';
import { addDbBreadcrumb } from '../config/sentry';

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
};

/**
 * Add action to offline queue with Idempotency Key
 */
export const queueAction = async (action, table, data, options = {}) => {
  const taskId = options.taskId || crypto.randomUUID();
  
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
    // Check for existing task with same ID (Idempotency check)
    const existing = await db.sync_queue.get(taskId);
    if (existing) {
      console.log('[OfflineQueue] Duplicate task ignored:', taskId);
      return taskId;
    }

    await db.sync_queue.add(queueItem);
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
    
    // Find items that are PENDING, WAITING, or stuck in PROCESSING
    const pendingItems = await db.sync_queue
      .filter(item => {
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
      })
      .toArray();

    if (pendingItems.length === 0) return { processed: 0, failed: 0 };

    console.log(`[OfflineQueue] ⚙️ Processing ${pendingItems.length} items`);

  let processed = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      // 1. Dependency Check
      if (item.dependencyId) {
        const dep = await db.sync_queue.get(item.dependencyId);
        if (dep && dep.status !== QUEUE_STATUS.COMPLETED) {
          await db.sync_queue.update(item.id, { status: QUEUE_STATUS.WAITING });
          continue;
        }
      }

      // 2. Mark as processing
      await db.sync_queue.update(item.id, { status: QUEUE_STATUS.PROCESSING });

      // 3. Execute action
      await executeQueueAction(item);

      // 4. Mark as completed
      await db.sync_queue.update(item.id, {
        status: QUEUE_STATUS.COMPLETED,
        completedAt: Date.now(),
      });

      processed++;
      
      // 5. Wake up dependent tasks
      await db.sync_queue.where('dependencyId').equals(item.id).modify({
        status: QUEUE_STATUS.PENDING,
        nextRetryAt: Date.now()
      });

    } catch (error) {
      console.error('[OfflineQueue] ❌ Execution failed:', item.id, error);

      const newRetries = (item.retries || 0) + 1;
      const isFatal = error.status === 400 || error.status === 403; // Bad Request/Forbidden are usually fatal

      if (newRetries >= item.maxRetries || isFatal) {
        await db.sync_queue.update(item.id, {
          status: QUEUE_STATUS.FAILED,
          error: error.message,
          failedAt: Date.now(),
        });
        failed++;
        
        // Root Fix for messages
        if (item.action === QUEUE_ACTIONS.INSERT_MESSAGE && item.data?.tempId) {
          await db.messages.where('tempId').equals(item.data.tempId).modify({ status: 'failed' }).catch(() => {});
        }
      } else {
        // Schedule Retry with Backoff
        await db.sync_queue.update(item.id, {
          status: QUEUE_STATUS.PENDING,
          retries: newRetries,
          lastRetryAt: Date.now(),
          nextRetryAt: Date.now() + getBackoffDelay(newRetries),
        });

        // Visual Healing: Update message retry count
        if (item.action === QUEUE_ACTIONS.INSERT_MESSAGE && item.data?.tempId) {
          await db.messages.where('tempId').equals(item.data.tempId).modify({ 
            retryCount: newRetries,
            status: 'repairing' // New status for visual healing
          }).catch(() => {});
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
  const pending = await db.sync_queue.where('status').equals(QUEUE_STATUS.PENDING).count();
  const processing = await db.sync_queue.where('status').equals(QUEUE_STATUS.PROCESSING).count();
  const failed = await db.sync_queue.where('status').equals(QUEUE_STATUS.FAILED).count();
  const completed = await db.sync_queue.where('status').equals(QUEUE_STATUS.COMPLETED).count();
  
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
    // 1. Column missing fallback
    if (error.message?.includes("idempotency_key")) {
      console.warn(`⚠️ [OfflineQueue] Column 'idempotency_key' missing on ${table}.`);
      const { data: retryData, error: retryError } = await supabase.from(table).insert(payload).select().single();
      if (retryError) throw retryError;
      return retryData;
    }
    // 2. Conflict handling
    if (error.code === '23505') {
      const { data: existing } = await supabase.from(table).select().eq('idempotency_key', taskId).single();
      if (existing) return existing;
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
      const { tempId, fileData, fileName, fileType, ...payload } = data;
      
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
      const { error } = await supabase.from('users').update({
        is_online: status === 'online',
        last_seen: lastSeen
      }).eq('id', supabase.auth.user()?.id);
      if (error) throw error;
      break;
    }

    case QUEUE_ACTIONS.CREATE_GROUP: {
      const { tempId, payload } = data;
      const groupData = await safeInsert('groups', payload, taskId);
      // Optional: Add logic to update local group ID if tempId was used
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};

const swapMessageInDexie = async (tempId, serverMsg) => {
  const { safeDbConversion } = await import('../utils/dbFieldMapping');
  const normalizedMsg = safeDbConversion(serverMsg);

  await db.transaction('rw', [db.messages], async () => {
    if (tempId) {
      await db.messages.where('tempId').equals(tempId).delete();
    }
    await db.messages.put(normalizedMsg);
  });
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
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return await db.sync_queue
    .where('status')
    .equals(QUEUE_STATUS.COMPLETED)
    .and(item => item.completedAt < cutoff)
    .delete();
};
