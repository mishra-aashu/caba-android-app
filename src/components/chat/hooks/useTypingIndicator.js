import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '../../../contexts/SupabaseContext';

export const useTypingIndicator = (chatId, currentUserId) => {
  const { supabase } = useSupabase();
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  
  // Handle typing status change
  const handleTyping = useCallback((isTyping) => {
    if (!chatId || !currentUserId) return;
    
    // Update local state immediately for better UX
    setIsTyping(isTyping);
    
    // Clear any existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set a new timeout to stop typing after 3 seconds of inactivity
    const timeout = setTimeout(() => {
      setIsTyping(false);
      // Broadcast that user stopped typing
      broadcastTypingStatus(false);
    }, 3000);
    
    setTypingTimeout(timeout);
    
    // Broadcast typing status
    broadcastTypingStatus(isTyping);
  }, [chatId, currentUserId, typingTimeout]);
  
  // Broadcast typing status to other users
  const broadcastTypingStatus = useCallback((isTyping) => {
    if (!chatId || !currentUserId) return;
    
    supabase
      .channel(`typing:${chatId}`)
      .track({
        user_id: currentUserId,
        is_typing: isTyping,
        chat_id: chatId,
        timestamp: new Date().toISOString()
      });
  }, [chatId, currentUserId, supabase]);
  
  // Set up real-time subscription for typing indicators
  useEffect(() => {
    if (!chatId) return;
    
    const channel = supabase
      .channel(`typing:${chatId}:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          // Skip our own typing indicators
          if (payload.new.user_id === currentUserId) return;
          
          setTypingUsers(prev => ({
            ...prev,
            [payload.new.user_id]: payload.new.is_typing 
              ? Date.now() 
              : null
          }));
        }
      )
      .subscribe();
    
    // Clean up subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, currentUserId, supabase]);
  
  // Check if any user is currently typing
  useEffect(() => {
    const now = Date.now();
    const activeTypingUsers = Object.entries(typingUsers)
      .filter(([_, timestamp]) => timestamp && now - timestamp < 3000);
    
    // Update typing state if it has changed
    const shouldShowTyping = activeTypingUsers.length > 0;
    if (shouldShowTyping !== isTyping) {
      setIsTyping(shouldShowTyping);
    }
    
    // Clean up old typing indicators
    if (Object.keys(typingUsers).length > 0) {
      const newTypingUsers = {};
      Object.entries(typingUsers).forEach(([userId, timestamp]) => {
        if (timestamp && now - timestamp < 5000) {
          newTypingUsers[userId] = timestamp;
        }
      });
      
      if (Object.keys(newTypingUsers).length !== Object.keys(typingUsers).length) {
        setTypingUsers(newTypingUsers);
      }
    }
  }, [typingUsers, isTyping]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      // Notify that user stopped typing when leaving the chat
      if (isTyping) {
        broadcastTypingStatus(false);
      }
    };
  }, [typingTimeout, isTyping, broadcastTypingStatus]);
  
  return {
    isTyping,
    handleTyping,
    typingUsers: Object.keys(typingUsers).filter(
      userId => typingUsers[userId] && Date.now() - typingUsers[userId] < 3000
    )
  };
};

export default useTypingIndicator;
