import { useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';

export const useRealtimeMessages = (chatId, setMessages, currentUserId) => {
  // Use ref to track if we've already processed a message
  const processedMessageIds = useRef(new Set());
  
  useEffect(() => {
    if (!chatId) return;

    console.log(`🔌 Subscribing to messages for chat: ${chatId}`);

    // Clear processed message IDs when switching chats
    processedMessageIds.current.clear();

    // 1. Channel define karo
    const channel = supabase
      .channel(`chat_messages_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // Sirf INSERT events sunenge - naye messages ke liye
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          console.log(`📨 Real-time message received:`, payload);
          
          // 2. Handle INSERT Event - Naya message aaya
          const newMsg = payload.new;
          
          // Skip if this is our own message (we already showed it via optimistic update)
          if (newMsg.sender_id === currentUserId) {
            console.log(`📨 Skipping own message: ${newMsg.id}`);
            return;
          }

          // Prevent duplicate processing
          if (processedMessageIds.current.has(newMsg.id)) {
            console.log(`📨 Duplicate message detected: ${newMsg.id}`);
            return;
          }
          
          processedMessageIds.current.add(newMsg.id);

          // Add message to list - with duplicate check
          setMessages((prev) => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            console.log(`✅ Adding new message to state: ${newMsg.id}`);
            return [...prev, newMsg];
          });
        }
      )
      .subscribe((status) => {
        console.log(`📡 Subscription status for chat ${chatId}:`, status);
      });

    // 3. CRITICAL: Cleanup Function
    // Jab user dusri chat khole, toh purana listener band karo!
    return () => {
      console.log(`🔌 Unsubscribing from chat: ${chatId}`);
      // Safe cleanup: Check if channel exists before removing
      if (channel) {
        supabase.removeChannel(channel);
      }
      processedMessageIds.current.clear();
    };

  }, [chatId, currentUserId]); // Dependencies: chatId and currentUserId
};
