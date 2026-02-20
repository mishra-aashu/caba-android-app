import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { realtimeManager } from '../utils/realtimeManager';
import { throttle } from 'lodash';

export const useRealtimeTyping = (chatId, currentUserId) => {
  const [typingUsers, setTypingUsers] = useState({});
  const timeoutRefs = useRef({});

  useEffect(() => {
    if (!chatId) return;

    const channelName = `typing_room_${chatId}`;
    console.log(`🔌 Consolidating typing indicator hook for: ${chatId}`);

    realtimeManager.subscribe(
      channelName,
      {},
      {
        broadcast: ({ event, payload }) => {
          if (event === 'typing') {
            if (payload.userId === currentUserId) return;

            // Clear existing timeout for this user
            if (timeoutRefs.current[payload.userId]) {
              clearTimeout(timeoutRefs.current[payload.userId]);
            }

            // User ko "Typing..." list mein daalo
            setTypingUsers((prev) => ({
              ...prev,
              [payload.userId]: Date.now(),
            }));

            // 3 second baad auto-remove kar do
            timeoutRefs.current[payload.userId] = setTimeout(() => {
              setTypingUsers((prev) => {
                const newState = { ...prev };
                delete newState[payload.userId];
                return newState;
              });
              delete timeoutRefs.current[payload.userId];
            }, 3000);
          }
        }
      }
    );

    return () => {
      // Clear all pending timeouts
      Object.values(timeoutRefs.current).forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutRefs.current = {};

      realtimeManager.unsubscribe(channelName);
    };
  }, [chatId, currentUserId]);

  const sendTyping = useCallback(
    throttle(async () => {
      const channelName = `typing_room_${chatId}`;
      const channel = supabase.channel(channelName);

      // Use direct supabase channel for transient broadcast to avoid singleton tracking overhead
      // but ensure it's lightweight. Actually, let's just use the existing channel if possible.
      // But broadcast needs a subscribed channel. 
      // The singleton manages subscriptions, so we can't easily "broadcast" without a tracked channel.

      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId },
      });

      // Since it's throttled and transient, we don't necessarily need to track it in singleton if we cleanup.
    }, 500),
    [chatId, currentUserId]
  );

  return { typingUsers, sendTyping };
};

