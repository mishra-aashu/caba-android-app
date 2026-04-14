import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

/**
 * useSyncStatus - Hook to monitor the state of the local-first sync queue.
 * 
 * Returns overall sync health and specific failure counts.
 */
export const useSyncStatus = () => {
    // 1. Get count of failed items
    const failedCount = useLiveQuery(
        () => db.sync_queue.where('status').equals('failed').count(),
        []
    ) || 0;

    // 2. Get count of pending items
    const pendingCount = useLiveQuery(
        () => db.sync_queue.where('status').equals('pending').count(),
        []
    ) || 0;

    // 3. Overall status
    const hasFailures = failedCount > 0;
    const isProcessing = pendingCount > 0;

    return {
        failedCount,
        pendingCount,
        hasFailures,
        isProcessing,
        status: hasFailures ? 'error' : (isProcessing ? 'syncing' : 'synced')
    };
};

export default useSyncStatus;
