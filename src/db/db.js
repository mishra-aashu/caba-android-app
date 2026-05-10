import { Capacitor } from '@capacitor/core';
import { DexieDB } from './DexieDB';
import { FastSQLDB } from './FastSQLDB';

/**
 * Global database instance. 
 * Automatically selects the appropriate engine based on the platform.
 */
export const db = Capacitor.isNativePlatform() 
    ? new FastSQLDB() 
    : new DexieDB('elevengram_db');

// Initialize the database connection
if (Capacitor.isNativePlatform()) {
    db.init().catch(err => console.error('[Database] Native init failed:', err));
} else {
    // Dexie opens automatically on first access, but we can call init for consistency
    db.init().catch(err => console.error('[Database] Web init failed:', err));
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD COMPATIBILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add an item to the sync queue. 
 * Maps to the new SyncEngine logic or direct DB access.
 */
export const addToSyncQueue = async (action, data, table = 'messages') => {
    if (db.queueChange) {
        // If it's a SyncEngine-aware DB (or we use the SyncEngine directly)
        return await db.set('sync_queue', {
            table_name: table,
            action,
            data: JSON.stringify(data),
            createdAt: Date.now(),
            status: 'pending'
        });
    }
    
    // Dexie fallback
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
    if (db.getAll) {
        return await db.getAll('sync_queue', { status: 'pending' });
    }
    return await db.sync_queue.where('status').equals('pending').toArray();
};

export const markSyncItemCompleted = async (id) => {
    if (db.set && db.get) {
        const item = await db.get('sync_queue', id);
        if (item) {
            return await db.set('sync_queue', { ...item, status: 'completed' });
        }
    }
    return await db.sync_queue.update(id, { status: 'completed' });
};

export const manualRetrySyncItem = async (tempId) => {
    // Ported from original db.js
    if (!Capacitor.isNativePlatform()) {
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
                retryCount: 0,
                failedAt: null,
                nextRetryAt: null
            });
        }

        await db.messages.where('tempId').equals(tempId).modify({ status: 'pending' });
        await db.groups.where('id').equals(tempId).modify({ status: 'pending' });
        await db.chats_list.where('id').equals(tempId).modify({ status: 'pending' });
    } else {
        // Native SQLite implementation for retry
        await db.execute(
            "UPDATE sync_queue SET status = 'pending', retries = 0 WHERE data LIKE ?",
            [`%${tempId}%`]
        );
    }
};

export const requestPersistentStorage = async () => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        return isPersisted;
    }
    return false;
};

export default db;