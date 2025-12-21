import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../contexts/NewAuthContext';
import { useCall } from '../../context/CallContext';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { useChatMessages } from './hooks/useChatMessages';
import { useTypingIndicator } from './hooks/useTypingIndicator';
import { useMessageStatus } from './hooks/useMessageStatus';
import { formatMessageTime } from './utils/messageUtils';
import { playNotificationSound } from './utils/notification';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import MediaViewer from '../media/MediaViewer';
import '../../styles/chat.css';

const Chat = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const { user: currentUser } = useAuth();
  const { startCall } = useCall();
  const { chatTheme } = useChatTheme();
  
  // Refs
  const messagesEndRef = useRef(null);
  const listRef = useRef(null);
  
  // State
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  
  // Custom hooks
  const {
    messages,
    loading,
    error,
    sendMessage,
    deleteMessages,
    loadMoreMessages,
    hasMore,
    isTyping,
    otherUser
  } = useChatMessages(chatId, currentUser?.id);
  
  const { isTyping: isOtherTyping, handleTyping } = useTypingIndicator(chatId, currentUser?.id);
  const { updateMessageStatus } = useMessageStatus(chatId, currentUser?.id);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOtherTyping]);

  // Handle new message
  const handleSendMessage = async (content, attachments = []) => {
    if ((!content || content.trim() === '') && attachments.length === 0) return;
    
    try {
      await sendMessage({
        content: content.trim(),
        attachments,
        replyTo: replyingTo?.id
      });
      
      // Clear reply state
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Handle error (show toast, etc.)
    }
  };

  // Handle message selection
  const toggleMessageSelect = (messageId) => {
    const newSelection = new Set(selectedMessages);
    if (newSelection.has(messageId)) {
      newSelection.delete(messageId);
    } else {
      newSelection.add(messageId);
    }
    
    setSelectedMessages(newSelection);
    setIsSelectionMode(newSelection.size > 0);
  };

  // Handle reply to message
  const handleReply = (message) => {
    setReplyingTo(message);
    // Optionally focus the input
    document.querySelector('.message-input')?.focus();
  };

  // Handle media view
  const openMediaViewer = (media) => {
    setSelectedMedia(media);
    setShowMediaViewer(true);
  };

  // Handle call start
  const handleStartCall = (isVideo = false) => {
    if (!otherUser) return;
    
    startCall({
      recipientId: otherUser.id,
      isVideo,
      onCallEnd: () => {
        // Handle call end
      }
    });
  };

  if (loading && !messages.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Chat Header */}
      <ChatHeader 
        user={otherUser} 
        onBack={() => navigate(-1)}
        onCall={() => handleStartCall(false)}
        onVideoCall={() => handleStartCall(true)}
        onMenuToggle={() => {}}
      />
      
      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4" ref={listRef}>
        {hasMore && (
          <button 
            onClick={loadMoreMessages}
            className="w-full text-center py-2 text-sm text-gray-500 hover:text-blue-500"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load more messages'}
          </button>
        )}
        
        <MessageList 
          messages={messages}
          currentUserId={currentUser?.id}
          onSelectMessage={toggleMessageSelect}
          onReply={handleReply}
          selectedMessages={selectedMessages}
          isSelectionMode={isSelectionMode}
          onMediaClick={openMediaViewer}
        />
        
        {isOtherTyping && (
          <TypingIndicator user={otherUser} />
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
        {replyingTo && (
          <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded-t-lg mb-2">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Replying to {replyingTo.sender_id === currentUser?.id ? 'yourself' : otherUser?.name}
            </div>
            <button 
              onClick={() => setReplyingTo(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        )}
        
        <MessageInput 
          onSend={handleSendMessage}
          onTyping={handleTyping}
          disabled={!chatId}
        />
      </div>
      
      {/* Media Viewer Modal */}
      {showMediaViewer && selectedMedia && (
        <MediaViewer 
          media={selectedMedia}
          onClose={() => setShowMediaViewer(false)}
        />
      )}
    </div>
  );
};

export default Chat;
