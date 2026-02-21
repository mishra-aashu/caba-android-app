import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from '../../../contexts/SupabaseContext';
import { prepareDataForDB, handleDatabaseError } from '../../../utils/dbSchemaCompatibility';
import { realtimeManager } from '../../../utils/realtimeManager';

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
    return (rawList || []).map(msg => ({
      ...msg,
      sender: msg.sender || (msg.sender_id ? { id: msg.sender_id, name: 'Unknown', avatar: null } : null),
      receiver: msg.receiver || (msg.receiver_id ? { id: msg.receiver_id, name: 'Unknown', avatar: null } : null),
      isOwn: msg.sender_id === currentUserId,
      isRead: Boolean(msg.is_read),
      timestamp: msg.created_at ? new Date(msg.created_at).getTime() : 0,
      formattedTime: formatMessageTime(msg.created_at)
    }));
  }, [currentUserId]);

  const fetchMessages = useCallback(async (page = 0) => {
    if (!chatId || !currentUserId) return;

    try {
      setLoading(true);
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

      setMessages(prev => (page === 0 ? processed : [...processed, ...prev]));
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
      setLoading(false);
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

  // Single realtime channel via realtimeManager; strict cleanup
  useEffect(() => {
    if (!chatId || !currentUserId) return;

    const channelName = `chat_messages_useChatMessages_${chatId}`;
    realtimeManager.subscribe(
      channelName,
      {},
      {
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
  }, [chatId, currentUserId, processMessages]);

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
        if (errInfo.isSchemaError) {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          return null;
        }
        throw insertError;
      }

      setMessages(prev => prev.filter(m => m.id !== tempId).concat([{ ...data, isOwn: true, isRead: false }]));
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
