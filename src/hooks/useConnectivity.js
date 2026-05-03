import { useEffect } from 'react';
import { Network } from '@capacitor/network';
import { useSyncStore } from '../store/useSyncStore';
import { syncService } from '../services/syncService';
import { useAuth } from './useAuth';

/**
 * useConnectivity
 * Native-aware network listener for the Unstoppable Messenger.
 */
export const useConnectivity = () => {
  const { setOnline, isOnline } = useSyncStore();
  const { user } = useAuth();

  useEffect(() => {
    // Initial check
    const checkNetwork = async () => {
      const status = await Network.getStatus();
      setOnline(status.connected);
    };

    checkNetwork();

    // Listen for changes
    const handler = Network.addListener('networkStatusChange', (status) => {
      console.log('[Network] Status changed:', status);
      
      const wasOffline = !isOnline;
      const isNowOnline = status.connected;

      setOnline(isNowOnline);

      // ═══ Robust Reconnection: Gap-Filling ═══
      if (wasOffline && isNowOnline && user?.id) {
        console.log('[Sync] Back online! Triggering gap-fill sync...');
        syncService.performGlobalSync(user.id).catch(console.error);
        
        // Also trigger a heartbeat beat to refresh active chat state
        import('../services/SyncHeartbeat').then(({ syncHeartbeat }) => {
          syncHeartbeat._scheduleBeat('network-reconnect', true);
        });
      }
    });

    return () => {
      handler.then(h => h.remove());
    };
  }, [isOnline, setOnline, user?.id]);

  return { isOnline };
};
