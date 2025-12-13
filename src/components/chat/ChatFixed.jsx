import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { useCall } from '../../context/CallContext';
import { useAuthFlow } from '../../hooks/useAuthFlow';
import { Phone, Video, User, Bell, BellOff, Search, Image, Palette, Clock, Settings as SettingsIcon, Trash2, Ban, ArrowDown, ArrowLeft, ArrowRight, Copy } from 'lucide-react';
import DropdownMenu from '../common/DropdownMenu';
import Modal from '../common/Modal';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import MediaViewer from '../media/MediaViewer';
import MessagingLoader from '../MessagingLoader';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import AuthDebug from '../AuthDebug';
import { useTypingIndicator } from '../../hooks/useRealtimeTyping';
import { useMessageStatusUpdates } from '../../hooks/useMessageStatusUpdates';
import '../../styles/chat.css';
import './AttachmentMenu.css';

import { dpOptions } from '../../utils/dpOptions';

const Chat = () => {
  const { chatId, otherUserId } = useParams();
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const { chatTheme, chatThemes, selectTheme, setChatId, setScrollPercentage } = useChatTheme();
  const { startCall } = useCall();
  
  // Use centralized auth flow
  const { user: authUser, loading: authLoading, isAuthenticated } = useAuthFlow();

  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isTempChat, setIsTempChat] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [currentMediaInfo, setCurrentMediaInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Initialize chat theme
  useEffect(() => {
    if (chatId) setChatId(chatId);
  }, [chatId, setChatId]);

  // Load mute and temp chat preferences
  useEffect(() => {
    const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
    setIsMuted(!!mutedChats[chatId]);

    const tempChats = JSON.parse(localStorage.getItem('tempChats') || '{}');
    setIsTempChat(!!tempChats[chatId]);
  }, [chatId]);

  // Main initialization - only when auth is ready
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !authUser) {
      navigate('/login');
      return;
    }

    initializeChat();
  }, [authLoading, isAuthenticated, authUser, chatId, otherUserId]);

  const initializeChat = async () => {
    try {
      if (!chatId || !otherUserId) {
        setLoading(false);
        return;
      }

      await Promise.all([
        loadOtherUserInfo(otherUserId),
        loadMessages()
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Error initializing chat:', error);
      setLoading(false);
    }
  };

  const loadOtherUserInfo = async (userId) => {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setOtherUser(user);
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const loadMessages = async () => {
    try {
      if (!chatId || !authUser?.id) return;

      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const validMessages = Array.isArray(messagesData) ? messagesData : [];
      setMessages(validMessages);

      if (validMessages.length > 0) {
        await markMessagesAsRead();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };


  const sendMessage = async (content, mediaData = null) => {
    if (!content.trim() && !mediaData) return;
    if (!authUser?.id) {
      alert('Please log in to send messages');
      return;
    }

    try {
      const newMessage = {
        id: crypto.randomUUID(),
        chat_id: chatId,
        sender_id: authUser.id,
        receiver_id: otherUserId,
        content: content.trim() || (mediaData ? mediaData.fileName : ''),
        message_type: mediaData ? mediaData.mediaType : 'text',
        is_read: false,
        is_delivered: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (mediaData) {
        newMessage.media_url = mediaData.mediaUrl;
        newMessage.media_type = mediaData.mediaType;
        newMessage.file_name = mediaData.fileName;
        newMessage.file_size = mediaData.fileSize;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert([newMessage])
        .select();

      if (error) throw error;

      if (data?.[0]) setMessages(prev => [...prev, data[0]]);

      await supabase
        .from('chats')
        .update({
          last_message: content.substring(0, 50),
          last_message_time: new Date().toISOString()
        })
        .eq('id', chatId);

      setReplyingTo(null);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const markMessagesAsRead = useCallback(async () => {
    try {
      if (!authUser?.id) return;

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .eq('receiver_id', authUser.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [authUser?.id, chatId, supabase]);

  const handleNewMessage = useCallback((newMessage) => {
    setMessages(prev => [...prev, newMessage]);
    if (!isScrolledToBottom) {
      setUnreadCount(prev => prev + 1);
    } else {
      markMessagesAsRead();
    }
  }, [isScrolledToBottom, markMessagesAsRead]);

  useRealtimeMessages(chatId, handleNewMessage);

  const { isOtherUserTyping, sendTypingStatus } = useTypingIndicator(chatId, authUser?.id);

  const handleStatusUpdate = useCallback((updatedMessage) => {
    setMessages(prev => prev.map(msg =>
      msg.id === updatedMessage.id ? updatedMessage : msg
    ));
  }, []);

  useMessageStatusUpdates(chatId, handleStatusUpdate);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledToBottom(true);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleScroll = (e) => {
    const container = e.target;
    const scrolledFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = scrolledFromBottom < 50;

    setShowScrollButton(scrolledFromBottom > 300);
    setIsScrolledToBottom(isAtBottom);

    if (container.scrollHeight > container.clientHeight) {
      const scrollPercentage = (container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100;
      setScrollPercentage(scrollPercentage);
    }

    if (isAtBottom && unreadCount > 0) {
      setUnreadCount(0);
      markMessagesAsRead();
    }
  };

  const handleTyping = () => {
    sendTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 3000);
  };

  if (!chatId) return <MessagingLoader />;
  if (authLoading || loading) return <MessagingLoader />;

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>

        <div className="chat-user-info">
          <div className="user-avatar">
            {otherUser?.avatar ? (
              <img src={otherUser.avatar} alt={otherUser.name} />
            ) : (
              otherUser?.name?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="user-details">
            <h3 className="user-name">{otherUser?.name || 'Loading...'}</h3>
            <p className="user-status">
              {isOtherUserTyping ? 'typing...' : otherUser?.is_online ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        <div className="chat-actions">
          <button className="icon-btn" onClick={() => startCall(otherUserId, 'voice')}>
            <Phone size={20} />
          </button>
          <button className="icon-btn" onClick={() => startCall(otherUserId, 'video')}>
            <Video size={20} />
          </button>
        </div>
      </header>

      <div
        className="messages-container"
        onScroll={handleScroll}
        ref={messagesContainerRef}
      >
        <MessageList
          messages={messages}
          currentUser={authUser}
          selectedMessages={selectedMessages}
          isSelectionMode={isSelectionMode}
          onMessageSelect={(id) => setSelectedMessages(prev => {
            const newSet = new Set(prev);
            newSet.has(id) ? newSet.delete(id) : newSet.add(id);
            setIsSelectionMode(newSet.size > 0);
            return newSet;
          })}
          onReply={setReplyingTo}
          onDelete={(id) => setMessages(prev => prev.filter(m => m.id !== id))}
        />

        <TypingIndicator isVisible={isOtherUserTyping} />
        <div ref={messagesEndRef} />

        {showScrollButton && (
          <button className="scroll-bottom-btn" onClick={() => {
            scrollToBottom();
            setShowScrollButton(false);
            setUnreadCount(0);
          }}>
            <ArrowDown size={20} />
            {unreadCount > 0 && <span className="unread-count">{unreadCount}</span>}
          </button>
        )}
      </div>

      <MessageInput
        onSendMessage={sendMessage}
        onTyping={handleTyping}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        chatId={chatId}
        receiverId={otherUserId}
      />


      {process.env.NODE_ENV === 'development' && authUser && (
        <div style={{ position: 'fixed', bottom: '10px', right: '10px', zIndex: 1000 }}>
          <AuthDebug />
        </div>
      )}
    </div>
  );
};

export default Chat;
