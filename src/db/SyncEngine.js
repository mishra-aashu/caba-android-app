import { getDatabase } from './DatabaseFactory';

export class SyncEngine {
    constructor(apiClient) {
        this.db = null;
        this.api = apiClient; // Supabase client or custom API client
    }

    async init() {
        this.db = await getDatabase();
    }

    /**
     * Push pending changes from sync_queue to the server
     */
    async pushPendingChanges() {
        if (!this.db) await this.init();

        // Using getAll for cross-platform compatibility
        const pending = await this.db.getAll('sync_queue', { status: 'pending' });
        
        // Sort by id for sequential processing
        pending.sort((a, b) => a.id - b.id);

        for (const item of pending) {
            if (item.retries >= 3) continue;

            try {
                const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
                const operation = item.operation || item.action;
                const table = item.table || item.table_name;
                
                // Supabase logic (can be abstracted further if needed)
                if (operation === 'INSERT') {
                    await this.api.from(table).insert(data);
                } else if (operation === 'UPDATE') {
                    await this.api.from(table).update(data).match({ id: data.id });
                } else if (operation === 'DELETE') {
                    await this.api.from(table).delete().match({ id: data.id });
                }

                await this.db.delete('sync_queue', item.id);
                console.log(`[SyncEngine] Successfully synced ${table} item`);
            } catch (err) {
                console.error(`[SyncEngine] Failed to sync item ${item.id}:`, err);
                const retries = (item.retries || 0) + 1;
                const status = retries >= 3 ? 'failed' : 'pending';
                await this.db.update('sync_queue', item.id, { status, retries });
            }
        }
    }

    /**
     * Queue a change for later synchronization
     */
    async queueChange(table, operation, data) {
        if (!this.db) await this.init();

        await this.db.set('sync_queue', {
            id: crypto.randomUUID(),
            table: table,
            operation: operation,
            data: typeof data === 'object' ? JSON.stringify(data) : data,
            createdAt: Date.now(),
            retries: 0,
            status: 'pending'
        });
        
        // Trigger background sync if online
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            this.pushPendingChanges();
        }
    }
}

let syncInstance = null;
export function getSyncEngine(apiClient) {
    if (!syncInstance) {
        syncInstance = new SyncEngine(apiClient);
    }
    return syncInstance;
}
