import { useEffect, useRef } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { supabase } from '../config/supabase';
import useUserStore from '../store/userStore';

export const useRealtimeMessages = (chatId, handlers = {}, currentUserId) => {
  const processedMessageIds = useRef(new Set());
  const handlersRef = useRef(handlers);
  const isMountedRef = useRef(true);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!chatId) return;
    isMountedRef.current = true;
    processedMessageIds.current.clear();

    realtimeManager.subscribe(
      `chat_messages_${chatId}`,
      {},
      {
        postgres_changes: [{
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
          handler: async (payload) => {
            if (!isMountedRef.current) return;
            const { eventType, new: newRecord, old: oldRecord } = payload;
            const newId = newRecord?.id ?? oldRecord?.id;
            if (!newId) return;

            if (eventType === 'INSERT') {
              if (processedMessageIds.current.has(newRecord.id)) return;
              processedMessageIds.current.add(newRecord.id);

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
                  enrichedMsg.sender = (!error && data) ? (useUserStore.getState().setUser(data), data) : { id: newRecord.sender_id, name: 'Unknown', avatar: null };
                } catch {
                  enrichedMsg.sender = { id: newRecord.sender_id, name: 'Unknown', avatar: null };
                }
              }
              if (isMountedRef.current && handlersRef.current.onNewMessage) {
                handlersRef.current.onNewMessage(enrichedMsg);
              }
            } else if (eventType === 'UPDATE' && newRecord) {
              if (isMountedRef.current && handlersRef.current.onUpdateMessage) {
                handlersRef.current.onUpdateMessage(newRecord);
              }
            } else if (eventType === 'DELETE') {
              const deletedId = oldRecord?.id;
              if (deletedId) {
                const element = document.getElementById(`message-${deletedId}`);
                if (element) {
                  const rect = element.getBoundingClientRect();
                  const color = element.classList.contains('sent') ? '#7c3aed' : '#555555';
                  import('../utils/particleManager').then(m => m.default.spawn(rect.left + rect.width / 2, rect.top + rect.height / 2, color, rect.width, rect.height));
                }
                if (handlersRef.current.onDeleteMessage) handlersRef.current.onDeleteMessage(deletedId);
              }
            }
          }
        }]
      }
    );

    return () => {
      isMountedRef.current = false;
      realtimeManager.unsubscribe(`chat_messages_${chatId}`);
      processedMessageIds.current.clear();
    };
  }, [chatId, currentUserId]);
};
