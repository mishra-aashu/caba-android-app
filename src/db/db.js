import Dexie from 'dexie';

export const db = new Dexie('CaBaOfflineDB');

// Define database schema
db.version(1).stores({
    chats_list: 'id, last_message_at',
    messages: 'id, chat_id, created_at, sender_id, tempId',
    contacts: 'id, contact_name',
    user_profiles: 'id, name',
    groups: 'id, name',
    sync_queue: '++id, status, type, created_at' // ++id for auto-increment
});

db.version(2).stores({
    sync_queue: '++id, status, type, created_at, retry_count, failed_at'
});

/**
 * Helper to add an item to the sync queue
 */
export const addToSyncQueue = async (type, payload) => {
    return await db.sync_queue.add({
        type,
        payload,
        status: 'pending',
        created_at: new Date().toISOString()
    });
};

/**
 * Helper to get pending items from sync queue
 */
export const getPendingSyncItems = async () => {
    return await db.sync_queue
        .where('status')
        .equals('pending')
        .toArray();
};

/**
 * Helper to mark sync item as completed
 */
export const markSyncItemCompleted = async (id) => {
    return await db.sync_queue.update(id, { status: 'completed' });
};

/**
 * Helper to manually retry a failed sync item
 */
export const manualRetrySyncItem = async (tempId) => {
    // 1. Reset sync queue item
    await db.sync_queue
        .where('payload.tempId')
        .equals(tempId)
        .modify({ status: 'pending', retry_count: 0, failed_at: null });

    // 2. Reset message status
    await db.messages
        .where('tempId')
        .equals(tempId)
        .modify({ status: 'pending' });
};

/**
 * Request persistent storage to prevent browser eviction
 */
export const requestPersistentStorage = async () => {
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        return isPersisted;
    }
    return false;
};

export default db;

