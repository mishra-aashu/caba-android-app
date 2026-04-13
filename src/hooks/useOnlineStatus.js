import { useEffect, useRef, useState } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { useAuth } from './useAuth';

/**
 * useOnlineStatus Hook
 *
 * Maintains the per-user private channel for connection status tracking.
 *
 * NOTE: The shared 'game_lobby_presence' channel (for the Games Hub) is now
 * managed by <GameLobbyProvider> in AuthenticatedApp.jsx. This hook no longer
 * touches that channel to avoid the Supabase channel dedup issue where
 * supabase.channel(name) returns the same instance if called twice.
 */
export const useOnlineStatus = () => {
  const { dbUser } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const dbUserRef = useRef(dbUser);
  const mountedRef = useRef(true);

  // Keep ref in sync
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

              if (status === 'SUBSCRIBED') {
                const channel = realtimeManager.getChannel(channelName)?.channel;
                if (channel) {
                  channel.track({
                    user_id: dbUserRef.current.id,
                    online_at: new Date().toISOString(),
                    name: dbUserRef.current.name,
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
      realtimeManager.unsubscribe(channelName);
    };
  }, [dbUser?.id]);

  return {
    isOnline: isConnected,
    lastSeen: new Date().toISOString()
  };
};

export default useOnlineStatus;