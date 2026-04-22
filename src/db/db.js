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
});

db.version(7).stores({
    sync_queue: '++id, status, table, action, createdAt, failedAt'
}).upgrade(async tx => {
    // Migration: Map old fields to new fields if necessary
    await tx.sync_queue.toCollection().modify(item => {
        if (item.type) { item.action = item.type; delete item.type; }
        if (item.payload) { item.data = item.payload; delete item.payload; }
        if (item.retryCount !== undefined) { item.retries = item.retryCount; delete item.retryCount; }
    });
});

db.version(6).upgrade(async tx => {
    // Migration: Convert snake_case to camelCase for existing data
    // IMPORTANT: Avoid dynamic imports or non-Dexie promises inside upgrade
    
    await tx.chats_list.toCollection().modify(chat => {
        if (chat.last_message_at) {
            chat.lastMessageAt = chat.last_message_at;
            delete chat.last_message_at;
        }
        if (chat.unread_count !== undefined) {
            chat.unreadCount = chat.unread_count;
            delete chat.unread_count;
        }
    });

    await tx.messages.toCollection().modify(msg => {
        const mappings = {
            'sender_id': 'senderId',
            'receiver_id': 'receiverId',
            'chat_id': 'chatId',
            'media_path': 'mediaPath',
            'media_url': 'mediaUrl',
            'is_read': 'isRead',
            'created_at': 'createdAt',
            'client_id': 'tempId'
        };
        
        for (const [oldKey, newKey] of Object.entries(mappings)) {
            if (msg[oldKey] !== undefined) {
                msg[newKey] = msg[oldKey];
                delete msg[oldKey];
            }
        }
    });

    await tx.sync_queue.toCollection().modify(item => {
        if (item.created_at) { item.createdAt = item.created_at; delete item.created_at; }
        if (item.retry_count !== undefined) { item.retryCount = item.retry_count; delete item.retry_count; }
        if (item.failed_at) { item.failedAt = item.failed_at; delete item.failed_at; }
    });
});

// Helper to add an item to the sync queue
export const addToSyncQueue = async (type, payload) => {
    return await db.sync_queue.add({
        type,
        payload,
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
        totalResets: 0,
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