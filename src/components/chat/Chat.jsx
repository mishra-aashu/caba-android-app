import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { dpOptions } from '../../utils/dpOptions';
import { db, addToSyncQueue } from '../../db/db';
import { validateEntity, Message } from '../../types/database';
import { ArrowDown, Edit, Play, Phone, Video, Search, Image as ImageIcon, Palette, Clock, Settings as SettingsIcon, Trash2, Ban, ArrowLeft, Gamepad2 } from 'lucide-react';
import Modal from '../common/Modal';
import VirtualizedMessageList from './VirtualizedMessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import MediaViewer from '../media/MediaViewer';
import ImageViewer from './ImageViewer';
import { messageReadsService } from '../../services/messageReadsService';
import ForwardModal from './ForwardModal';
import GroupCallScreen from '../group/GroupCallScreen';
import GroupCallButton from '../group/GroupCallButton';
import GroupInfoDrawer from '../groups/GroupInfoDrawer';
import NotificationSound from '../../utils/notificationSound';
import toast from 'react-hot-toast';
import { debounce } from 'lodash';
import { Capacitor } from '@capacitor/core';
import hapticsManager from '../../utils/hapticsManager';
import { UserDetailsContext } from '../../contexts/UserDetailsContext';
import WallpaperPicker from './WallpaperPicker';
import useIsDesktop from '../../hooks/useIsDesktop';
import useChatStore from '../../store/useChatStore';
import useChatRoom from '../../hooks/chat/useChatRoom';
import ChatHeader from './parts/ChatHeader';
import ChatActionsPanel from './parts/ChatActionsPanel';
import '../../styles/chat.css';
import { getPublicMediaUrl } from '../../services/mediaService';
import '../../styles/game-modal.css';
import './AttachmentMenu.css';

