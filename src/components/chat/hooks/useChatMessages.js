import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from '../../../contexts/SupabaseContext';
import { prepareDataForDB, handleDatabaseError } from '../../../utils/dbSchemaCompatibility';
import { realtimeManager } from '../../../utils/realtimeManager';
import { syncService } from '../../../services/syncService';

const MESSAGES_PER_PAGE = 20;

function formatMessageTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const useChatMessages = (chatId, currentUserId) => {
  const { supabase } = useSupabase();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const mountedRef = useRef(true);

  const processMessages = useCallback((rawList) => {
    return (rawList || []).map(msg => {
      const m = msg ?? {};
      return {
        ...m,
        sender: m.sender ?? (m.sender_id ? { id: m.sender_id, name: 'Unknown', avatar: null } : null),
        receiver: m.receiver ?? (m.receiver_id ? { id: m.receiver_id, name: 'Unknown', avatar: null } : null),
        isOwn: m.sender_id === currentUserId,
        isRead: Boolean(m.is_read),
        timestamp: m.created_at ? new Date(m.created_at).getTime() : 0,
        formattedTime: formatMessageTime(m.created_at)
      };
    });
  }, [currentUserId]);

  const fetchMessages = useCallback(async (page = 0) => {
    if (!chatId || !currentUserId) return;

    try {
      if (page === 0) setLoading(true);
      const from = page * MESSAGES_PER_PAGE;
      const to = from + MESSAGES_PER_PAGE - 1;

      const { data, error: fetchError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!sender_id(id, name, avatar, is_online, last_seen),
          receiver:users!receiver_id(id, name, avatar, is_online, last_seen)
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;
      const processed = processMessages(data || []);

      if (!mountedRef.current) return;

      setMessages(prev => {
        if (page === 0) return processed;
        // Merge without duplicates
        const existingIds = new Set(prev.map(m => m.id));
        const newOnes = processed.filter(m => !existingIds.has(m.id));
        return [...newOnes, ...prev];
      });
      
      setHasMore((data?.length || 0) >= MESSAGES_PER_PAGE);

      if (page === 0 && processed.length > 0) {
        const otherId = processed[0].sender_id === currentUserId ? processed[0].receiver_id : processed[0].sender_id;
        if (otherId) {
          supabase.from('users').select('id, name, avatar, is_online, last_seen').eq('id', otherId).single()
            .then(({ data: user }) => { if (mountedRef.current && user) setOtherUser(user); });
        }
      }
      return data;
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err?.message || 'Failed to load messages');
      return [];
    } finally {
      if (page === 0) setLoading(false);
    }
  }, [chatId, currentUserId, supabase, processMessages]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!chatId || !currentUserId) return;
    setMessages([]);
    setHasMore(true);
    fetchMessages(0);
  }, [chatId, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ──────────────────────────────────────────────────────────
  // ROBUST SYNC FALLBACK (NEW)
  // ──────────────────────────────────────────────────────────

  const syncChatData = useCallback(async () => {
    if (!chatId || !mountedRef.current) return;
    
    console.log(`[useChatMessages] Running fallback sync for chat: ${chatId}`);
    const newMessages = await syncService.syncChat(chatId);
    
    if (newMessages?.length > 0 && mountedRef.current) {
      const processed = processMessages(newMessages);
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const toAdd = processed.filter(m => !existingIds.has(m.id));
        if (toAdd.length === 0) return prev;
        
        console.log(`[useChatMessages] Fallback sync found ${toAdd.length} missed messages`);
        // Append new messages (they are already ordered by syncService)
        return [...prev, ...toAdd].sort((a, b) => a.timestamp - b.timestamp);
      });
    }
  }, [chatId, processMessages]);

  // Periodic safety sync while chat is open
  useEffect(() => {
    if (!chatId) return;
    
    const interval = setInterval(syncChatData, 30000); // Sync every 30s as a safety net
    return () => clearInterval(interval);
  }, [chatId, syncChatData]);

  // ──────────────────────────────────────────────────────────
  // REALTIME CHANNELS
  // ──────────────────────────────────────────────────────────

  // Realtime channel for messages
  useEffect(() => {
    if (!chatId || !currentUserId) return;

    const channelName = `chat_messages_useChatMessages_${chatId}`;
    realtimeManager.subscribe(
      channelName,
      {},
      {
        onStatusChange: (status) => {
          if (status === 'SUBSCRIBED') {
            // Catch up whenever connection is established/re-established
            syncChatData();
          }
        },
        onReconnect: () => syncChatData(),
        postgres_changes: [{
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
          handler: (payload) => {
            if (!mountedRef.current || !payload?.new) return;
            const raw = payload.new;
            const processed = processMessages([raw])[0];
            setMessages(prev => {
              if (prev.some(m => m.id === raw.id)) return prev;
              return [...prev, processed];
            });
          }
        }]
      }
    );

    return () => realtimeManager.unsubscribe(channelName);
  }, [chatId, currentUserId, processMessages, syncChatData]);

  // Realtime channel for other user's status updates
  useEffect(() => {
    if (!otherUser?.id) return;

    const channelName = `user_status_${otherUser.id}`;
    realtimeManager.subscribe(
      channelName,
      {},
      {
        postgres_changes: [{
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${otherUser.id}`,
          handler: (payload) => {
            if (!mountedRef.current || !payload?.new) return;
            console.log('[useChatMessages] Other user status updated via manager:', payload.new);
            setOtherUser(prev => ({
              ...prev,
              ...payload.new
            }));
          }
        }]
      }
    );

    return () => realtimeManager.unsubscribe(channelName);
  }, [otherUser?.id]);

  const loadMoreMessages = useCallback(() => {
    const nextPage = Math.ceil(messages.length / MESSAGES_PER_PAGE);
    return fetchMessages(nextPage);
  }, [fetchMessages, messages.length]);

  const sendMessage = async ({ content, replyTo = null }) => {
    if (!chatId || !currentUserId) return null;

    const messageData = {
      chat_id: chatId,
      sender_id: currentUserId,
      content: (content || '').trim(),
      reply_to: replyTo || null
    };
    const preparedData = prepareDataForDB(messageData, 'messages');

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      ...preparedData,
      id: tempId,
      isOwn: true,
      isRead: false,
      sender: { id: currentUserId },
      timestamp: Date.now(),
      formattedTime: formatMessageTime(new Date())
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert([preparedData])
        .select()
        .single();

      if (insertError) {
        const errInfo = handleDatabaseError(insertError, 'messages');
        if (errInfo?.isSchemaError) {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          return null;
        }
        throw insertError;
      }

      if (!mountedRef.current) return data;
      const processed = processMessages([data])[0];
      const finalMessage = processed ? { ...processed, isOwn: true, isRead: Boolean(processed.isRead) } : { ...data, isOwn: true, isRead: false };
      setMessages(prev => prev.filter(m => m.id !== tempId).concat([finalMessage]));
      return data;
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      throw err;
    }
  };

  const deleteMessages = async (messageIds) => {
    if (!messageIds?.length) return false;
    const ids = Array.from(messageIds);
    setMessages(prev => prev.filter(msg => !ids.includes(msg.id)));
    try {
      const { error: delError } = await supabase.from('messages').delete().in('id', ids);
      if (delError) throw delError;
      return true;
    } catch (err) {
      console.error('Error deleting messages:', err);
      setError(err?.message);
      fetchMessages(0);
      return false;
    }
  };

  return {
    messages,
    loading,
    error,
    hasMore,
    isTyping,
    otherUser,
    sendMessage,
    deleteMessages,
    loadMoreMessages
  };
};

export default useChatMessages;
