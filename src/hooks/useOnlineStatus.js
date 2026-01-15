import { useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './useAuth';

const HEARTBEAT_INTERVAL = 60000; // 1 minute
const OFFLINE_TIMEOUT = 30000; // 30 seconds of inactivity for testing

export const useOnlineStatus = () => {
  const { dbUser } = useAuth();
  const heartbeatRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const updateOnlineStatus = async (isOnline) => {
    if (!dbUser?.id) return;

    try {
      await supabase
        .from('users')
        .update({
          is_online: Boolean(isOnline),
          last_seen: new Date().toISOString()
        })
        .eq('id', dbUser.id);
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  };

  const startHeartbeat = () => {
    if (heartbeatRef.current) return;

    heartbeatRef.current = setInterval(async () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      // If inactive for more than OFFLINE_TIMEOUT, mark as offline
      if (timeSinceLastActivity > OFFLINE_TIMEOUT) {
        await updateOnlineStatus(false);
        stopHeartbeat();
        return;
      }

      // Update last_seen periodically
      await updateOnlineStatus(true);
    }, HEARTBEAT_INTERVAL);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const handleActivity = () => {
    lastActivityRef.current = Date.now();

    // If not currently online, mark as online
    if (!dbUser?.is_online) {
      updateOnlineStatus(true);
    }

    // Restart heartbeat if stopped
    if (!heartbeatRef.current) {
      startHeartbeat();
    }
  };

  useEffect(() => {
    if (!dbUser?.id) return;

    // Initial online status
    updateOnlineStatus(true);

    // Start heartbeat
    startHeartbeat();

    // Activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, reduce activity but keep online for now
      } else {
        // Tab is visible again, update activity
        handleActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Before unload - mark offline immediately
    const handleBeforeUnload = () => {
      // Synchronous localStorage update for immediate effect
      const offlineData = { ...dbUser, is_online: false, last_seen: new Date().toISOString() };
      localStorage.setItem('_auth_user', JSON.stringify(offlineData));

      // Also try async update (may not complete)
      updateOnlineStatus(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Online/offline events
    const handleOnline = () => {
      updateOnlineStatus(true);
      startHeartbeat();
    };

    const handleOffline = () => {
      updateOnlineStatus(false);
      stopHeartbeat();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      // Cleanup
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      stopHeartbeat();
      updateOnlineStatus(false); // Mark offline on unmount
    };
  }, [dbUser?.id]);

  return {
    isOnline: Boolean(dbUser?.is_online),
    lastSeen: dbUser?.last_seen
  };
};

export default useOnlineStatus;