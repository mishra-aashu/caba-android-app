import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { realtimeManager } from '../utils/realtimeManager';
import { throttle } from 'lodash';

export const useRealtimeTyping = (chatId, currentUserId) => {
  const [typingUsers, setTypingUsers] = useState({});
  const timeoutRefs = useRef({});

  const channelRef = useRef(null);

  useEffect(() => {
    if (!chatId) return;

    const channelName = `typing_room_${chatId}`;
    console.log(`🔌 Consolidating typing indicator hook for: ${chatId}`);

    const initSubscription = async () => {
      const channel = await realtimeManager.subscribe(
        channelName,
        {},
        {
          broadcast: {
            event: 'typing',
            callback: ({ payload }) => {
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
      channelRef.current = channel;
    };

    initSubscription();

    return () => {
      // Clear all pending timeouts
      Object.values(timeoutRefs.current).forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutRefs.current = {};

      realtimeManager.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [chatId, currentUserId]);

  const sendTyping = useCallback(
    throttle(async () => {
      if (!channelRef.current) return;

      await channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId },
      });
    }, 500),
    [currentUserId]
  );

  return { typingUsers, sendTyping };
};

