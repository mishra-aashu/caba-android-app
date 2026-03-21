import Dexie from 'dexie';

export const db = new Dexie('CaBaOfflineDB');

// Define database schema
db.version(1).stores({
    chats_list: 'id, last_message_at',
    messages: 'id, chat_id, created_at, sender_id, tempId',
    contacts: 'id, contact_name',
    user_profiles: 'id, name',
    groups: 'id, name',
    sync_queue: '++id, status, type, created_at'
});

db.version(3).stores({
    sync_queue: '++id, status, type, created_at, retry_count, failed_at',
    call_history: 'id, started_at, caller_id, receiver_id'
});

/**
 * Helper to add an item to the sync queue
 */
export const addToSyncQueue = async (type, payload) => {
    return await db.sync_queue.add({
        type,
        payload,
        status: 'pending',
        created_at: new Date().toISOString(),
        retry_count: 0,
        total_resets: 0,
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
 * [FIX #1] manualRetrySyncItem — was using unindexed nested path 'payload.tempId'
 * Dexie only supports querying on indexed fields defined in the schema.
 * Now uses .filter() on the 'failed' status index to find matching items.
 */
export const manualRetrySyncItem = async (tempId) => {
    // 1. Find failed sync queue items that match the tempId inside payload
    const failedItems = await db.sync_queue
        .where('status')
        .equals('failed')
        .filter(item => item.payload?.tempId === tempId)
        .toArray();

    // 2. Reset each matching sync queue item
    for (const item of failedItems) {
        await db.sync_queue.update(item.id, {
            status: 'pending',
            retry_count: 0,
            failed_at: null,
        });
    }

    // 3. Reset message status in Dexie
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