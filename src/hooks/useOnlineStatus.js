import { useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './useAuth';
import { realtimeManager } from '../utils/realtimeManager';

/**
 * useOnlineStatus Hook
 * 
 * Root fix: Replaced database heartbeats with Supabase Presence.
 * This drastically reduces Postgres CPU and IO by handling online state in memory.
 */
export const useOnlineStatus = () => {
  const { dbUser } = useAuth();
  const presenceChannelRef = useRef(null);

  useEffect(() => {
    if (!dbUser?.id) return;

    const channelName = 'online-presence';

    const initPresence = async () => {
      // Root fix: Track user in the 'online-presence' channel
      const channel = await realtimeManager.subscribe(
        channelName,
        {},
        {
          presence: {
            event: 'sync',
            callback: () => {
              const state = presenceChannelRef.current.presenceState();
              console.log('Presence sync:', state);
            }
          }
        }
      );

      if (channel) {
        presenceChannelRef.current = channel;

        // Root fix: Start tracking this user
        await channel.track({
          user_id: dbUser.id,
          online_at: new Date().toISOString(),
          name: dbUser.name
        });

        console.log(`📡 Presence tracking started for user: ${dbUser.id}`);
      }
    };

    initPresence();

    // Clean up
    return () => {
      console.log('🚿 Cleaning up presence tracking');
      realtimeManager.unsubscribe(channelName);
      presenceChannelRef.current = null;
    };
  }, [dbUser?.id]);

  return {
    isOnline: true, // Local user is obviously online if this hook is running
    lastSeen: new Date().toISOString()
  };
};

export default useOnlineStatus;