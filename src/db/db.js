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

db.version(6).stores({
    chats_list: 'id, lastMessageAt',
    messages: 'id, chatId, createdAt, senderId, tempId',
    contacts: 'id, contactName',
    user_profiles: 'id, name',
    groups: 'id, name',
    sync_queue: '++id, status, type, createdAt, retryCount, failedAt',
    blocked_users: '++id, userId, blockedUserId',
    reports: '++id, reporterId, reportedId',
    call_history: 'id, startedAt, callerId, receiverId',
    reminders: 'id, reminderTime, senderId, receiverId'
}).upgrade(async tx => {
    // Migration: Convert snake_case to camelCase for existing data
    const { safeDbConversion } = await import('../utils/dbFieldMapping');

    await tx.chats_list.toCollection().modify(chat => {
        if (chat.last_message_at) {
            chat.lastMessageAt = chat.last_message_at;
            delete chat.last_message_at;
        }
    });

    await tx.messages.toCollection().modify(msg => {
        const converted = safeDbConversion(msg);
        Object.keys(msg).forEach(key => delete msg[key]);
        Object.assign(msg, converted);
    });

    await tx.sync_queue.toCollection().modify(item => {
        if (item.created_at) { item.createdAt = item.created_at; delete item.created_at; }
        if (item.retry_count !== undefined) { item.retryCount = item.retry_count; delete item.retry_count; }
        if (item.failed_at) { item.failedAt = item.failed_at; delete item.failed_at; }
    });
});

/**
 * Helper to add an item to the sync queue
 */
export const addToSyncQueue = async (type, payload) => {
    return await db.sync_queue.add({
        type,
        payload,
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
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
            retryCount: 0,
            failedAt: null,
        });
    }

    // 3. Reset statuses in Dexie tables for UI feedback
    // Reset messages
    await db.messages
        .where('tempId')
        .equals(tempId)
        .modify({ status: 'pending' });

    // [FIX #11] New: Reset groups and chats_list
    await db.groups
        .where('id')
        .equals(tempId)
        .modify({ status: 'pending' });

    await db.chats_list
        .where('id')
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