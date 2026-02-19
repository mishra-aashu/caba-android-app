import { useEffect, useRef } from 'react';
import { realtimeManager } from '../utils/realtimeManager';

export const useRealtimeMessages = (chatId, setMessages, currentUserId) => {
  // Use ref to track if we've already processed a message
  const processedMessageIds = useRef(new Set());
  
  useEffect(() => {
    if (!chatId) return;

    console.log(`🔌 Subscribing to messages for chat: ${chatId}`);

    // Clear processed message IDs when switching chats
    processedMessageIds.current.clear();

    // Create subscription using realtimeManager
    const channel = realtimeManager.subscribe(
      `chat_messages_${chatId}`,
      {},
      {
        postgres_changes: [{
          event: 'INSERT', // Sirf INSERT events sunenge - naye messages ke liye
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
          handler: (payload) => {
            console.log(`📨 Real-time message received:`, payload);
            
            // Handle INSERT Event - Naya message aaya
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
        }]
      }
    );

    // Cleanup function - uses realtimeManager
    return () => {
      console.log(`🔌 Unsubscribing from chat: ${chatId}`);
      realtimeManager.unsubscribe(`chat_messages_${chatId}`);
      processedMessageIds.current.clear();
    };

  }, [chatId, currentUserId, setMessages]); // Dependencies: chatId, currentUserId, setMessages
};
