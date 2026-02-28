import { useEffect, useRef } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { supabase } from '../config/supabase';
import useUserStore from '../store/userStore';
import { dbToFrontend } from '../utils/dbFieldMapping';

function enrichSender(senderId) {
  const cached = useUserStore.getState().getUser(senderId);
  if (cached) return cached;
  return { id: senderId, name: 'Unknown', avatar: null };
}

export const useRealtimeMessages = (chatId, handlers = {}, currentUserId) => {
  const processedIds = useRef(new Set());
  const handlersRef = useRef(handlers);
  const mountedRef = useRef(true);
  const subscriptionRef = useRef(null);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!chatId) return;
    mountedRef.current = true;
    processedIds.current.clear();

    // Clean up any existing subscription for this chatId
    if (subscriptionRef.current) {
      realtimeManager.unsubscribe(`chat_messages_${chatId}`);
      subscriptionRef.current = null;
    }

    subscriptionRef.current = realtimeManager.subscribe(
      `chat_messages_${chatId}`,
      {},
      {
        postgres_changes: [{
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
          handler: async (payload) => {
            if (!mountedRef.current) return;
            console.log(`📩 Realtime message event for chat ${chatId}:`, payload.eventType, payload.new?.id);
            const { eventType, new: newRecord, old: oldRecord } = payload;
            const id = newRecord?.id ?? oldRecord?.id;
            if (!id) return;

            if (eventType === 'INSERT') {
              if (processedIds.current.has(newRecord.id)) return;
              processedIds.current.add(newRecord.id);

              const frontendMsg = dbToFrontend(newRecord);

              // Root fix: Fetch both sender and receiver concurrently from cache
              const [sender, receiver] = await Promise.all([
                useUserStore.getState().fetchUserIfNeeded(frontendMsg.senderId),
                frontendMsg.receiverId ? useUserStore.getState().fetchUserIfNeeded(frontendMsg.receiverId) : Promise.resolve(null)
              ]);

              const enrichedMsg = {
                ...frontendMsg,
                sender: sender || enrichSender(frontendMsg.senderId),
                receiver: receiver || (frontendMsg.receiverId ? enrichSender(frontendMsg.receiverId) : null)
              };

              if (mountedRef.current && handlersRef.current.onNewMessage) {
                handlersRef.current.onNewMessage(enrichedMsg);
              }
            } else if (eventType === 'UPDATE' && newRecord) {
              if (mountedRef.current && handlersRef.current.onUpdateMessage) {
                handlersRef.current.onUpdateMessage(dbToFrontend(newRecord));
              }
            } else if (eventType === 'DELETE' && oldRecord?.id) {
              const deletedId = oldRecord.id;
              const el = document.getElementById(`message-${deletedId}`);
              if (el) {
                const rect = el.getBoundingClientRect();
                const color = el.classList.contains('sent') ? '#7c3aed' : '#555555';
                import('../utils/particleManager').then(m => m.default.spawn(rect.left + rect.width / 2, rect.top + rect.height / 2, color, rect.width, rect.height));
              }
              if (handlersRef.current.onDeleteMessage) handlersRef.current.onDeleteMessage(deletedId);
            }
          }
        }]
      }
    );

    return () => {
      mountedRef.current = false;
      if (subscriptionRef.current) {
        realtimeManager.unsubscribe(`chat_messages_${chatId}`);
        subscriptionRef.current = null;
      }
      processedIds.current.clear();
    };
  }, [chatId]);
};