const Chat = () => {
  // ─── ALL BUSINESS LOGIC IS DELEGATED TO useChatRoom ─────────────────────────
  // ─── ALL BUSINESS LOGIC IS DELEGATED TO useChatRoom ─────────────────────────
  const {
    chatId, otherUserId, validChatId, isGroupChat, navigate, location,
    currentUser, otherUser, setOtherUser, isInitializing,
    messages, isFetchingNextPage, hasNextPage, fetchNextPage,
    typingUsers, sendTyping,
    isMuted, isTempChat, setIsTempChat, vanishPresets, setVanishPresets, selectedVanishDuration, setSelectedVanishDuration,
    addStoreMessage, updateStoreMessage, removeStoreMessage, replaceTempMessage,
    sendMessage, handleSendMedia, replyingTo, handleReply, cancelReply,
    activeCallData, activeGroupCall, showGroupCallScreen, setShowGroupCallScreen,
    handleVoiceCall, handleVideoCall, handleEndGroupCall, handleStartGroupCall,
    handleMuteToggle, confirmClearChat, confirmBlockUser, confirmSelectionDelete,
    handleShareAsForward, handleMediaDownload,
    handleAcceptGame, handleRejectGame, handleJoinGame,
    supabase, showAlert, initialScrollPosition, saveScrollPosition, queryClient,
    isMessagesLoading, allChats, authLoading, isAuthenticated,
    connectionStatus,
    retryConnection
  } = useChatRoom({
    onNewMessage: (msg) => {
      // Unread logic (UI-only)
      if (!isScrolledToBottom) {
        setUnreadCount(prev => prev + 1);
      } else {
        markMessagesAsRead();
      }
    }
  });

  const onSelectionDelete = () => {
    confirmSelectionDelete(Array.from(selectedMessages), () => {
      setSelectedMessages(new Set());
      setIsSelectionMode(false);
      setShowDeleteConfirmModal(false);
    });
  };

  const onDownloadMedia = async (url, message) => {
    await handleMediaDownload(url, message);
  };

  const onShareAsForward = (message) => {
    const forwardPayload = handleShareAsForward(null, message);
    setMessagesToForward(forwardPayload);
    setShowForwardModal(true);
    setImageViewerOpen(false);
  };

  // ─── STALE LOCAL IMPORTS (kept for non-moved logic) ──────────────────────
  const { chatTheme, chatThemes, selectTheme, setChatId, setScrollPercentage } = useChatTheme();
  const isDesktop = useIsDesktop();
  const { showUserDetails } = React.useContext(UserDetailsContext) || {};

  // Initialize chat theme when chatId changes
  useEffect(() => { if (chatId) setChatId(chatId); }, [chatId, setChatId]);

  // ─── UI-ONLY STATE (stays in component) ──────────────────────────────────

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [currentMediaInfo, setCurrentMediaInfo] = useState(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [currentImageMessage, setCurrentImageMessage] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messagesToForward, setMessagesToForward] = useState([]);
  const [showGroupInfoDrawer, setShowGroupInfoDrawer] = useState(false);
  const [showVanishSettingsModal, setShowVanishSettingsModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showBlockConfirmModal, setShowBlockConfirmModal] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [showGroupCallModal, setShowGroupCallModal] = useState(false);
  const [selectedCallType, setSelectedCallType] = useState('voice');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // ─── CAPACITOR KEYBOARD: scroll to bottom when keyboard appears ──────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const setupKeyboardListeners = async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        await Keyboard.addListener('keyboardWillShow', () => {
          setTimeout(() => {
            if (messagesContainerRef.current?.scrollToBottom)
              messagesContainerRef.current.scrollToBottom('auto');
          }, 50);
        });
        return () => Keyboard.removeAllListeners();
      } catch (err) { console.warn('[Chat] Keyboard listeners failed:', err); }
    };
    let cleanup;
    setupKeyboardListeners().then(fn => { cleanup = fn; });
    return () => { if (cleanup) cleanup(); };
  }, []);

  // ─── SCROLL & READ RECEIPTS ───────────────────────────────────────────────
  const debouncedSaveScroll = useCallback(debounce((id, index) => saveScrollPosition(id, index), 500), [saveScrollPosition]);

  const markMessagesAsRead = useCallback(async () => {
    try {
      if (!currentUser || !chatId || chatId === 'new') return;
      await messageReadsService.markAllAsRead(chatId, currentUser.id);
    } catch (error) { console.error('Error marking messages as read:', error); }
  }, [currentUser, chatId]);



  const handleScroll = (location) => {
    // 1. Pagination Trigger
    if (location.isAtTop && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }

    // 2. UI State Management
    const isAtBottom = location.isAtBottom || false;
    setIsScrolledToBottom(isAtBottom);
    setShowScrollButton(!isAtBottom);

    if (isAtBottom && unreadCount > 0) {
      setUnreadCount(0);
      markMessagesAsRead();
    }
  };



  const handleBlockUser = async () => {
    setShowBlockConfirmModal(true);
  };




  const handleTyping = () => {
    sendTyping();
  };

  const scrollToBottom = () => {
    // Use VirtualizedMessageList's scrollToBottom if available
    if (messagesContainerRef.current?.scrollToBottom) {
      messagesContainerRef.current.scrollToBottom('auto');
    }
    setIsScrolledToBottom(true);
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
    setShowDeleteConfirmModal(true);
  };


  const cancelSelectionDelete = () => {
    setShowDeleteModal(false);
  };

  const handleForwardMessages = async (messages, targetChat) => {
    try {
      const isGroupTarget = targetChat.isGroup || targetChat.is_group || false;

      for (const message of messages) {
        const vanishAt = isTempChat ? new Date(Date.now() + selectedVanishDuration * 1000).toISOString() : null;

        const forwardMessage = {
          chat_id: targetChat.id,
          senderId: currentUser.id,
          receiverId: isGroupTarget ? null : (targetChat.otherUser?.id || null),
          content: message.content,
          mediaPath: message.mediaPath || message.media_path,
          mediaType: message.mediaType || message.media_type,
          messageType: message.messageType || message.message_type || (message.media_type === 'voice' ? 'audio' : message.media_type) || 'text',
          reply_to: null,
          is_group_message: Boolean(isGroupTarget),
          vanish_at: vanishAt,
        };

        const { error } = await supabase
          .from('messages')
          .insert(forwardMessage);

        if (error) throw error;
      }

      toast.success(`Message${messages.length > 1 ? 's' : ''} forwarded successfully`);
    } catch (error) {
      console.error('Error forwarding messages:', error);
      hapticsManager.error();
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
    showAlert('Messages copied to clipboard');
  };

  const handleSelectionEdit = () => {
    if (selectedMessages.size !== 1) return;
    const messageId = Array.from(selectedMessages)[0];
    const message = messages.find(msg => msg.id === messageId);

    if (message && (message.senderId || message.sender_id) === currentUser.id) {
      exitSelectionMode();
      window.dispatchEvent(new CustomEvent(`triggerEdit-${messageId}`));
    }
  };

  const handleMessageEdit = (message) => {
    // This function will be passed to MessageItem to handle edit triggers
    if ((message.senderId || message.sender_id) === currentUser.id) {
      // The actual edit logic is handled in MessageItem component
      // This is just a placeholder for any additional logic needed
    }
  };

  const handleViewContact = () => {
    if (!otherUserId || otherUserId === 'undefined') {
      showAlert('User information not available');
      return;
    }
    // Use context callback if available (desktop - keeps Chat mounted), otherwise navigate (mobile)
    if (showUserDetails) {
      showUserDetails(otherUserId);
    } else {
      navigate(`/user-details/${otherUserId}`);
    }
  };

  const handleCreateReminder = () => {
    navigate(`/create-reminder?userId=${otherUserId}`);
  };

  const handleSearchMessages = () => {
    setShowSearchModal(true);
  };

  // Debounced search function - waits 500ms after user stops typing
  const debouncedSearch = useCallback(
    debounce((query) => {
      if (!query.trim() || !chatId) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data, error }) => {
          if (error) throw error;
          setSearchResults(data || []);
        })
        .catch((error) => {
          console.error('Error searching messages:', error);
          setSearchResults([]);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 500), // 500ms delay
    [chatId]
  );

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
      setSearchResults((data || []).map(m => dbToFrontend(m)));
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

    // Update UI immediately for responsiveness
    if (!query.trim()) {
      setSearchResults([]);
    }

    // Debounced API call
    debouncedSearch(query);
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

      if (newTempChatState) {
        // Enable vanish mode: upsert into temporary_chat_settings
        await supabase
          .from('temporary_chat_settings')
          .upsert(
            {
              chat_id: chatId,
              user_id: currentUser.id,
              is_enabled: true,
              vanish_duration: selectedVanishDuration,
              auto_delete_media: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'chat_id,user_id' }
          );
      } else {
        // Disable vanish mode: update is_enabled to false
        await supabase
          .from('temporary_chat_settings')
          .update({ is_enabled: false, updated_at: new Date().toISOString() })
          .eq('chat_id', chatId)
          .eq('user_id', currentUser.id);
      }

      // Also update localStorage cache
      const tempChats = JSON.parse(localStorage.getItem('tempChats') || '{}');
      if (newTempChatState) {
        tempChats[chatId] = { enabled: true, duration: selectedVanishDuration };
      } else {
        delete tempChats[chatId];
      }
      localStorage.setItem('tempChats', JSON.stringify(tempChats));

      setIsTempChat(newTempChatState);
    } catch (error) {
      console.error('Error toggling temp chat:', error);
      hapticsManager.error();
      toast.error('Failed to toggle vanish mode');
    }
  };

  const handleTempChatSettings = () => {
    setShowVanishSettingsModal(true);
  };

  const handleClearChat = async () => {
    setShowClearConfirmModal(true);
  };


  const scrollToBottomSmooth = () => {
    // Use VirtualizedMessageList's scrollToBottom if available
    if (messagesContainerRef.current?.scrollToBottom) {
      messagesContainerRef.current.scrollToBottom('smooth');
    }
    setShowScrollButton(false);
    setUnreadCount(0);
    setIsScrolledToBottom(true);
    markMessagesAsRead();
  };

  const handleMediaView = (mediaUrl, mediaType, message) => {
    // For images, use the new Framer Motion ImageViewer
    if (mediaType === 'image') {
      setCurrentImageUrl(mediaUrl);
      setCurrentImageMessage(message);
      setImageViewerOpen(true);
    } else {
      // For videos, use the existing MediaViewer
      const fileInfo = {
        file_name: message.file_name || 'Unknown',
        file_size: message.file_size || 0,
        mime_type: message.mediaType || message.media_type || 'video/mp4',
        storage_url: mediaUrl,
        file_type: mediaType
      };
      setCurrentMediaInfo({ fileInfo, messageId: message.id });
      setMediaViewerOpen(true);
    }
  };

  return (
    <div
      className={`chat-screen ${showGroupInfoDrawer ? 'drawer-open' : ''}`}
    >
      <div className="chat-main-area">
        {/* Chat Header - delegated to ChatHeader sub-component */}
        <ChatHeader
          chatId={chatId}
          otherUser={otherUser}
          isGroupChat={isGroupChat}
          isDesktop={isDesktop}
          typingUsers={typingUsers}
          isMuted={isMuted}
          isTempChat={isTempChat}
          onVoiceCall={handleVoiceCall}
          onVideoCall={handleVideoCall}
          onMuteToggle={handleMuteToggle}
          onViewContact={handleViewContact}
          onSearchMessages={handleSearchMessages}
          onChangeTheme={handleChangeTheme}
          onShowWallpaper={() => setShowWallpaperPicker(true)}
          onShowGame={() => navigate(`${location.pathname}/arena`)}
          onShowGroupInfo={() => setShowGroupInfoDrawer(true)}
          onBlockUser={handleBlockUser}
          onClearChat={handleClearChat}
          onCreateReminder={handleCreateReminder}
          onTempChatToggle={handleTempChatToggle}
          onTempChatSettings={handleTempChatSettings}
        />

        {!navigator.onLine && connectionStatus === 'connecting' && (
          <div className="connection-banner connecting">
            <div className="spinner"></div>
            Waiting for network...
          </div>
        )}

        {!navigator.onLine && connectionStatus === 'disconnected' && (
          <div className="connection-banner disconnected" onClick={retryConnection} style={{ cursor: 'pointer' }}>
            Offline. Tap to retry.
          </div>
        )}

        {/* Selection Toolbar - delegated to ChatActionsPanel sub-component */}
        <ChatActionsPanel
          isSelectionMode={isSelectionMode}
          selectedMessages={selectedMessages}
          messages={messages}
          currentUserId={currentUser?.id}
          onExit={exitSelectionMode}
          onReply={(message) => { handleReply(message); exitSelectionMode(); }}
          onCopy={handleSelectionCopy}
          onForward={handleSelectionForward}
          onDelete={handleSelectionDelete}
        />

        <div
          className="messages-container"
        >
          {/* Load More Indicator */}
          {isFetchingNextPage && (
            <div className="load-more-indicator">
              <div className="loading-spinner"></div>
              <p>Loading older messages...</p>
            </div>
          )}

          <VirtualizedMessageList
            ref={messagesContainerRef}
            messages={messages}
            currentUser={currentUser}
            selectedMessages={selectedMessages}
            isSelectionMode={isSelectionMode}
            onMessageSelect={handleMessageSelect}
            onReply={handleReply}
            onForward={handleForwardMessage}
            onDelete={(messageId) => {
              updateStoreMessage(validChatId, messageId, { isDeleting: true });
              setTimeout(() => {
                removeStoreMessage(validChatId, messageId);
              }, 450);
            }}
            onEdit={handleMessageEdit}
            onMediaView={handleMediaView}
            onMediaDownload={handleMediaDownload}
            onAcceptGame={handleAcceptGame}
            onRejectGame={handleRejectGame}
            onJoinGame={handleJoinGame}
            isLoading={isMessagesLoading}
            isGroupChat={Boolean(isGroupChat)}
            onSenderClick={(senderId) => {
              const isMobile = window.matchMedia('(max-width: 768px)').matches;
              if (isMobile) {
                navigate(`/user/${senderId}`);
              } else if (showUserDetails) {
                showUserDetails(senderId);
              }
            }}
            isScrolledToBottom={isScrolledToBottom}
            onScroll={handleScroll}
            followOutput="auto"
            typingUsers={typingUsers}
            initialTopMostItemIndex={initialScrollPosition}
            onRangeChanged={(index) => debouncedSaveScroll(validChatId, index)}
            chatId={validChatId}
          />

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
          disabled={isGroupChat && otherUser?.admins_only_messages && (otherUser?.my_role !== 'admin' && otherUser?.my_role !== 'creator')}
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
                      {new Date(message.createdAt || message.created_at).toLocaleDateString()}
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
                  </div>
                  <span style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: chatTheme === key ? '600' : '500', color: chatTheme === key ? '#25d366' : 'var(--text-primary)' }}>
                    {theme.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Modal>

        {/* Media Viewer Component for videos/files */}
        <MediaViewer
          isOpen={mediaViewerOpen}
          onClose={() => {
            setMediaViewerOpen(false);
            setCurrentMediaInfo(null);
          }}
          mediaId={currentMediaInfo?.messageId}
          fileInfo={currentMediaInfo?.fileInfo}
          onShare={handleShareAsForward}
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

        {/* Group Call Modal */}
        <Modal
          isOpen={showGroupCallModal}
          onClose={() => setShowGroupCallModal(false)}
          title={`Start Group ${selectedCallType === 'voice' ? 'Voice' : 'Video'} Call`}
          size="small"
        >
          <div className="group-call-modal-content" style={{ padding: '20px', textAlign: 'center' }}>
            <div className="call-illustration" style={{ marginBottom: '20px' }}>
              {selectedCallType === 'voice' ? <Phone size={48} color="#25D366" /> : <Video size={48} color="#25D366" />}
            </div>
            <p style={{ marginBottom: '25px', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
              Start a group {selectedCallType} call with <strong>{otherUser?.name}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                className="btn-primary"
                onClick={() => handleStartGroupCall(selectedCallType)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Phone size={18} />
                Start {selectedCallType === 'voice' ? 'Voice' : 'Video'} Call
              </button>
            </div>
            <button
              className="btn-secondary"
              onClick={() => setShowGroupCallModal(false)}
              style={{ marginTop: '15px' }}
            >
              Cancel
            </button>
          </div>
        </Modal>

        {/* Vanish Settings Modal */}
        <Modal
          isOpen={showVanishSettingsModal}
          onClose={() => setShowVanishSettingsModal(false)}
          title="Vanish Mode Settings"
          size="small"
        >
          <div className="vanish-settings-content">
            <p>Choose how long messages should stay after being seen:</p>
            <div className="duration-options">
              {vanishPresets.map(preset => (
                <label key={preset.id} className="duration-option">
                  <input
                    type="radio"
                    name="vanishDuration"
                    value={preset.duration_seconds}
                    checked={selectedVanishDuration === preset.duration_seconds}
                    onChange={() => setSelectedVanishDuration(preset.duration_seconds)}
                  />
                  <span>{preset.display_name || preset.name || 'Custom'}</span>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowVanishSettingsModal(false)}>
                Done
              </button>
            </div>
          </div>
        </Modal>

        {/* Confirmation Modals */}
        <Modal
          isOpen={showClearConfirmModal}
          onClose={() => setShowClearConfirmModal(false)}
          title="Clear Chat?"
          size="small"
        >
          <div className="confirm-modal-content">
            <p>Are you sure you want to clear all messages? This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowClearConfirmModal(false)}>Cancel</button>
              <button className="btn-danger" onClick={async () => {
                await confirmClearChat();
                setShowClearConfirmModal(false);
              }}>Clear</button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showBlockConfirmModal}
          onClose={() => setShowBlockConfirmModal(false)}
          title="Block User?"
          size="small"
        >
          <div className="confirm-modal-content">
            <p>Are you sure you want to block this user? They won't be able to message or call you.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowBlockConfirmModal(false)}>Cancel</button>
              <button className="btn-danger" onClick={async () => {
                await confirmBlockUser();
                setShowBlockConfirmModal(false);
              }}>Block</button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showDeleteConfirmModal}
          onClose={() => setShowDeleteConfirmModal(false)}
          title="Delete Messages?"
          size="small"
        >
          <div className="confirm-modal-content">
            <p>Delete selected messages for everyone?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirmModal(false)}>Cancel</button>
              <button className="btn-danger" onClick={onSelectionDelete}>Delete</button>
            </div>
          </div>
        </Modal>

        {showWallpaperPicker && (
          <WallpaperPicker onClose={() => setShowWallpaperPicker(false)} />
        )}
      </div>

      {/* Group Call Screen - Overlay */}
      {showGroupCallScreen && (
        <GroupCallScreen
          groupId={chatId}
          callType={selectedCallType || 'video'}
          onEndCall={handleEndGroupCall}
        />
      )}

      {/* Group Info Drawer - for group chats (Desktop only) */}
      {isDesktop && (isGroupChat || otherUser?.is_group) && (
        <GroupInfoDrawer
          isOpen={showGroupInfoDrawer}
          onClose={() => {
            setShowGroupInfoDrawer(false);
            // Reload group info to check if user is still a member
            if (chatId && (isGroupChat || otherUser?.is_group)) {
              queryClient.invalidateQueries({ queryKey: ['group', chatId] });
            }
          }}
          group={otherUser}
          onCallStart={(type) => {
            setSelectedCallType(type);
            setShowGroupCallModal(true);
          }}
        />
      )}

      {/* Fullscreen Image Viewer with Framer Motion */}
      <ImageViewer
        isOpen={imageViewerOpen}
        onClose={() => {
          setImageViewerOpen(false);
          setCurrentImageUrl(null);
          setCurrentImageMessage(null);
        }}
        imageUrl={currentImageUrl}
        message={currentImageMessage}
        onDownload={onDownloadMedia}
        onShare={onShareAsForward}
      />
    </div>
  );
};

export default Chat;
