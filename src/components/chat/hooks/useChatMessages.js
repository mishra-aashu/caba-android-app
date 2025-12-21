import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '../../../contexts/SupabaseContext';

const MESSAGES_PER_PAGE = 20;

export const useChatMessages = (chatId, currentUserId) => {
  const { supabase } = useSupabase();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  
  // Fetch chat messages
  const fetchMessages = useCallback(async (page = 0) => {
    if (!chatId || !currentUserId) return;
    
    try {
      setLoading(true);
      
      // Fetch messages with pagination
      const from = page * MESSAGES_PER_PAGE;
      const to = from + MESSAGES_PER_PAGE - 1;
      
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(*),
          read_by:message_reads(
            user_id,
            read_at,
            user:profiles!user_id(*)
          )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (fetchError) throw fetchError;
      
      // Process messages (e.g., format dates, etc.)
      const processedMessages = processMessages(data || []);
      
      setMessages(prev => {
        // If loading first page, replace messages, otherwise prepend
        return page === 0 
          ? processedMessages 
          : [...processedMessages, ...prev];
      });
      
      // Check if there are more messages to load
      setHasMore((data?.length || 0) >= MESSAGES_PER_PAGE);
      
      // If first load, fetch other user's details
      if (page === 0 && processedMessages.length > 0) {
        const otherUserId = processedMessages[0].sender_id === currentUserId 
          ? processedMessages[0].receiver_id 
          : processedMessages[0].sender_id;
        
        fetchUserProfile(otherUserId);
      }
      
      return data;
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [chatId, currentUserId, supabase]);
  
  // Load more messages
  const loadMoreMessages = useCallback(() => {
    const nextPage = Math.ceil(messages.length / MESSAGES_PER_PAGE);
    return fetchMessages(nextPage);
  }, [fetchMessages, messages.length]);
  
  // Initial load
  useEffect(() => {
    if (chatId && currentUserId) {
      setMessages([]);
      setHasMore(true);
      fetchMessages(0);
    }
  }, [chatId, currentUserId, fetchMessages]);
  
  // Set up real-time subscription
  useEffect(() => {
    if (!chatId) return;
    
    const channel = supabase
      .channel(`messages:chat_id=eq.${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          const newMessage = processMessages([payload.new])[0];
          setMessages(prev => [...prev, newMessage]);
          
          // Mark as read if it's a new message from the other user
          if (newMessage.sender_id !== currentUserId) {
            markAsRead(newMessage.id);
          }
        }
      )
      .subscribe();
    
    // Cleanup subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, currentUserId, supabase]);
  
  // Process and format messages
  const processMessages = (messages) => {
    return messages.map(msg => ({
      ...msg,
      isOwn: msg.sender_id === currentUserId,
      isRead: msg.read_by?.some(read => read.user_id === currentUserId) || false,
      timestamp: new Date(msg.created_at).getTime(),
      formattedTime: formatMessageTime(msg.created_at)
    }));
  };
  
  // Fetch user profile
  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      setOtherUser(data);
      return data;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  };
  
  // Mark message as read
  const markAsRead = async (messageId) => {
    try {
      const { error } = await supabase
        .from('message_reads')
        .upsert({
          message_id: messageId,
          user_id: currentUserId,
          read_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              isRead: true,
              read_by: [...(msg.read_by || []), { user_id: currentUserId }] 
            } 
          : msg
      ));
      
      return true;
    } catch (err) {
      console.error('Error marking message as read:', err);
      return false;
    }
  };
  
  // Send a new message
  const sendMessage = async ({ content, attachments = [], replyTo = null }) => {
    if (!chatId || !currentUserId) return null;
    
    try {
      const newMessage = {
        chat_id: chatId,
        sender_id: currentUserId,
        content,
        reply_to: replyTo,
        created_at: new Date().toISOString(),
        status: 'sent',
        attachments: attachments.length > 0 ? attachments : null
      };
      
      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        ...newMessage,
        id: tempId,
        isOwn: true,
        isRead: false,
        sender: { id: currentUserId },
        timestamp: Date.now(),
        formattedTime: formatMessageTime(new Date())
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Send to server
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          chat_id: chatId,
          sender_id: currentUserId,
          content,
          reply_to: replyTo,
          attachments: attachments.length > 0 ? attachments : null
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Replace temp message with server response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempId);
        return [...filtered, { ...data, isOwn: true, isRead: false }];
      });
      
      return data;
    } catch (err) {
      console.error('Error sending message:', err);
      
      // Revert optimistic update on error
      setMessages(prev => prev.filter(m => m.id !== `temp-${Date.now()}`));
      
      throw err;
    }
  };
  
  // Delete messages
  const deleteMessages = async (messageIds) => {
    if (!messageIds.length) return false;
    
    try {
      const { error } = await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', Array.from(messageIds));
      
      if (error) throw error;
      
      // Update local state
      setMessages(prev => 
        prev.filter(msg => !messageIds.includes(msg.id))
      );
      
      return true;
    } catch (err) {
      console.error('Error deleting messages:', err);
      return false;
    }
  };
  
  // Format message time
  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    loadMoreMessages,
    markAsRead
  };
};

export default useChatMessages;
