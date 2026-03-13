import { useEffect, useRef, useCallback, useState } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { useAuth } from './useAuth';

/**
 * useOnlineStatus Hook
 * 
 * Root fix: Replaced database heartbeats with Supabase Presence.
 * This handles online state in memory, reducing database load.
 */
export const useOnlineStatus = () => {
  const { dbUser } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const presenceChannelRef = useRef(null);
  const dbUserRef = useRef(dbUser);
  const mountedRef = useRef(true);

  // Sync dbUser to ref
  useEffect(() => {
    dbUserRef.current = dbUser;
  }, [dbUser]);

  useEffect(() => {
    if (!dbUser?.id) return;

    mountedRef.current = true;
    const channelName = `presence:${dbUser.id}`;

    const initPresence = async () => {
      await realtimeManager.subscribe(
        channelName,
        {},
        {
          onStatusChange: (status) => {
            if (mountedRef.current) {
              setIsConnected(status === 'SUBSCRIBED');

              // Automatically re-track whenever we hit SUBSCRIBED state
              if (status === 'SUBSCRIBED') {
                const channel = realtimeManager.getChannel(channelName)?.channel;
                if (channel) {
                  channel.track({
                    user_id: dbUserRef.current.id,
                    online_at: new Date().toISOString(),
                    name: dbUserRef.current.name
                  }).catch(err => console.error('[RT] Presence track failed:', err));
                }
              }
            }
          }
        }
      );
    };

    initPresence();

    return () => {
      mountedRef.current = false;
      console.log('[useOnlineStatus] Cleaning up presence tracking');
      realtimeManager.unsubscribe(channelName);
      presenceChannelRef.current = null;
    };
  }, [dbUser?.id]);

  return {
    isOnline: isConnected,
    lastSeen: new Date().toISOString()
  };
};

export default useOnlineStatus;