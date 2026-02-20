import { useEffect, useRef } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { supabase } from '../config/supabase';

export const useRealtimeMessages = (chatId, setMessages, currentUserId) => {
  const processedMessageIds = useRef(new Set());

  useEffect(() => {
    if (!chatId) return;

    console.log(`🔌 Subscribing to messages for chat: ${chatId}`);
    processedMessageIds.current.clear();

    const channel = realtimeManager.subscribe(
      `chat_messages_${chatId}`,
      {},
      {
        postgres_changes: [{
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
          handler: async (payload) => {
            console.log(`📨 Real-time message event [${payload.eventType}]:`, payload);

            if (payload.eventType === 'INSERT') {
              const newMsg = payload.new;

              // Skip our own messages — already shown via optimistic update
              if (newMsg.sender_id === currentUserId) return;

              // Prevent duplicate processing
              if (processedMessageIds.current.has(newMsg.id)) return;
              processedMessageIds.current.add(newMsg.id);

              // postgres_changes payloads don't include joins.
              // Fetch the full message row with the sender profile so
              // group chat avatars and sender names are available.
              let enrichedMsg = newMsg;
              try {
                const { data, error } = await supabase
                  .from('messages')
                  .select(`
                    *,
                    sender:sender_id (
                      id,
                      name,
                      avatar,
                      is_online,
                      last_seen
                    )
                  `)
                  .eq('id', newMsg.id)
                  .single();

                if (!error && data) {
                  enrichedMsg = data;
                }
              } catch (err) {
                // Non-fatal — fall back to raw payload
                console.warn('Could not enrich realtime message with sender profile:', err);
              }

              setMessages((prev) => {
                if (prev.find(m => m.id === enrichedMsg.id)) return prev;
                return [...prev, enrichedMsg];
              });

            } else if (payload.eventType === 'UPDATE') {
              const updatedMsg = payload.new;
              setMessages((prev) =>
                prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m)
              );
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setMessages((prev) => prev.filter(m => m.id !== deletedId));
            }
          }
        }]
      }
    );

    return () => {
      console.log(`🔌 Unsubscribing from chat: ${chatId}`);
      realtimeManager.unsubscribe(`chat_messages_${chatId}`);
      processedMessageIds.current.clear();
    };

  }, [chatId, currentUserId, setMessages]);
};
