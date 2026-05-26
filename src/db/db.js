import { Capacitor } from '@capacitor/core';
import { DexieDB } from './DexieDB';
import { FastSQLDB } from './FastSQLDB';
import { uuid } from '../utils/idGenerators';

/**
 * Global database instance. 
 * Automatically selects the appropriate engine based on the platform.
 */
export const db = Capacitor.isNativePlatform() 
    ? new FastSQLDB() 
    : new DexieDB('elevengram_db');

// Initialize the database connection
if (Capacitor.isNativePlatform()) {
    db.init()
        .then(() => {
            import('../services/DoubleRatchetService').then(({ doubleRatchetService }) => {
                doubleRatchetService.loadAllSessions().catch(err => console.error('[Ratchet] Init failed:', err));
            });
        })
        .catch(err => console.error('[Database] Native init failed:', err));
} else {
    // Dexie opens automatically on first access, but we can call init for consistency
    db.init()
        .then(() => {
            import('../services/DoubleRatchetService').then(({ doubleRatchetService }) => {
                doubleRatchetService.loadAllSessions().catch(err => console.error('[Ratchet] Init failed:', err));
            });
        })
        .catch(err => console.error('[Database] Web init failed:', err));
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD COMPATIBILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add an item to the sync queue. 
 */
export const addToSyncQueue = async (action, data, table = 'messages') => {
    return await db.set('sync_queue', {
        id: uuid(),
        table,
        operation: action,
        data: typeof data === 'object' ? JSON.stringify(data) : data,
        createdAt: Date.now(),
        status: 'pending',
        retries: 0
    });
};

export const getPendingSyncItems = async () => {
    return await db.getAll('sync_queue', { status: 'pending' });
};

export const markSyncItemCompleted = async (id) => {
    return await db.update('sync_queue', id, { status: 'completed', completedAt: Date.now() });
};

export const manualRetrySyncItem = async (tempId) => {
    const allItems = await db.getAll('sync_queue');
    const failedItems = allItems.filter(item => {
        if (item.status !== 'failed') return false;
        const d = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
        return d?.tempId === tempId || d?.client_id === tempId;
    });

    for (const item of failedItems) {
        await db.update('sync_queue', item.id, {
            status: 'pending',
            retries: 0,
            failedAt: null,
            nextRetryAt: null
        });
    }

    // Update message status if applicable
    const msgs = await db.getAll('messages', { tempId });
    for (const m of msgs) await db.update('messages', m.id, { status: 'pending' });
};

export const requestPersistentStorage = async () => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        return isPersisted;
    }
    return false;
};

export default db;