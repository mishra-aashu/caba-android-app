import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../hooks/useAuth';
import { dpOptions } from '../../utils/dpOptions';
import { Phone, Video, User, Bell, BellOff, Search, Image, Palette, Clock, Settings as SettingsIcon, Trash2, Ban, ArrowDown, ArrowLeft, ArrowRight, Copy, Edit } from 'lucide-react';
import DropdownMenu from '../common/DropdownMenu';
import Modal from '../common/Modal';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import MediaViewer from '../media/MediaViewer';
import MessagingLoader from '../MessagingLoader';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useTypingIndicator } from '../../hooks/useRealtimeTyping';
import { useMessageStatusUpdates } from '../../hooks/useMessageStatusUpdates';
import NotificationSound from '../../utils/notificationSound';
import '../../styles/chat.css';
import '../../styles/layout-fixes.css';
import './AttachmentMenu.css';

const Chat = () => {
   const { chatId, otherUserId, userId } = useParams();
   const navigate = useNavigate();
   const { supabase } = useSupabase();
   const { chatTheme, chatThemes, selectTheme, setChatId, setScrollPercentage } = useChatTheme();
   const { startCall } = useCall();
   const { user: currentUser, loading: authLoading, isAuthenticated } = useAuth();

   // Initialize chat theme when chatId changes
   useEffect(() => {
     if (chatId) {
       setChatId(chatId);
     }
   }, [chatId, setChatId]);
   // State
   const [messages, setMessages] = useState([]);
   const [otherUser, setOtherUser] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
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

  // Refs
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Realtime hooks - only activate when we have a valid chat ID
  const validChatId = chatId && chatId !== 'new' ? chatId : null;

  const handleNewMessage = useCallback((newMessage) => {
    setMessages(prev => {
      // Check if message already exists to prevent duplicates
      const exists = prev.some(msg => msg.id === newMessage.id);
      if (exists) return prev;
      return [...prev, newMessage];
    });

    // Play notification sound for incoming messages
    if (newMessage.sender_id !== currentUser?.id && !isMuted) {
      NotificationSound.playMessageNotification();
    }

    // Increment unread count if not scrolled to bottom
    if (!isScrolledToBottom) {
      setUnreadCount(prev => prev + 1);
    } else {
      markMessagesAsRead();
    }
  }, [isScrolledToBottom, currentUser?.id, isMuted]);

  useRealtimeMessages(validChatId, handleNewMessage, currentUser?.id);

  const { isOtherUserTyping, sendTypingStatus } = useTypingIndicator(validChatId, currentUser?.id);

  const handleStatusUpdate = useCallback((updatedMessage) => {
    setMessages(prev => prev.map(msg =>
      msg.id === updatedMessage.id ? updatedMessage : msg
    ));
  }, []);

  useMessageStatusUpdates(validChatId, handleStatusUpdate);

  // Initialize chat when auth is ready
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!authLoading && isAuthenticated && currentUser) {
      initializeChat();
    }

    return () => {
      cleanup();
    };
  }, [chatId, otherUserId, userId, authLoading, isAuthenticated, currentUser]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load mute and temp chat preferences
  useEffect(() => {
    const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
    setIsMuted(!!mutedChats[chatId]);

    const tempChats = JSON.parse(localStorage.getItem('tempChats') || '{}');
    setIsTempChat(!!tempChats[chatId]);
  }, [chatId, currentUser]);

  const initializeChat = async () => {
    try {
      // Handle new chat creation
      if (userId && (!chatId || chatId === 'new')) {
        await handleNewChat(currentUser, userId);
      } else if (chatId && otherUserId) {
        await loadOtherUserInfo(otherUserId);
        await loadMessages();
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  };

  const cleanup = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleNewChat = async (currentUser, targetUserId) => {
    try {
      // Check if chat already exists between current user and target user
      const { data: existingChat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${currentUser.id})`)
        .single();

      if (existingChat && !chatError) {
        // Chat exists, redirect to it
        navigate(`/chat/${existingChat.id}/${targetUserId}`, { replace: true });
        return;
      }

      // Create new chat
      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert([{
          user1_id: currentUser.id,
          user2_id: targetUserId,
          last_message: null,
          last_message_time: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) throw createError;

      // Redirect to the new chat
      navigate(`/chat/${newChat.id}/${targetUserId}`, { replace: true });
    } catch (error) {
      console.error('Error handling new chat:', error);
      navigate('/', { replace: true });
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
      // First check all messages in database
      const { data: allMessages, error: allError } = await supabase
        .from('messages')
        .select('*')
        .limit(10);

      // Then check messages for this chat
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(messagesData || []);
      await markMessagesAsRead();
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };




  const handleBlockUser = async () => {
    const confirmed = window.confirm(`Block ${otherUser.name}? They won't be able to message or call you.`);
    if (!confirmed || !currentUser) return;

    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert([{
          blocker_id: currentUser.id,
          blocked_id: otherUser.id
        }]);

      if (error) throw error;
      navigate('/');
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };


  const sendMessage = async (content, mediaData = null) => {
    if ((!content.trim() && !mediaData) || !currentUser) return;

    try {
      const newMessage = {
        id: crypto.randomUUID(),
        chat_id: chatId,
        sender_id: currentUser.id,
        receiver_id: otherUserId,
        content: content.trim() || (mediaData ? mediaData.fileName : ''),
        message_type: mediaData ? mediaData.mediaType : 'text',
        is_read: false
      };

      // Add media fields if present
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

      if (data && data[0]) {
        setMessages(prev => [...prev, data[0]]);
      }

      // Update chat's last message
      const lastMessageText = mediaData ?
        `📎 ${mediaData.fileName}` :
        content.substring(0, 50);

      await supabase
        .from('chats')
        .update({
          last_message: lastMessageText,
          last_message_time: new Date().toISOString()
        })
        .eq('id', chatId);

      setReplyingTo(null);
      // Play notification sound when sending message
      NotificationSound.playMessageNotification();
      // Typing status is automatically handled by the hook when input stops
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };


  const handleTyping = () => {
    sendTypingStatus(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 3000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledToBottom(true);
  };

  const markMessagesAsRead = useCallback(async () => {
    try {
      if (!currentUser || !chatId || chatId === 'new') return;

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUser, chatId, supabase]);

  const handleReply = (message) => {
    setReplyingTo(message);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleMessageSelect = (messageId) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }

      // Set selection mode if any messages selected
      setIsSelectionMode(newSet.size > 0);

      return newSet;
    });
  };

  const exitSelectionMode = () => {
    setSelectedMessages(new Set());
    setIsSelectionMode(false);
  };

  const handleSelectionDelete = () => {
    if (selectedMessages.size === 0) return;
    setShowDeleteModal(true);
  };

  const confirmSelectionDelete = async () => {
    setShowDeleteModal(false);

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .in('id', Array.from(selectedMessages));

      if (error) throw error;

      // Remove deleted messages from UI
      setMessages(prev => prev.filter(m => !selectedMessages.has(m.id)));

      exitSelectionMode();
    } catch (error) {
      console.error('Error deleting messages:', error);
      alert('Failed to delete messages');
    }
  };

  const cancelSelectionDelete = () => {
    setShowDeleteModal(false);
  };

  const handleSelectionForward = () => {
    // Copy selected messages to clipboard for forwarding
    const selectedMsgs = messages.filter(msg => selectedMessages.has(msg.id));
    const forwardText = selectedMsgs.map(msg => `${msg.sender_id === currentUser.id ? 'You' : otherUser.name}: ${msg.content}`).join('\n\n');
    navigator.clipboard.writeText(`Forwarded messages:\n\n${forwardText}`);
    exitSelectionMode();
    alert('Messages copied to clipboard for forwarding');
  };

  const handleSelectionCopy = () => {
    const selectedMsgs = messages.filter(msg => selectedMessages.has(msg.id));
    const copyText = selectedMsgs.map(msg => msg.content).join('\n\n');
    navigator.clipboard.writeText(copyText);
    exitSelectionMode();
    alert('Messages copied to clipboard');
  };

  const handleSelectionEdit = () => {
    // Only allow edit if single message and it's user's message
    if (selectedMessages.size !== 1) return;

    const messageId = Array.from(selectedMessages)[0];
    const message = messages.find(msg => msg.id === messageId);

    if (message && message.sender_id === currentUser.id) {
      // Trigger edit mode for that message
      setReplyingTo(null); // Clear reply if any
      // We'll pass onEdit to MessageList
      exitSelectionMode();
    }
  };

  const handleViewContact = () => {
    if (!otherUserId || otherUserId === 'undefined') {
      alert('User information not available');
      return;
    }
    navigate(`/user-details/${otherUserId}`);
  };

  const handleCreateReminder = () => {
    navigate(`/create-reminder?userId=${otherUserId}`);
  };

  const handleMuteToggle = async () => {
    try {
      const newMutedState = !isMuted;
      const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
      if (newMutedState) {
        mutedChats[chatId] = true;
      } else {
        delete mutedChats[chatId];
      }
      localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
      setIsMuted(newMutedState);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const handleSearchMessages = () => {
    setShowSearchModal(true);
  };

  const performMessageSearch = async (query) => {
    if (!query.trim() || !chatId) return;

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching messages:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchQueryChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim()) {
      performMessageSearch(query);
    } else {
      setSearchResults([]);
    }
  };

  const scrollToMessage = (messageId) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
      setTimeout(() => {
        messageElement.style.backgroundColor = '';
      }, 2000);
    }
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleChangeTheme = () => {
    setShowThemeModal(true);
  };

  const handleThemeSelect = async (themeKey) => {
    await selectTheme(themeKey);
    setShowThemeModal(false);
  };

  const handleTempChatToggle = async () => {
    try {
      const newTempChatState = !isTempChat;
      const tempChats = JSON.parse(localStorage.getItem('tempChats') || '{}');
      if (newTempChatState) {
        tempChats[chatId] = {
          enabled: true,
          duration: 24 * 60 * 60 * 1000
        };
      } else {
        delete tempChats[chatId];
      }
      localStorage.setItem('tempChats', JSON.stringify(tempChats));
      setIsTempChat(newTempChatState);
    } catch (error) {
      console.error('Error toggling temp chat:', error);
    }
  };

  const handleTempChatSettings = () => {
    alert('Temp chat settings coming soon!');
  };

  const handleClearChat = async () => {
    const confirmed = window.confirm('Clear all messages in this chat? This cannot be undone.');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId);

      if (error) throw error;

      setMessages([]);

      await supabase
        .from('chats')
        .update({
          last_message: null,
          last_message_time: new Date().toISOString()
        })
        .eq('id', chatId);
    } catch (error) {
      console.error('Error clearing chat:', error);
      alert('Failed to clear chat. Please try again.');
    }
  };

  const handleVoiceCall = async () => {
    try {
      const { callId } = await startCall(otherUser.id, 'voice');
      navigate(`/call/${callId}`);
    } catch (error) {
      console.error('Failed to start voice call:', error);
      alert('Failed to start call: ' + error.message);
    }
  };

  const handleVideoCall = async () => {
    try {
      const { callId } = await startCall(otherUser.id, 'video');
      navigate(`/call/${callId}`);
    } catch (error) {
      console.error('Failed to start video call:', error);
      alert('Failed to start call: ' + error.message);
    }
  };

  const handleScroll = (e) => {
    const container = e.target;
    const scrolledFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = scrolledFromBottom < 50; // Consider "at bottom" if within 50px

    setShowScrollButton(scrolledFromBottom > 300);
    setIsScrolledToBottom(isAtBottom);

    // Calculate scroll percentage
    if (container.scrollHeight > container.clientHeight) {
      const scrollPercentage = (container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100;
      setScrollPercentage(scrollPercentage);
    } else {
      setScrollPercentage(0);
    }

    // If scrolled to bottom, mark messages as read and reset unread count
    if (isAtBottom && unreadCount > 0) {
      setUnreadCount(0);
      markMessagesAsRead();
    }
  };

  const scrollToBottomSmooth = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
    setUnreadCount(0);
    setIsScrolledToBottom(true);
    markMessagesAsRead();
  };

  const handleMediaView = (mediaUrl, mediaType, message) => {
    // For now, we'll use the media URL directly
    // In a more complete implementation, we'd get the media ID from the message
    const fileInfo = {
      file_name: message.file_name || 'Unknown',
      file_size: message.file_size || 0,
      mime_type: message.media_type || 'image/jpeg',
      storage_url: mediaUrl,
      file_type: mediaType
    };

    setCurrentMediaInfo({ fileInfo });
    setMediaViewerOpen(true);
  };

  const handleMediaDownload = async (mediaUrl, messageId) => {
    try {
      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = mediaUrl;
      link.download = `media_${messageId}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download media');
    }
  };

  if (!otherUser || !currentUser) {
    return <MessagingLoader />;
  }

  return (
    <div className="chat-screen">
      {/* Chat Header */}
      <header className="chat-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>

        <div className="chat-user-info" onClick={handleViewContact} style={{ cursor: 'pointer' }}>
          <div className="user-avatar">
            {otherUser.avatar ? (
              parseInt(otherUser.avatar) ? (
                <img src={dpOptions.find(dp => dp.id === parseInt(otherUser.avatar))?.path || otherUser.avatar} alt={otherUser.name} />
              ) : (
                <img src={otherUser.avatar} alt={otherUser.name} />
              )
            ) : (
              otherUser.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="user-details">
            <h3 className="user-name">{otherUser.name}</h3>
            <p className="user-status">
              {isOtherUserTyping ? 'typing...' : otherUser.is_online ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        <div className="chat-actions">
          <button className="icon-btn" onClick={handleVoiceCall} title="Voice Call">
            <Phone size={20} />
          </button>
          <button className="icon-btn" onClick={handleVideoCall} title="Video Call">
            <Video size={20} />
          </button>

          <DropdownMenu
            items={[
              {
                icon: <User size={16} />,
                label: 'View Contact',
                onClick: handleViewContact
              },
              {
                icon: <Bell size={16} />,
                label: 'Create Reminder',
                onClick: handleCreateReminder
              },
              {
                icon: isMuted ? <Bell size={16} /> : <BellOff size={16} />,
                label: isMuted ? 'Unmute Notifications' : 'Mute Notifications',
                onClick: handleMuteToggle
              },
              {
                icon: <Search size={16} />,
                label: 'Search Messages',
                onClick: handleSearchMessages
              },
              {
                icon: <Palette size={16} />,
                label: 'Themes',
                onClick: handleChangeTheme
              },
              { divider: true },
              {
                icon: <Clock size={16} />,
                label: isTempChat ? 'Disable Temporary Chat' : 'Enable Temporary Chat',
                onClick: handleTempChatToggle
              },
              {
                icon: <SettingsIcon size={16} />,
                label: 'Temp Chat Settings',
                onClick: handleTempChatSettings,
                disabled: !isTempChat
              },
              {
                icon: <Trash2 size={16} />,
                label: 'Clear Chat',
                onClick: handleClearChat
              },
              { divider: true },
              {
                icon: <Ban size={16} />,
                label: 'Block User',
                onClick: handleBlockUser,
                danger: true
              }
            ]}
          />
        </div>
      </header>

      {/* Selection Toolbar */}
      {isSelectionMode && (
        <div className="selection-toolbar">
          <button className="selection-close-btn" onClick={exitSelectionMode}>
            ✕
          </button>
          <div className="selection-info">
            {selectedMessages.size} selected
          </div>
          <div className="selection-actions">
            <button className="selection-action-btn" title="Copy" onClick={handleSelectionCopy}>
              <Copy size={16} />
            </button>
            <button className="selection-action-btn" title="Forward" onClick={handleSelectionForward}>
              <ArrowRight size={16} />
            </button>
            <button className="selection-action-btn" title="Delete" onClick={handleSelectionDelete}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div
        className="messages-container"
        onScroll={handleScroll}
        ref={messagesContainerRef}
      >
        <MessageList
          messages={messages}
          currentUser={currentUser}
          selectedMessages={selectedMessages}
          isSelectionMode={isSelectionMode}
          onMessageSelect={handleMessageSelect}
          onReply={handleReply}
          onDelete={(messageId) => setMessages(prev => prev.filter(m => m.id !== messageId))}
          onMediaView={handleMediaView}
          onMediaDownload={handleMediaDownload}
        />

        <TypingIndicator isVisible={isOtherUserTyping} />

        <div ref={messagesEndRef} />

        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <button className="scroll-bottom-btn" onClick={scrollToBottomSmooth}>
            <ArrowDown size={20} />
            {unreadCount > 0 && (
              <span className="unread-count">{unreadCount}</span>
            )}
          </button>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={sendMessage}
        onTyping={handleTyping}
        replyingTo={replyingTo}
        onCancelReply={cancelReply}
        chatId={chatId}
        receiverId={otherUserId}
      />


      {/* Message Search Modal */}
      <Modal
        isOpen={showSearchModal}
        onClose={() => {
          setShowSearchModal(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
        title="Search Messages"
        size="medium"
      >
        <div className="search-modal-content">
          <div className="search-input-container">
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={handleSearchQueryChange}
              className="search-input"
              autoFocus
            />
          </div>

          <div className="search-results">
            {isSearching ? (
              <MessagingLoader />
            ) : searchResults.length > 0 ? (
              searchResults.map(message => (
                <div
                  key={message.id}
                  className="search-result-item"
                  onClick={() => scrollToMessage(message.id)}
                >
                  <div className="search-result-content">
                    {message.content}
                  </div>
                  <div className="search-result-time">
                    {new Date(message.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : searchQuery.trim() ? (
              <div className="no-results">No messages found</div>
            ) : (
              <div className="search-placeholder">Type to search messages</div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={cancelSelectionDelete}
        title={`Delete ${selectedMessages.size} message(s)?`}
        size="small"
      >
        <div className="delete-confirmation-content">
          <p>Are you sure you want to delete the selected messages? This action cannot be undone.</p>
          <div className="delete-modal-actions">
            <button className="delete-cancel-btn" onClick={cancelSelectionDelete}>
              Cancel
            </button>
            <button className="delete-confirm-btn" onClick={confirmSelectionDelete}>
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Theme Selector Modal */}
      <Modal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        title="Choose Theme"
        size="large"
      >
        <div className="theme-selector">
          <div className="theme-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '20px' }}>
            {Object.entries(chatThemes).map(([key, theme]) => (
              <div
                key={key}
                className={`theme-card ${chatTheme === key ? 'active' : ''}`}
                onClick={() => handleThemeSelect(key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  transform: chatTheme === key ? 'scale(1.05)' : 'scale(1)',
                  filter: chatTheme === key ? 'brightness(1.1)' : 'brightness(1)'
                }}
              >
                <div
                  className="theme-preview-card"
                  style={{
                    width: '120px',
                    height: '80px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: chatTheme === key ? '3px solid #25d366' : '2px solid rgba(0,0,0,0.1)',
                    boxShadow: chatTheme === key ? '0 8px 25px rgba(37, 211, 102, 0.3)' : '0 4px 15px rgba(0,0,0,0.1)',
                    position: 'relative',
                    background: 'white'
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: '65%',
                    background: theme.background,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}></div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    height: '35%',
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '10px',
                      borderRadius: '6px',
                      background: theme.sentMessage.background,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}></div>
                    <div style={{
                      width: '32px',
                      height: '10px',
                      borderRadius: '6px',
                      background: theme.receivedMessage.background,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}></div>
                  </div>
                  {chatTheme === key && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #25d366, #128c7e)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}>
                      ✓
                    </div>
                  )}
                </div>
                <div
                  className="theme-name"
                  style={{
                    marginTop: '12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: chatTheme === key ? '#25d366' : '#374151',
                    textAlign: 'center',
                    fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                    letterSpacing: '0.3px',
                    lineHeight: '1.2',
                    textShadow: chatTheme === key ? '0 1px 3px rgba(37, 211, 102, 0.2)' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {theme.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Media Viewer */}
      <MediaViewer
        isOpen={mediaViewerOpen}
        onClose={() => {
          setMediaViewerOpen(false);
          setCurrentMediaInfo(null);
        }}
        mediaId={currentMediaInfo?.mediaId}
        fileInfo={currentMediaInfo?.fileInfo}
      />

    </div>
  );
};
 
export default Chat;
