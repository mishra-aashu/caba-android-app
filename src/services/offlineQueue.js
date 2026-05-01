import { db } from '../db/db';
import { supabase } from '../config/supabase';
import { addDbBreadcrumb } from '../config/sentry';

/**
 * Enhanced offline queue with automatic retry and conflict resolution
 */

export const QUEUE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const QUEUE_ACTIONS = {
  INSERT_MESSAGE: 'insert_message',
  UPDATE_MESSAGE: 'update_message',
  DELETE_MESSAGE: 'delete_message',
  UPDATE_PROFILE: 'update_profile',
  CREATE_GROUP: 'create_group',
  ADD_GROUP_MEMBER: 'add_group_member',
};

/**
 * Add action to offline queue
 */
export const queueAction = async (action, table, data, options = {}) => {
  const queueItem = {
    id: crypto.randomUUID(),
    action,
    table,
    data,
    status: QUEUE_STATUS.PENDING,
    retries: 0,
    maxRetries: options.maxRetries || 3,
    createdAt: Date.now(),
    metadata: options.metadata || {},
  };

  await db.sync_queue.add(queueItem);
  addDbBreadcrumb('sync_queue', 'queued', { action, table });

  console.log('[OfflineQueue] Action queued:', queueItem.id);
  return queueItem.id;
};

/**
 * Process pending queue items
 */
export const processSyncQueue = async () => {
  const pendingItems = await db.sync_queue
    .where('status')
    .equals(QUEUE_STATUS.PENDING)
    .toArray();

  if (pendingItems.length === 0) {
    console.log('[OfflineQueue] No pending items');
    return { processed: 0, failed: 0 };
  }

  console.log(`[OfflineQueue] Processing ${pendingItems.length} items`);

  let processed = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      // Mark as processing
      await db.sync_queue.update(item.id, {
        status: QUEUE_STATUS.PROCESSING,
      });

      // Execute action
      await executeQueueAction(item);

      // Mark as completed
      await db.sync_queue.update(item.id, {
        status: QUEUE_STATUS.COMPLETED,
        completedAt: Date.now(),
      });

      processed++;
      addDbBreadcrumb('sync_queue', 'processed', {
        action: item.action,
        id: item.id
      });

    } catch (error) {
      console.error('[OfflineQueue] Failed to process:', item.id, error);

      const newRetries = item.retries + 1;

      if (newRetries >= item.maxRetries) {
        // Max retries exceeded - mark as failed
        await db.sync_queue.update(item.id, {
          status: QUEUE_STATUS.FAILED,
          error: error.message,
          failedAt: Date.now(),
        });
        failed++;
      } else {
        // Retry later
        await db.sync_queue.update(item.id, {
          status: QUEUE_STATUS.PENDING,
          retries: newRetries,
        });
      }

      // [ROOT FIX] Reflect sync failure in the local messages table immediately
      if (item.action === QUEUE_ACTIONS.INSERT_MESSAGE && item.data?.tempId) {
        await db.messages.where('tempId').equals(item.data.tempId).modify({ status: 'failed' }).catch(() => {});
      }
    }
  }

  console.log(`[OfflineQueue] Processed: ${processed}, Failed: ${failed}`);
  return { processed, failed };
};

/**
 * Execute individual queue action
 */
const executeQueueAction = async (item) => {
  const { action, table, data } = item;

  switch (action) {
    case QUEUE_ACTIONS.INSERT_MESSAGE: {
      const { tempId, fileData, fileName, fileType, ...supabasePayload } = data;
      let finalPayload = { ...supabasePayload };

      // Handle media upload
      if (fileData && fileName) {
        const { uploadMedia, uploadVoiceMessage } = await import('./mediaService');
        const reconstructedFile = new File([fileData], fileName, { type: fileType });

        const mediaPath = supabasePayload.media_type === 'voice'
          ? await uploadVoiceMessage(reconstructedFile, supabasePayload.sender_id)
          : await uploadMedia(reconstructedFile, supabasePayload.sender_id);

        if (!mediaPath) throw new Error('Media upload failed');
        finalPayload.media_path = mediaPath;
      }

      const { data: msgData, error } = await supabase.from(table).insert(finalPayload).select().single();
      if (error) throw error;

      // Atomic swap in Dexie
      const { safeDbConversion } = await import('../utils/dbFieldMapping');
      const normalizedMsg = safeDbConversion(msgData);

      await db.transaction('rw', [db.messages], async () => {
        if (tempId) {
          await db.messages.where('tempId').equals(tempId).delete();
        }
        await db.messages.put(normalizedMsg);
      });
      break;
    }

    case QUEUE_ACTIONS.CREATE_GROUP: {
      const { tempId, payload } = data;
      const { name, description, avatar_url, created_by, memberIds } = payload;

      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({ name, description, avatar_url, created_by })
        .select()
        .single();

      if (groupError) throw groupError;

      const groupId = groupData.id;

      // Add members
      const members = [
        { group_id: groupId, user_id: created_by, role: 'admin', joined_at: new Date().toISOString() },
        ...(memberIds || []).filter(id => id !== created_by).map(id => ({
          group_id: groupId, user_id: id, role: 'member', joined_at: new Date().toISOString()
        }))
      ];
      await supabase.from('group_members').insert(members);

      // System message
      await supabase.from('messages').insert({
        chat_id: groupId,
        sender_id: created_by,
        receiver_id: created_by,
        content: `Group "${name}" was created`,
        is_group_message: true,
        message_type: 'system',
      });

      // Atomic swap
      const { safeDbConversion } = await import('../utils/dbFieldMapping');
      await db.transaction('rw', [db.groups, db.chats_list], async () => {
        if (tempId) {
          await db.groups.delete(tempId);
          await db.groups.put({ ...safeDbConversion(groupData), is_syncing: false });

          const localChat = await db.chats_list.where('id').equals(tempId).first();
          if (localChat) {
            await db.chats_list.delete(tempId);
            await db.chats_list.put({ ...localChat, id: groupId, tempId: null });
          }
        }
      });
      break;
    }

    case QUEUE_ACTIONS.UPDATE_MESSAGE: {
      const { error } = await supabase
        .from(table)
        .update(data.updates)
        .eq('id', data.id);
      if (error) throw error;
      break;
    }

    case QUEUE_ACTIONS.DELETE_MESSAGE: {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', data.id);
      if (error) throw error;
      break;
    }

    case QUEUE_ACTIONS.UPDATE_PROFILE: {
      const { error } = await supabase
        .from(table)
        .update(data.updates)
        .eq('id', data.id);
      if (error) throw error;
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};

/**
 * Clear completed queue items (older than 24h)
 */
export const cleanupQueue = async () => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

  const deleted = await db.sync_queue
    .where('status')
    .equals(QUEUE_STATUS.COMPLETED)
    .and((item) => item.completedAt < cutoff)
    .delete();

  console.log(`[OfflineQueue] Cleaned up ${deleted} old items`);
  return deleted;
};

/**
 * Get queue statistics
 */
export const getQueueStats = async () => {
  const all = await db.sync_queue.toArray();

  return {
    total: all.length,
    pending: all.filter((i) => i.status === QUEUE_STATUS.PENDING).length,
    processing: all.filter((i) => i.status === QUEUE_STATUS.PROCESSING).length,
    completed: all.filter((i) => i.status === QUEUE_STATUS.COMPLETED).length,
    failed: all.filter((i) => i.status === QUEUE_STATUS.FAILED).length,
  };
};
