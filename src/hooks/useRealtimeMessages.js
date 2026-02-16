import { useEffect } from 'react';
import { supabase } from '../config/supabase';

export const useRealtimeMessages = (chatId, setMessages) => {
  useEffect(() => {
    if (!chatId) return;

    console.log(`🔌 Subscribing to messages for chat: ${chatId}`);

    // 1. Channel define karo
    const channel = supabase
      .channel(`chat_messages_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Insert, Update, Delete sab sunenge
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          // 2. Handle Events (Optimistic UI ke liye local state update)
          
          if (payload.eventType === 'INSERT') {
            // Naya message aaya -> List mein add karo
            const newMsg = payload.new;
            // Dhyan de: Agar tumne pehle hi optimistic add kar diya tha, toh duplicate rokna padega
            setMessages((prev) => {
                if (prev.find(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
          } 
          else if (payload.eventType === 'DELETE') {
            // Message delete hua -> List se hatao
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 3. CRITICAL: Cleanup Function
    // Jab user dusri chat khole, toh purana listener band karo!
    return () => {
      console.log(`🔌 Unsubscribing from chat: ${chatId}`);
      // Safe cleanup: Check if channel exists before removing
      if (channel) {
        supabase.removeChannel(channel);
      }
    };

  }, [chatId, setMessages]); // Dependency array mein sirf chatId rakho
};
