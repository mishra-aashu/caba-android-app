import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../hooks/useAuth';
import { dpOptions } from '../../utils/dpOptions';
import { saveMessagesToDevice, loadMessagesFromDevice } from '../../utils/FileSystemManager';
import { Phone, Video, User, Bell, BellOff, Search, Image, Palette, Clock, Settings as SettingsIcon, Trash2, Ban, ArrowDown, ArrowLeft, ArrowRight, Copy, Edit, Reply } from 'lucide-react';
import DropdownMenu from '../common/DropdownMenu';
import Modal from '../common/Modal';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import MediaViewer from '../media/MediaViewer';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useTypingIndicator } from '../../hooks/useRealtimeTyping';
import { useMessageStatusUpdates } from '../../hooks/useMessageStatusUpdates';
import { useChatListRealtime } from '../../hooks/useChatListRealtime';
import ForwardModal from './ForwardModal';
import { formatLastSeen, isUserOnline } from '../../utils/timeUtils';
import NotificationSound from '../../utils/notificationSound';
import toast from 'react-hot-toast';
import '../../styles/chat.css';

import './AttachmentMenu.css';

const Chat = () => {
    const { chatId, otherUserId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { supabase } = useSupabase();
    const { chatTheme, chatThemes, selectTheme, setChatId, setScrollPercentage } = useChatTheme();
    const { user: currentUser, session, loading: authLoading, isAuthenticated } = useAuth();
    const { startCall } = useCall();

   // Initialize chat theme when chatId changes
   useEffect(() => {
     if (chatId) {
       setChatId(chatId);
     }
   }, [chatId, setChatId]);
   // State
   const [messages, setMessages] = useState([]);
   const [otherUser, setOtherUser] = useState(null);
   const [loading, setLoading] = useState(true);
   const [hasMoreMessages, setHasMoreMessages] = useState(true);
   const [loadingMore, setLoadingMore] = useState(false);
   const [isMuted, setIsMuted] = useState(false);
   const [isTempChat, setIsTempChat] = useState(false);
   const [showScrollButton, setShowScrollButton] = useState(false);
   const [unreadCount, setUnreadCount] = useState(0);
   const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
   const [showSearchModal, setShowSearchModal] = useState(false);
   const [searchQuery, setSearchQuery] = useState('');
   const [searchResults, setSearchResults] = useState([]);
   const [isSearching, setIsSearching] = useState(false);
   const [showDeleteModal, setShowDeleteModal] = useState(false);
   const [selectedMessages, setSelectedMessages] = useState(new Set());
   const [isSelectionMode, setIsSelectionMode] = useState(false);
   const [showThemeModal, setShowThemeModal] = useState(false);
   const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
   const [currentMediaInfo, setCurrentMediaInfo] = useState(null);
   const [replyingTo, setReplyingTo] = useState(null);
   const [showForwardModal, setShowForwardModal] = useState(false);
   const [messagesToForward, setMessagesToForward] = useState([]);

   const messagesEndRef = useRef(null);
   const messagesContainerRef = useRef(null);
   const typingTimeoutRef = useRef(null);

   const validChatId = chatId === 'new' ? null : chatId;

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

  const { chats: allChats } = useChatListRealtime(currentUser?.id);

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
  }, [chatId, otherUserId, authLoading, isAuthenticated, currentUser]);

  // Scroll to bottom when messages change (only if user is already at bottom)
  useEffect(() => {
    if (isScrolledToBottom) {
      scrollToBottom();
    }
  }, [messages, isScrolledToBottom]);

  // Load mute and temp chat preferences
  useEffect(() => {
    const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
    setIsMuted(!!mutedChats[chatId]);

    const tempChats = JSON.parse(localStorage.getItem('tempChats') || '{}');
    setIsTempChat(!!tempChats[chatId]);
  }, [chatId, currentUser]);

  // Subscribe to real-time updates for other user's online status
  useEffect(() => {
    if (!otherUserId) return;

    const subscription = supabase
      .channel(`user_status_${otherUserId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${otherUserId}`
      }, (payload) => {
        const updatedUser = payload.new;
        setOtherUser(prev => ({
          ...prev,
          is_online: Boolean(updatedUser.is_online),
          last_seen: updatedUser.last_seen
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [otherUserId]);

  const loadMessages = async (isLoadMore = false) => {
    if (!chatId || chatId === 'new') return;

    if (isLoadMore) {
      setLoadingMore(true);
    }

    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false }); // Load latest first for pagination

      if (isLoadMore && messages.length > 0) {
        const oldestMessage = messages[0]; // Since messages are in ascending order
        query = query.lt('created_at', oldestMessage.created_at);
      }

      query = query.limit(50); // Load 50 messages at a time

      const { data, error } = await query;

      if (error) throw error;

      const newMessages = data || [];

      if (isLoadMore) {
        const combined = [...newMessages.reverse(), ...messages]; // Reverse because we loaded descending
        setMessages(combined);
        await saveMessagesToDevice(chatId, combined);
        setHasMoreMessages(newMessages.length === 50);
      } else {
        const reversed = newMessages.reverse(); // To ascending order
        setMessages(reversed);
        await saveMessagesToDevice(chatId, reversed);
        setHasMoreMessages(newMessages.length === 50);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreMessages = () => {
    if (chatId && hasMoreMessages && !loadingMore) {
      loadMessages(true);
    }
  };

  const initializeChat = async () => {
    if (chatId && otherUserId) {
      await loadOtherUserInfo(otherUserId);
      await loadMessages();
    }
  };

  const cleanup = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
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

      // Load contact name
      const { data: contact } = await supabase
        .from('contacts')
        .select('contact_name')
        .eq('user_id', currentUser.id)
        .eq('contact_user_id', userId)
        .maybeSingle();

      if (contact) {
        setOtherUser(prev => ({ ...prev, contact_name: contact.contact_name }));
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };




  const handleBlockUser = async () => {
    const confirmed = window.confirm(`Block ${otherUser.name}? They won't be able to message or call you.`);
    if (!confirmed || !currentUser) return;

    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert([
          {
          blocker_id: currentUser.id,
          blocked_id: otherUser.id
        }]);

      if (error) throw error;
      navigate('/');
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };


  const sendMessage = async (content) => {
    if (!content.trim() || !currentUser) return;

    try {
      const newMessage = {
        chat_id: validChatId,
        sender_id: currentUser.id,
        receiver_id: otherUserId,
        content: content.trim(),
        // All media-related columns will be null for text messages
        media_path: null,
        media_type: null,
        reply_to: replyingTo ? replyingTo.id : null,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(newMessage)
        .select()
        .single();

      if (error) throw error;

      // No need to manually add to state, realtime subscription will handle it.
      // setMessages(prev => [...prev, data]);
      
      setReplyingTo(null);
      NotificationSound.playMessageNotification();

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message.');
    }
  };

  const handleSendMedia = async (mediaPath, mediaType) => {
    if (!mediaPath || !currentUser) return;

    try {
      const content = mediaType === 'image' ? '📷 Photo'
        : mediaType === 'video' ? '🎥 Video'
        : '🎤 Voice Message';
      
      const newMessage = {
        chat_id: validChatId,
        sender_id: currentUser.id,
        receiver_id: otherUserId,
        content: content,
        media_path: mediaPath,
        media_type: mediaType,
        reply_to: replyingTo ? replyingTo.id : null,
      };

      const { error } = await supabase
        .from('messages')
        .insert(newMessage);

      if (error) throw error;
      
      setReplyingTo(null);
      NotificationSound.playMessageNotification();

    } catch (error) {
      console.error('Error sending media message:', error);
      toast.error('Failed to send media.');
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

  const handleForwardMessages = async (messages, targetChat) => {
    try {
      for (const message of messages) {
        const forwardMessage = {
          chat_id: targetChat.id,
          sender_id: currentUser.id,
          receiver_id: targetChat.otherUser.id,
          content: `Forwarded: ${message.content}`,
          media_path: message.media_path,
          media_type: message.media_type,
          reply_to: null,
        };

        const { error } = await supabase
          .from('messages')
          .insert(forwardMessage);

        if (error) throw error;
      }

      toast.success(`Message${messages.length > 1 ? 's' : ''} forwarded successfully`);
    } catch (error) {
      console.error('Error forwarding messages:', error);
      toast.error('Failed to forward messages');
    }
  };

  const handleForwardMessage = (message) => {
    setMessagesToForward([message]);
    setShowForwardModal(true);
  };

  const handleSelectionForward = () => {
    const selectedMsgs = messages.filter(msg => selectedMessages.has(msg.id));
    setMessagesToForward(selectedMsgs);
    setShowForwardModal(true);
    exitSelectionMode();
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
    const isAtTop = container.scrollTop < 50; // Consider "at top" if within 50px

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

    // Load more messages when scrolled to top
    if (isAtTop && hasMoreMessages && !loadingMore && messages.length > 0) {
      loadMoreMessages();
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
    return (
      <div className="chat-loading">
        <div className="loading-spinner"></div>
        <p>Loading chat...</p>
      </div>
    );
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
            <h3 className="user-name">{otherUser.contact_name || otherUser.name}</h3>
            <p className="user-status">
              {isOtherUserTyping ? 'typing...' : isUserOnline(Boolean(otherUser.is_online), otherUser.last_seen) ? 'Online' : `Last seen ${formatLastSeen(otherUser.last_seen)}`}
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
            {selectedMessages.size === 1 && (
              <>
                <button
                  className="selection-action-btn"
                  title="Reply"
                  onClick={() => {
                    const messageId = Array.from(selectedMessages)[0];
                    const message = messages.find(msg => msg.id === messageId);
                    if (message) handleReply(message);
                    exitSelectionMode();
                  }}
                >
                  <Reply size={16} />
                </button>
                <button className="selection-action-btn" title="Copy" onClick={handleSelectionCopy}>
                  <Copy size={16} />
                </button>
                <button className="selection-action-btn" title="Forward" onClick={handleSelectionForward}>
                  <ArrowRight size={16} />
                </button>
                {Array.from(selectedMessages).every(messageId => {
                  const message = messages.find(msg => msg.id === messageId);
                  return message && message.sender_id === currentUser?.id;
                }) && (
                  <button className="selection-action-btn" title="Delete" onClick={handleSelectionDelete}>
                    <Trash2 size={16} />
                  </button>
                )}
              </>
            )}
            {selectedMessages.size > 1 && (
              <>
                <button className="selection-action-btn" title="Copy" onClick={handleSelectionCopy}>
                  <Copy size={16} />
                </button>
                <button className="selection-action-btn" title="Forward" onClick={handleSelectionForward}>
                  <ArrowRight size={16} />
                </button>
                <button className="selection-action-btn" title="Delete" onClick={handleSelectionDelete}>
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div
        className="messages-container"
        onScroll={handleScroll}
        ref={messagesContainerRef}
      >
        {/* Load More Indicator */}
        {loadingMore && (
          <div className="load-more-indicator">
            <div className="loading-spinner"></div>
            <p>Loading more messages...</p>
          </div>
        )}

        <MessageList
          messages={messages}
          currentUser={currentUser}
          selectedMessages={selectedMessages}
          isSelectionMode={isSelectionMode}
          onMessageSelect={handleMessageSelect}
          onReply={handleReply}
          onForward={handleForwardMessage}
          onDelete={(messageId) => setMessages(prev => prev.filter(m => m.id !== messageId))}
          onMediaView={handleMediaView}
          onMediaDownload={handleMediaDownload}
          isLoading={loading}
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
        onSendMedia={handleSendMedia} // Pass the new media handler
        onTyping={handleTyping}
        replyingTo={replyingTo}
        onCancelReply={cancelReply}
        chatId={chatId}
        receiverId={otherUserId}
        currentUser={currentUser} // Pass the current user object
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
              <div className="search-loading">
                <div className="loading-spinner"></div>
                <p>Searching...</p>
              </div>
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

      {/* Forward Modal */}
      <ForwardModal
        isOpen={showForwardModal}
        onClose={() => {
          setShowForwardModal(false);
          setMessagesToForward([]);
        }}
        chats={allChats}
        messagesToForward={messagesToForward}
        onForward={handleForwardMessages}
        currentUser={currentUser}
      />

    </div>
  );
};
 
export default Chat;