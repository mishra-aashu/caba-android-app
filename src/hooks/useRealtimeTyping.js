import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { throttle } from 'lodash';

export const useRealtimeTyping = (chatId, currentUserId) => {
  const [typingUsers, setTypingUsers] = useState({});
  const timeoutRefs = useRef({}); // Track timeouts for cleanup

  useEffect(() => {
    if (!chatId) return;

    // 1. Channel Create karo (Sirf ek baar)
    const channel = supabase.channel(`typing_room_${chatId}`);

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        // Khud ka typing status ignore karo
        if (payload.payload.userId === currentUserId) return;

        // Clear existing timeout for this user
        if (timeoutRefs.current[payload.payload.userId]) {
          clearTimeout(timeoutRefs.current[payload.payload.userId]);
        }

        // User ko "Typing..." list mein daalo
        setTypingUsers((prev) => ({
          ...prev,
          [payload.payload.userId]: Date.now(),
        }));

        // 3 second baad auto-remove kar do (agar user ruk gaya)
        timeoutRefs.current[payload.payload.userId] = setTimeout(() => {
          setTypingUsers((prev) => {
            const newState = { ...prev };
            delete newState[payload.payload.userId];
            return newState;
          });
          delete timeoutRefs.current[payload.payload.userId];
        }, 3000);
      })
      .subscribe();

    // CLEANUP: Jab chat change ho, channel band karo aur timeouts clear karo
    return () => {
      // Clear all pending timeouts
      Object.values(timeoutRefs.current).forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutRefs.current = {};
      
      // Safe cleanup: Check if channel exists before removing
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [chatId, currentUserId]);

  // 2. Typing Signal bhejne ka function (Throttled: Max 1 call per 500ms)
  // Isse network spam nahi hoga
  const sendTyping = useCallback(
    throttle(() => {
      const channel = supabase.channel(`typing_room_${chatId}`);
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId },
      });
    }, 500),
    [chatId, currentUserId]
  );

  return { typingUsers, sendTyping };
};
