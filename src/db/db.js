import Dexie from 'dexie';

export const db = new Dexie('CaBaOfflineDB');

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA VERSIONS — MUST be in ascending order. Never reorder or remove.
// ─────────────────────────────────────────────────────────────────────────────

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
    // Migrate chats_list: snake_case → camelCase
    await tx.table('chats_list').toCollection().modify(chat => {
        if (chat.last_message_at) {
            chat.lastMessageAt = chat.last_message_at;
            delete chat.last_message_at;
        }
        if (chat.unread_count !== undefined) {
            chat.unreadCount = chat.unread_count;
            delete chat.unread_count;
        }
    });

    // Migrate messages: snake_case → camelCase
    await tx.table('messages').toCollection().modify(msg => {
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

    // Migrate sync_queue
    await tx.table('sync_queue').toCollection().modify(item => {
        if (item.created_at) { item.createdAt = item.created_at; delete item.created_at; }
        if (item.retry_count !== undefined) { item.retryCount = item.retry_count; delete item.retry_count; }
        if (item.failed_at) { item.failedAt = item.failed_at; delete item.failed_at; }
    });
});

db.version(7).stores({
    sync_queue: '++id, status, table, action, createdAt, failedAt'
}).upgrade(async tx => {
    await tx.table('sync_queue').toCollection().modify(item => {
        if (item.type) { item.action = item.type; delete item.type; }
        if (item.payload) { item.data = item.payload; delete item.payload; }
        if (item.retryCount !== undefined) { item.retries = item.retryCount; delete item.retryCount; }
    });
});

// Version 8: Force re-migration for devices where v6 upgrade didn't run due to ordering bug.
// Also adds `timestamp` index to chats_list for sorting.
db.version(8).stores({
    chats_list: 'id, lastMessageAt, timestamp',
    messages: 'id, chatId, createdAt, senderId, tempId',
}).upgrade(async tx => {
    // Re-run messages migration in case v6 upgrade was skipped
    await tx.table('messages').toCollection().modify(msg => {
        const mappings = {
            'sender_id': 'senderId',
            'receiver_id': 'receiverId',
            'chat_id': 'chatId',
            'media_path': 'mediaPath',
            'media_url': 'mediaUrl',
            'media_type': 'mediaType',
            'is_read': 'isRead',
            'is_group_message': 'isGroupMessage',
            'message_type': 'messageType',
            'reply_to': 'replyTo',
            'vanish_at': 'vanishAt',
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

    // Re-run chats_list migration
    await tx.table('chats_list').toCollection().modify(chat => {
        if (chat.last_message_at && !chat.lastMessageAt) {
            chat.lastMessageAt = chat.last_message_at;
            chat.timestamp = chat.last_message_at;
            delete chat.last_message_at;
        }
        // Ensure timestamp is always set
        if (!chat.timestamp && chat.lastMessageAt) {
            chat.timestamp = chat.lastMessageAt;
        }
    });
});

// Version 9: Add vanishAt index to messages for fast cleanup
db.version(9).stores({
    messages: 'id, chatId, createdAt, senderId, tempId, vanishAt',
});

db.version(11).stores({
    messages: 'id, chatId, createdAt, senderId, tempId, vanishAt, [chatId+createdAt]',
}).upgrade(async (tx) => {
    // Migration: Ensure all messages have camelCase chatId and createdAt
    // so they are correctly indexed by the new compound index.
    await tx.messages.toCollection().modify(m => {
        // Map snake_case to camelCase if missing
        if (m.chat_id && !m.chatId) m.chatId = m.chat_id;
        if (m.created_at && !m.createdAt) m.createdAt = m.created_at;
        if (m.sender_id && !m.senderId) m.senderId = m.sender_id;
        if (m.client_id && !m.tempId) m.tempId = m.client_id;
        
        // Ensure chatId is always present if possible
        if (!m.createdAt) {
            m.createdAt = new Date(0).toISOString();
        }
    });
});

// Version 12: Advanced Sync Queue Support
// - Switches sync_queue to use taskId (UUID) as primary key 'id'
// - Adds indices for nextRetryAt and dependencyId
db.version(12).stores({
    messages: 'id, chatId, createdAt, senderId, tempId, vanishAt, [chatId+createdAt]',
    sync_queue: '++id, status, action, createdAt, nextRetryAt, dependencyId'
}).upgrade(async tx => {
    // Migration: Integer IDs → UUID Strings
    // No action needed as Dexie handles 'id' type changes gracefully in memory,
    // but existing integer records will coexist with new UUID records.
});

// Version 13: Visual Healing Support
// Adds retryCount to messages for UI feedback during auto-repair
db.version(13).stores({
    messages: 'id, chatId, createdAt, senderId, tempId, vanishAt, retryCount, [chatId+createdAt]',
    sync_queue: '++id, status, action, createdAt, nextRetryAt, dependencyId, retryCount'
});

// Version 14: Advanced Features Support
// - Adds scheduledAt to sync_queue for "Send Later"
// - Adds isPinned to messages for Pinned Messages
db.version(14).stores({
    messages: 'id, chatId, createdAt, senderId, tempId, vanishAt, retryCount, isPinned, [chatId+createdAt]',
    sync_queue: '++id, status, action, createdAt, nextRetryAt, scheduledAt, dependencyId, retryCount'
});
db.version(15).stores({
    offline_music_store: 'song_id, download_status, local_file_path'
});

// Version 16: Music Favorites Caching
// Caches liked songs locally for instant offline access
db.version(16).stores({
    liked_songs: 'id, created_at'
});

// Version 17: Group Members Caching
// Support for offline group details and member lists
db.version(17).stores({
    groups: 'id, name, created_by',
    group_members: '[groupId+userId], groupId, userId'
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const addToSyncQueue = async (action, data, table = 'messages') => {
    return await db.sync_queue.add({
        action,
        data,
        table,
        status: 'pending',
        createdAt: Date.now(),
        retries: 0,
        retryCount: 0,
        maxRetries: 3
    });
};

export const getPendingSyncItems = async () => {
    return await db.sync_queue
        .where('status')
        .equals('pending')
        .toArray();
};

export const markSyncItemCompleted = async (id) => {
    return await db.sync_queue.update(id, { status: 'completed' });
};

export const manualRetrySyncItem = async (tempId) => {
    const failedItems = await db.sync_queue
        .where('status')
        .equals('failed')
        .filter(item => {
            const d = item.data || item.payload;
            return d?.tempId === tempId || d?.client_id === tempId;
        })
        .toArray();

    for (const item of failedItems) {
        await db.sync_queue.update(item.id, {
            status: 'pending',
            retries: 0,
            retryCount: 0, // Keep both for safety
            failedAt: null,
            nextRetryAt: null
        });
    }

    await db.messages
        .where('tempId')
        .equals(tempId)
        .modify({ status: 'pending' });

    await db.groups
        .where('id')
        .equals(tempId)
        .modify({ status: 'pending' });

    await db.chats_list
        .where('id')
        .equals(tempId)
        .modify({ status: 'pending' });
};

export const requestPersistentStorage = async () => {
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        return isPersisted;
    }
    return false;
};

export default db;