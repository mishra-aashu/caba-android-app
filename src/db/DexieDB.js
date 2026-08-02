import Dexie from 'dexie';
import { IDatabase } from './IDatabase';

export class DexieDB extends Dexie {
    constructor(dbName) {
        super(dbName);
        this._setupSchema();
    }

    _setupSchema() {
        // Porting schema from original db.js
        this.version(1).stores({
            chats_list: 'id, last_message_at',
            messages: 'id, chat_id, created_at, sender_id, tempId',
            contacts: 'id, contact_name',
            user_profiles: 'id, name',
            groups: 'id, name',
            sync_queue: '++id, status, type, created_at'
        });

        this.version(6).stores({
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

            await tx.table('sync_queue').toCollection().modify(item => {
                if (item.created_at) { item.createdAt = item.created_at; delete item.created_at; }
                if (item.retry_count !== undefined) { item.retries = item.retry_count; delete item.retry_count; }
                if (item.failed_at) { item.failedAt = item.failed_at; delete item.failed_at; }
            });
        });

        this.version(7).stores({
            sync_queue: '++id, status, table, action, createdAt, failedAt'
        }).upgrade(async tx => {
            await tx.table('sync_queue').toCollection().modify(item => {
                if (item.type) { item.action = item.type; delete item.type; }
                if (item.payload) { item.data = item.payload; delete item.payload; }
                if (item.retryCount !== undefined) { item.retries = item.retryCount; delete item.retryCount; }
            });
        });

        this.version(8).stores({
            chats_list: 'id, lastMessageAt, timestamp',
            messages: 'id, chatId, createdAt, senderId, tempId',
        }).upgrade(async tx => {
            await tx.table('messages').toCollection().modify(msg => {
                const mappings = {
                    'sender_id': 'senderId', 'receiver_id': 'receiverId', 'chat_id': 'chatId',
                    'media_path': 'mediaPath', 'media_url': 'mediaUrl', 'media_type': 'mediaType',
                    'is_read': 'isRead', 'is_group_message': 'isGroupMessage', 'message_type': 'messageType',
                    'reply_to': 'replyTo', 'vanish_at': 'vanishAt', 'created_at': 'createdAt',
                    'client_id': 'tempId'
                };
                for (const [oldKey, newKey] of Object.entries(mappings)) {
                    if (msg[oldKey] !== undefined) {
                        msg[newKey] = msg[oldKey];
                        delete msg[oldKey];
                    }
                }
            });

            await tx.table('chats_list').toCollection().modify(chat => {
                if (chat.last_message_at && !chat.lastMessageAt) {
                    chat.lastMessageAt = chat.last_message_at;
                    chat.timestamp = chat.last_message_at;
                    delete chat.last_message_at;
                }
                if (!chat.timestamp && chat.lastMessageAt) {
                    chat.timestamp = chat.lastMessageAt;
                }
            });
        });

        this.version(9).stores({
            messages: 'id, chatId, createdAt, senderId, tempId, vanishAt',
        });

        this.version(11).stores({
            messages: 'id, chatId, createdAt, senderId, tempId, vanishAt, [chatId+createdAt]',
        }).upgrade(async (tx) => {
            await tx.messages.toCollection().modify(m => {
                if (m.chat_id && !m.chatId) m.chatId = m.chat_id;
                if (m.created_at && !m.createdAt) m.createdAt = m.created_at;
                if (m.sender_id && !m.senderId) m.senderId = m.sender_id;
                if (m.client_id && !m.tempId) m.tempId = m.client_id;
                if (!m.createdAt) m.createdAt = new Date(0).toISOString();
            });
        });

        this.version(12).stores({
            messages: 'id, chatId, createdAt, senderId, tempId, vanishAt, [chatId+createdAt]',
            sync_queue: '++id, status, action, createdAt, nextRetryAt, dependencyId'
        });

        this.version(13).stores({
            messages: 'id, chatId, createdAt, senderId, tempId, vanishAt, retryCount, [chatId+createdAt]',
            sync_queue: '++id, status, action, createdAt, nextRetryAt, dependencyId, retryCount'
        });

        this.version(14).stores({
            messages: 'id, chatId, createdAt, senderId, tempId, vanishAt, retryCount, isPinned, [chatId+createdAt]',
            sync_queue: '++id, status, action, createdAt, nextRetryAt, scheduledAt, dependencyId, retryCount'
        });

        this.version(15).stores({
            offline_music_store: 'song_id, download_status, local_file_path'
        });

        this.version(16).stores({
            liked_songs: 'id, created_at'
        });

        this.version(17).stores({
            groups: 'id, name, created_by',
            group_members: '[groupId+userId], groupId, userId'
        });

        this.version(18).stores({
            music_likes: 'id, songId, userId, synced',
            reminders: 'id, userId, reminderTime, synced',
            sync_queue: '++id, table, operation, data, retries, status, createdAt'
        }).upgrade(async tx => {
            // Migrate liked_songs to music_likes
            try {
                const liked = await tx.table('liked_songs').toArray();
                if (liked.length > 0) {
                    await tx.table('music_likes').bulkPut(liked.map(s => ({
                        id: s.id,
                        songId: s.id,
                        userId: s.userId || '',
                        synced: true,
                        ...s
                    })));
                }
            } catch (e) {
                console.warn('[DexieDB] Failed to migrate liked_songs:', e);
            }

            // Migrate sync_queue
            try {
                await tx.table('sync_queue').toCollection().modify(item => {
                    if (item.table_name) { item.table = item.table_name; delete item.table_name; }
                    if (item.action) { item.operation = item.action; delete item.action; }
                    if (item.retryCount !== undefined) { item.retries = item.retryCount; delete item.retryCount; }
                    if (!item.status) item.status = 'pending';
                });
            } catch (e) {
                console.warn('[DexieDB] Failed to migrate sync_queue:', e);
            }
        });

        this.version(19).stores({
            sync_queue: '++id, table, operation, status, dependencyId'
        });

        this.version(20).stores({
            chats_list: 'id, lastMessageAt, timestamp',
            messages: 'id, chatId, createdAt, senderId, tempId, vanishAt, retryCount, isPinned, [chatId+createdAt]',
            contacts: 'id, contactName',
            user_profiles: 'id, name',
            groups: 'id, name, created_by',
            group_members: '[groupId+userId], groupId, userId',
            blocked_users: '++id, userId, blockedUserId',
            reports: '++id, reporterId, reportedId',
            call_history: 'id, startedAt, callerId, receiverId',
            reminders: 'id, userId, reminderTime, synced',
            sync_queue: '++id, table, operation, status, dependencyId',
            offline_music_store: 'song_id, download_status, local_file_path',
            music_likes: 'id, songId, userId, synced'
        });

        this.version(21).stores({
            ratchet_sessions: 'chatId'
        });

        this.version(22).stores({
            reminders: 'id, userId, reminderTime, senderId, receiverId, synced'
        });
    }

