import { useEffect } from 'react';
import { processSyncQueue, cleanupQueue } from '../services/offlineQueue';

/**
 * useNetworkSync monitors online/offline status and processes the sync_queue
 * using the enhanced OfflineQueue service.
 */
const useNetworkSync = () => {
  useEffect(() => {
    const handleOnline = async () => {
      console.log('[NetworkSync] Online - processing queue');
      // [FIX] Phased Loading: Wait for app to settle (2s)
      await new Promise(r => setTimeout(r, 2000));
      await processSyncQueue();
      await cleanupQueue();
    };

    window.addEventListener('online', handleOnline);

    // Process immediately if already online
    if (navigator.onLine) {
      handleOnline();
    }

    // Periodic cleanup every hour
    const cleanupInterval = setInterval(cleanupQueue, 60 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(cleanupInterval);
    };
  }, []);
};

export default useNetworkSync;