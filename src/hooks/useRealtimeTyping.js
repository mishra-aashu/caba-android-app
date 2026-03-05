import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { throttle } from 'lodash';

export const useRealtimeTyping = (chatId, currentUserId) => {
  const [typingUsers, setTypingUsers] = useState({});
  const timeoutRefs = useRef({});
  const channelRef = useRef(null);
  const currentUserIdRef = useRef(currentUserId);
  const mountedRef = useRef(true);

  // Sync currentUserId to ref to avoid stale closures
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const handleTypingEvent = useCallback(({ payload }) => {
    if (!payload?.userId || payload.userId === currentUserIdRef.current) return;
    if (!mountedRef.current) return;

    const userId = payload.userId;

    // Clear existing timeout for this user
    if (timeoutRefs.current[userId]) {
      clearTimeout(timeoutRefs.current[userId]);
    }

    // Add user to typing list
    setTypingUsers((prev) => ({
      ...prev,
      [userId]: Date.now(),
    }));

    // Auto-remove after 3 seconds of inactivity
    timeoutRefs.current[userId] = setTimeout(() => {
      if (!mountedRef.current) return;
      setTypingUsers((prev) => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
      delete timeoutRefs.current[userId];
    }, 3000);
  }, []); // Stable callback

  useEffect(() => {
    if (!chatId || chatId === 'new') return;

    mountedRef.current = true;
    const channelName = `typing_room_${chatId}`;
    console.log(`[useRealtimeTyping] Subscribing: ${chatId}`);

    const initSubscription = async () => {
      const channel = await realtimeManager.subscribe(
        channelName,
        {},
        {
          broadcast: {
            event: 'typing',
            callback: handleTypingEvent
          }
        }
      );
      if (mountedRef.current) {
        channelRef.current = channel;
      }
    };

    initSubscription();

    return () => {
      mountedRef.current = false;
      // Clear all pending timeouts
      Object.values(timeoutRefs.current).forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutRefs.current = {};

      realtimeManager.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [chatId, handleTypingEvent]);

  const sendTyping = useCallback(
    throttle(async () => {
      const channel = realtimeManager.getChannel(`typing_room_${chatId}`)?.channel;
      if (!channel) return;

      try {
        await channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: currentUserIdRef.current },
        });
      } catch (err) {
        console.warn('[useRealtimeTyping] Failed to send typing:', err);
      }
    }, 500),
    [chatId]
  );

  return { typingUsers, sendTyping };
};