    /**
     * IDatabase Implementation
     */
    async init() {
        if (!this.isOpen()) {
            await this.open();
        }
    }

    async close() {
        await super.close();
    }

    async get(table, id) {
        return await this[table].get(id);
    }

    async set(table, data) {
        await this[table].put(data);
    }

    async delete(table, id) {
        await this[table].delete(id);
    }

    async update(table, id, data) {
        await this[table].update(id, data);
    }

    async getAll(table, where) {
        if (where) {
            return await this[table].where(where).toArray();
        }
        return await this[table].toArray();
    }

    async query(sql, params) {
        // Dexie doesn't support raw SQL easily. 
        // For specific complex queries, we might need to map them to Dexie syntax or throw.
        throw new Error('Raw SQL queries are not supported on Web engine. Use IDatabase methods instead.');
    }

    async execute(sql, params) {
        throw new Error('Raw SQL execution is not supported on Web engine. Use IDatabase methods instead.');
    }

    /**
     * @param {string} mode - 'rw' or 'r'
     * @param {string[]} tables - List of tables involved
     * @param {Function} callback - Async function to execute
     */
    async transaction(mode, tables, callback) {
        // Use Dexie's native transaction (super refers to Dexie class)
        return await super.transaction(mode, tables, callback);
    }

    async bulkPut(table, items) {
        await this[table].bulkPut(items);
    }
}
