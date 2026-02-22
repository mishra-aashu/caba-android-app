import Dexie from 'dexie';

export const db = new Dexie('CaBaOfflineDB');

// Define database schema
db.version(1).stores({
    chats_list: 'id, last_message_at',
    messages: 'id, chat_id, created_at, sender_id',
    contacts: 'id, contact_name',
    user_profiles: 'id, name',
    groups: 'id, name',
    sync_queue: '++id, status, type, created_at' // ++id for auto-increment
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
 * Request persistent storage to prevent browser eviction
 */
export const requestPersistentStorage = async () => {
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log(`Persistent storage granted: ${isPersisted}`);
        return isPersisted;
    }
    return false;
};

export default db;

