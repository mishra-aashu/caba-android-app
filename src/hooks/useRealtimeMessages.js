import { useEffect, useRef } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { supabase } from '../config/supabase';
import useUserStore from '../store/userStore';
import { safeDbConversion } from '../utils/dbFieldMapping';

export const useRealtimeMessages = (chatId, handlers = {}, currentUserId) => {
  const processedMessageIds = useRef(new Set());
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!chatId) return;

    console.log(`🔌 [SyncFix] Subscribing to messages for chat: ${chatId}`);
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
            const { eventType, new: newRecord, old: oldRecord } = payload;
            console.log(`📨 [SyncFix] Real-time [${eventType}] event:`, {
              id: newRecord?.id || oldRecord?.id,
              chat_id: newRecord?.chat_id || oldRecord?.chat_id,
              payload
            });

            if (eventType === 'INSERT') {
              // Prevent duplicate processing
              if (processedMessageIds.current.has(newRecord.id)) {
                console.log(`⏭️ [SyncFix] Skipping already processed message: ${newRecord.id}`);
                return;
              }
              processedMessageIds.current.add(newRecord.id);

              // Keep message in snake_case so MessageList/MessageItem get created_at, sender_id, etc.
              let enrichedMsg = { ...newRecord };
              const cachedUser = useUserStore.getState().getUser(newRecord.sender_id);

              if (cachedUser) {
                enrichedMsg.sender = cachedUser;
              } else {
                try {
                  const { data, error } = await supabase
                    .from('users')
                    .select('id, name, avatar, is_online, last_seen')
                    .eq('id', newRecord.sender_id)
                    .single();

                  if (!error && data) {
                    enrichedMsg.sender = data;
                    useUserStore.getState().setUser(data);
                  } else {
                    enrichedMsg.sender = { id: newRecord.sender_id, name: 'Unknown', avatar: null };
                  }
                } catch (err) {
                  console.warn('Could not enrich realtime message with sender profile:', err);
                  enrichedMsg.sender = { id: newRecord.sender_id, name: 'Unknown', avatar: null };
                }
              }

              const { onNewMessage } = handlersRef.current;
              if (onNewMessage) {
                onNewMessage(enrichedMsg);
              }

            } else if (eventType === 'UPDATE') {
              const { onUpdateMessage } = handlersRef.current;
              if (onUpdateMessage) {
                onUpdateMessage(safeDbConversion(newRecord));
              }
            } else if (eventType === 'DELETE') {
              const deletedId = oldRecord.id;
              const { onDeleteMessage } = handlersRef.current;

              const element = document.getElementById(`message-${deletedId}`);
              if (element) {
                const rect = element.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                const color = element.classList.contains('sent') ? '#7c3aed' : '#555555';

                import('../utils/particleManager').then(m => {
                  m.default.spawn(x, y, color, rect.width, rect.height);
                });
              }

              if (onDeleteMessage) {
                onDeleteMessage(deletedId);
              }
            }
          }
        }]
      }
    );

    return () => {
      console.log(`🔌 [SyncFix] Unsubscribing from chat: ${chatId}`);
      realtimeManager.unsubscribe(`chat_messages_${chatId}`);
      processedMessageIds.current.clear();
    };

  }, [chatId, currentUserId]);
};
