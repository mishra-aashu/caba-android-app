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

  const processedIds = useRef(new Set());
  const handlersRef = useRef(handlers);
  const currentUserIdRef = useRef(currentUserId);
  const chatIdRef = useRef(chatId);
  const lastMessageRef = useRef(null);
  const catchUpTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const queryClient = useQueryClient();

  // Keep refs in sync to prevent stale closures
  useEffect(() => {
    handlersRef.current = handlers;
    currentUserIdRef.current = currentUserId;
    chatIdRef.current = chatId;
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, [handlers, currentUserId, chatId]);

  const _log = useCallback((message, detail = {}) => {
    console.log(`[RT] ${message}`, { chat: chatIdRef.current, ...detail });
  }, []);

  const handlePayload = useCallback(async (payload) => {
    if (!mountedRef.current) return;

    const { eventType, new: newRecord, old: oldRecord } = payload;

    // Wrong-room guard
    const msgChatId = newRecord?.chat_id || oldRecord?.chat_id;
    if (msgChatId && msgChatId !== chatIdRef.current) {
      console.warn('[RT] Wrong-room message ignored', {
        expected: chatIdRef.current,
        actual: msgChatId,
      });
      return;
    }

    const id = newRecord?.id ?? oldRecord?.id;
    if (!id) return;

    if (eventType === 'INSERT') {
      // ── Deduplication ──
      if (processedIds.current.has(id)) return;
      processedIds.current.add(id);

      // Track last message for monotonic catch-up
      if (
        !lastMessageRef.current ||
        new Date(newRecord.created_at) > new Date(lastMessageRef.current.created_at)
      ) {
        lastMessageRef.current = { id: newRecord.id, created_at: newRecord.created_at };
      }

      // Cap dedup set size
      if (processedIds.current.size > 500) {
        const entries = Array.from(processedIds.current);
        processedIds.current = new Set(entries.slice(-250));
      }

      _log('Realtime INSERT', { id });
      const frontendMsg = safeDbConversion(newRecord);

      // Fetch sender info
      const sender = await useUserStore.getState().fetchUserIfNeeded(frontendMsg.senderId);

      const enrichedMsg = {
        ...frontendMsg,
        sender: sender || enrichSender(frontendMsg.senderId),
      };

      // ── FIX: Reconcile optimistic messages using client_id ──
      const clientId = newRecord?.client_id;

      queryClient.setQueryData(['messages', chatIdRef.current], (old) => {
        if (!old) return old;

        const allMessages = old.pages.flatMap((p) => p.data);

        // Standard id-based dedup
        if (allMessages.some((m) => m.id === enrichedMsg.id)) return old;

        // FIX: Check for optimistic message by client_id / tempId
        if (clientId) {
          const hasOptimistic = allMessages.some(
            (m) =>
              m.tempId === clientId ||
              m.tempId === Number(clientId) ||
              m.clientId === clientId
          );

          if (hasOptimistic) {
            // Replace optimistic message with real one
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                data: page.data.map((m) =>
                  m.tempId === clientId ||
                  m.tempId === Number(clientId) ||
                  m.clientId === clientId
                    ? enrichedMsg
                    : m
                ),
              })),
            };
          }
        }

        // New message — prepend to first page
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

      queryClient.setQueryData(['messages', chatIdRef.current], (old) => {
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
      queryClient.setQueryData(['messages', chatIdRef.current], (old) => {
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
  }, [queryClient, _log]);

  /**
   * Catch-up: fetch missed messages anchored to last known message
   */
  const fetchMissedMessages = useCallback(async (isReconnect = false) => {
    if (!chatIdRef.current || chatIdRef.current === 'new' || !mountedRef.current) return;

    const currentChatId = chatIdRef.current;
    _log('Catch-up fetch started', { isReconnect });

    let query = supabase
      .from('messages')
      .select('*')
      .eq('chat_id', currentChatId);

    // FIX: Always add order + limit to prevent unbounded queries
    if (lastMessageRef.current) {
      const { created_at, id } = lastMessageRef.current;
      query = query
        .or(`created_at.gt.${created_at},and(created_at.eq.${created_at},id.gt.${id})`)
        .order('created_at', { ascending: true })
        .limit(100);
    } else {
      query = query.order('created_at', { ascending: false }).limit(50);
    }

    const { data, error } = await query;

    if (error) {
      _log('Catch-up fetch failed', { error });
      return;
    }

    if (data && data.length > 0 && mountedRef.current) {
      // Update anchor to newest message
      const sorted = [...data].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      const latestFromData = sorted[0];

      if (
        !lastMessageRef.current ||
        new Date(latestFromData.created_at) > new Date(lastMessageRef.current.created_at)
      ) {
        lastMessageRef.current = {
          id: latestFromData.id,
          created_at: latestFromData.created_at,
        };
      }

      if (handlersRef.current.onCatchup) {
        const frontendMsgs = Array.isArray(safeDbConversion(data))
          ? safeDbConversion(data)
          : [safeDbConversion(data)];

        const senderIds = Array.from(new Set(frontendMsgs.map((m) => m.senderId)));
        await Promise.all(
          senderIds.map((sid) => useUserStore.getState().fetchUserIfNeeded(sid))
        );

        const enriched = frontendMsgs.map((m) => ({
          ...m,
          sender:
            useUserStore.getState().getUser(m.senderId) || enrichSender(m.senderId),
        }));

        // FIX: Better catch-up merge — deduplicate properly
        queryClient.setQueryData(['messages', currentChatId], (old) => {
          if (!old) return old;

          const existingIds = new Set(
            old.pages.flatMap((p) => p.data.map((m) => m.id))
          );
          const newMsgs = enriched.filter((m) => !existingIds.has(m.id));

          if (newMsgs.length === 0) return old;

          // Prepend new messages to first page
          return {
            ...old,
            pages: old.pages.map((page, i) =>
              i === 0
                ? { ...page, data: [...newMsgs, ...page.data] }
                : page
            ),
          };
        });

        handlersRef.current.onCatchup(enriched);
      }
    }
  }, [queryClient, _log]);

  const retry = useCallback(() => {
    if (!chatIdRef.current || chatIdRef.current === 'new') return;
    const channelName = `chat_messages_${chatIdRef.current}`;
    realtimeManager.refreshChannel(channelName);
    fetchMissedMessages(true);
  }, [fetchMissedMessages]);

  useEffect(() => {
    if (!chatId || chatId === 'new') return;

    const channelName = `chat_messages_${chatId}`;

    const setupSubscription = () => {
      realtimeManager.subscribe(
        channelName,
        {},
        {
          postgres_changes: [
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `chat_id=eq.${chatId}`,
              handler: handlePayload,
            },
          ],
          onStatusChange: (newStatus) => {
            if (mountedRef.current) {
              const mapped =
                newStatus === 'SUBSCRIBED'
                  ? 'connected'
                  : newStatus === 'SUBSCRIBING' || newStatus === 'RECONNECTING'
                    ? 'connecting'
                    : 'disconnected';
              setStatus(mapped);
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
          },
        }
      );
    };

    setupSubscription();

    // Debounced visibility handling
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
  }, [chatId, handlePayload, fetchMissedMessages, _log]);

  return { status, retry };
};

export default useRealtimeMessages;