import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeManager } from '../utils/realtimeManager';
import { supabase } from '../config/supabase';
import useUserStore from '../store/userStore';
import { safeDbConversion } from '../utils/dbFieldMapping';

function enrichSender(senderId) {
  const cached = useUserStore.getState().getUser(senderId);
  if (cached) return cached;
  return { id: senderId, name: 'Unknown', avatar: null };
}

export const useRealtimeMessages = (chatId, handlers = {}, currentUserId) => {
  const [status, setStatus] = useState('connecting');

  const _log = (message, detail = {}) => {
    console.log(`[RT] ${message}`, { chat: chatId, ...detail });
  };
  const processedIds = useRef(new Set());
  const handlersRef = useRef(handlers);
  const currentUserIdRef = useRef(currentUserId);
  const chatIdRef = useRef(chatId);
  const lastMessageRef = useRef(null); // { id, created_at } for monotonic catch-up
  const catchUpTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // Keep refs in sync to prevent stale closures
  useEffect(() => {
    handlersRef.current = handlers;
    currentUserIdRef.current = currentUserId;
    chatIdRef.current = chatId;
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, [handlers, currentUserId, chatId]);

  const queryClient = useQueryClient();

  const handlePayload = useCallback(async (payload) => {
    if (!mountedRef.current) return;

    const { eventType, new: newRecord, old: oldRecord } = payload;

    // Rule 5: Wrong-room guard
    const msgChatId = newRecord?.chat_id || oldRecord?.chat_id;
    if (msgChatId && msgChatId !== chatIdRef.current) {
      console.warn('[RT] Wrong-room message ignored', { expected: chatIdRef.current, actual: msgChatId });
      return;
    }

    const id = newRecord?.id ?? oldRecord?.id;
    if (!id) return;

    if (eventType === 'INSERT') {
      // Hook-level Deduplication
      if (processedIds.current.has(id)) return;
      processedIds.current.add(id);

      // Rule 2: Track last message for monotonic catch-up
      if (!lastMessageRef.current || new Date(newRecord.created_at) > new Date(lastMessageRef.current.created_at)) {
        lastMessageRef.current = { id: newRecord.id, created_at: newRecord.created_at };
      }

      // Cap dedup set size
      if (processedIds.current.size > 500) {
        const entries = Array.from(processedIds.current);
        processedIds.current = new Set(entries.slice(-250));
      }

      _log('Realtime INSERT', { id, chat: chatId });
      const frontendMsg = safeDbConversion(newRecord);

      // Fetch sender info
      const sender = await useUserStore.getState().fetchUserIfNeeded(frontendMsg.senderId);

      const enrichedMsg = {
        ...frontendMsg,
        sender: sender || enrichSender(frontendMsg.senderId)
      };

      // SYNC WITH TANSTACK QUERY
      queryClient.setQueryData(['messages', chatId], (old) => {
        if (!old) return old;

        // Prevent duplicate if already exists (e.g. from optimistic update)
        const allMessages = old.pages.flatMap(p => p.data);
        if (allMessages.some(m => m.id === enrichedMsg.id)) return old;

        return {
          ...old,
          pages: old.pages.map((page, i) =>
            i === 0
              ? { ...page, data: [enrichedMsg, ...page.data] }
              : page
          ),
        };
      });

      if (mountedRef.current && handlersRef.current.onNewMessage) {
        handlersRef.current.onNewMessage(enrichedMsg);
      }
    } else if (eventType === 'UPDATE' && newRecord) {
      const updatedMsg = safeDbConversion(newRecord);

      // SYNC WITH TANSTACK QUERY
      queryClient.setQueryData(['messages', chatId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((msg) =>
              msg.id === updatedMsg.id ? { ...msg, ...updatedMsg } : msg
            ),
          })),
        };
      });

      if (mountedRef.current && handlersRef.current.onUpdateMessage) {
        handlersRef.current.onUpdateMessage(updatedMsg);
      }
    } else if (eventType === 'DELETE' && oldRecord?.id) {
      // SYNC WITH TANSTACK QUERY
      queryClient.setQueryData(['messages', chatId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.filter((msg) => msg.id !== oldRecord.id),
          })),
        };
      });

      if (handlersRef.current.onDeleteMessage) {
        handlersRef.current.onDeleteMessage(oldRecord.id);
      }
    }
  }, [chatId, queryClient]);

  /**
   * Rule 2: Anchor Catch-up to Last Known Message (Monotonic)
   */
  const fetchMissedMessages = useCallback(async (isReconnect = false) => {
    if (!chatId || chatId === 'new' || !mountedRef.current) return;

    _log('Catch-up fetch started', { chat: chatId, isReconnect });

    let query = supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId);

    // Rule 2: Monotonic anchor
    if (lastMessageRef.current) {
      const { created_at, id } = lastMessageRef.current;
      query = query.or(`created_at.gt.${created_at},and(created_at.eq.${created_at},id.gt.${id})`);
    } else {
      // Fallback: just get recent batch to bootstrap
      query = query.order('created_at', { ascending: false }).limit(50);
    }

    const { data, error } = await query;

    if (error) {
      _log('Catch-up fetch failed', { error });
      return;
    }

    if (data && data.length > 0 && mountedRef.current) {
      // Update anchor
      const latestFromData = [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      if (!lastMessageRef.current || new Date(latestFromData.created_at) > new Date(lastMessageRef.current.created_at)) {
        lastMessageRef.current = { id: latestFromData.id, created_at: latestFromData.created_at };
      }

      if (handlersRef.current.onCatchup) {
        const frontendMsgs = safeDbConversion(data);
        const senderIds = Array.from(new Set(frontendMsgs.map(m => m.senderId)));
        await Promise.all(senderIds.map(id => useUserStore.getState().fetchUserIfNeeded(id)));

        const enriched = frontendMsgs.map(m => ({
          ...m,
          sender: useUserStore.getState().getUser(m.senderId) || enrichSender(m.senderId)
        }));

        // SYNC WITH TANSTACK QUERY (Catch-up)
        queryClient.setQueryData(['messages', chatId], (old) => {
          if (!old) return old;

          // Merge catch-up messages and sort
          const allMessages = [...enriched];
          old.pages.forEach(page => {
            page.data.forEach(msg => {
              if (!allMessages.some(m => m.id === msg.id)) {
                allMessages.push(msg);
              }
            });
          });

          const sorted = allMessages.sort((a, b) =>
            new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)
          );

          // Re-paginate (simple approach: put all in first page or just reset)
          // For catch-up, we might just want to invalidate or prepend.
          // Prepending is better for UX.
          return {
            ...old,
            pages: [
              { ...old.pages[0], data: sorted.slice(0, 50) },
              ...old.pages.slice(1)
            ]
          };
        });

        handlersRef.current.onCatchup(enriched);
      }
    }
  }, [chatId]);

  const retry = useCallback(() => {
    if (!chatId || chatId === 'new') return;
    const channelName = `chat_messages_${chatId}`;
    realtimeManager.refreshChannel(channelName);
    fetchMissedMessages(true);
  }, [chatId, fetchMissedMessages]);

  useEffect(() => {
    if (!chatId || chatId === 'new') return;

    const channelName = `chat_messages_${chatId}`;

    const setupSubscription = () => {
      realtimeManager.subscribe(
        channelName,
        {},
        {
          postgres_changes: [{
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `chat_id=eq.${chatId}`,
            handler: handlePayload
          }],
          onStatusChange: (status) => {
            if (mountedRef.current) {
              const mappedStatus = (status === 'SUBSCRIBED') ? 'connected' :
                (status === 'SUBSCRIBING' || status === 'RECONNECTING') ? 'connecting' :
                  'disconnected';
              setStatus(mappedStatus);
            }
          },
          onReconnect: () => {
            fetchMissedMessages(true);
          },
          onMaxRetriesReached: () => {
            if (mountedRef.current) setStatus('disconnected');
            if (handlersRef.current.onConnectionError) {
              handlersRef.current.onConnectionError();
            }
          }
        }
      );
    };

    setupSubscription();

    // Rule 3: Debounced Visibility handling
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(catchUpTimerRef.current);
        catchUpTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;

          _log('Visibility catch-up triggered');
          const entry = realtimeManager.getChannel(channelName);
          if (!entry || entry.status !== 'SUBSCRIBED') {
            setupSubscription();
          }
          fetchMissedMessages();
        }, 300);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(catchUpTimerRef.current);
      realtimeManager.unsubscribe(channelName);
      processedIds.current.clear();
    };
  }, [chatId, handlePayload, fetchMissedMessages]);

  return { status, retry };
};

export default useRealtimeMessages;
