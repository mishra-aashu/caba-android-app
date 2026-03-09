import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { dpOptions } from '../../utils/dpOptions';
import { db, addToSyncQueue } from '../../db/db';
import { validateEntity, Message } from '../../types/database';
import { ArrowDown, Phone, Video, Search, Palette, Clock, Trash2, Ban, ArrowLeft, Gamepad2 } from 'lucide-react';
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
import useIsDesktop from '../../hooks/useIsDesktop';
import useChatStore from '../../store/useChatStore';
import useChatRoom from '../../hooks/chat/useChatRoom';
import ChatHeader from './parts/ChatHeader';
import ChatActionsPanel from './parts/ChatActionsPanel';
import ChatBackground from './ChatBackground';
import styles from '../../styles/chat.module.css';
import { getPublicMediaUrl } from '../../services/mediaService';

// ─── Helper: normalize DB message shape to frontend shape ────────────────────
// Defined here so it's always available (was missing before — runtime crash)
const dbToFrontend = (msg) => {
  if (!msg) return msg;
  return {
    ...msg,
    id: msg.id,
    chatId: msg.chat_id ?? msg.chatId,
    senderId: msg.sender_id ?? msg.senderId,
    receiverId: msg.receiver_id ?? msg.receiverId,
    content: msg.content,
    mediaPath: msg.media_path ?? msg.mediaPath,
    mediaType: msg.media_type ?? msg.mediaType,
    messageType: msg.message_type ?? msg.messageType ?? 'text',
    createdAt: msg.created_at ?? msg.createdAt,
    updatedAt: msg.updated_at ?? msg.updatedAt,
    replyTo: msg.reply_to ?? msg.replyTo,
    vanishAt: msg.vanish_at ?? msg.vanishAt,
  };
};

const Chat = () => {
  // ─── ALL BUSINESS LOGIC IS DELEGATED TO useChatRoom ─────────────────────
  const {
    chatId, otherUserId, validChatId, isGroupChat, navigate, location,
    currentUser, otherUser, setOtherUser, isInitializing,
    messages, isFetchingNextPage, hasNextPage, fetchNextPage,
    typingUsers, sendTyping,
    isMuted, isTempChat, setIsTempChat, vanishPresets, setVanishPresets,
    selectedVanishDuration, setSelectedVanishDuration,
    sendMessage, handleSendMedia, replyingTo, handleReply, cancelReply, deleteMessage,
    activeGroupCall, showGroupCallScreen, setShowGroupCallScreen,
    handleVoiceCall, handleVideoCall, handleEndGroupCall, handleStartGroupCall,
    handleMuteToggle, confirmClearChat, confirmBlockUser, confirmSelectionDelete,
    handleShareAsForward, handleMediaDownload,
    handleAcceptGame, handleRejectGame, handleJoinGame,
    supabase, showAlert, initialScrollPosition, saveScrollPosition, queryClient,
    isMessagesLoading, allChats, authLoading, isAuthenticated,
    connectionStatus, retryConnection,
  } = useChatRoom({
    onNewMessage: (msg) => {
      if (!isScrolledToBottom) {
        setUnreadCount(prev => prev + 1);
      } else {
        markMessagesAsRead();
      }
    },
  });

  // ─── Selection delete callback ────────────────────────────────────────────
  const onSelectionDelete = () => {
    confirmSelectionDelete(Array.from(selectedMessages), () => {
      setSelectedMessages(new Set());
      setIsSelectionMode(false);
      setShowDeleteConfirmModal(false); // ✅ FIX: was setShowDeleteModal (wrong name)
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

  // ─── Theme / layout context ───────────────────────────────────────────────
  const {
    chatTheme,
    chatWallpaper,
    chatThemes,
    chatPatterns,
    currentPattern,
    selectTheme,
    selectPattern,
    setChatId,
    setScrollPercentage,
  } = useChatTheme();

  const isDesktop = useIsDesktop();
  const { showUserDetails } = React.useContext(UserDetailsContext) || {};

  // Sync theme context whenever chatId changes
  useEffect(() => {
    if (chatId) setChatId(chatId);
  }, [chatId, setChatId]);

  // ─── UI-ONLY STATE ────────────────────────────────────────────────────────
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [currentMediaInfo, setCurrentMediaInfo] = useState(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [currentImageMessage, setCurrentImageMessage] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messagesToForward, setMessagesToForward] = useState([]);
  const [showGroupInfoDrawer, setShowGroupInfoDrawer] = useState(false);
  const [showVanishSettingsModal, setShowVanishSettingsModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false); // ✅ single source of truth
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showBlockConfirmModal, setShowBlockConfirmModal] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [showGroupCallModal, setShowGroupCallModal] = useState(false);
  const [selectedCallType, setSelectedCallType] = useState('voice');

  const messagesContainerRef = useRef(null);

  // ─── Capacitor keyboard: scroll to bottom when keyboard appears ───────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cleanup;
    const setup = async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        await Keyboard.addListener('keyboardWillShow', () => {
          setTimeout(() => handleScrollToBottom('auto'), 50);
        });
        cleanup = () => Keyboard.removeAllListeners();
      } catch (err) {
        console.warn('[Chat] Keyboard listeners failed:', err);
      }
    };
    setup().then(() => { });
    return () => { if (cleanup) cleanup(); };
  }, []);

  // ─── Scroll helpers ───────────────────────────────────────────────────────
  const debouncedSaveScroll = useCallback(
    debounce((id, index) => saveScrollPosition(id, index), 500),
    [saveScrollPosition],
  );

  const markMessagesAsRead = useCallback(async () => {
    try {
      if (!currentUser || !chatId || chatId === 'new') return;
      await messageReadsService.markAllAsRead(chatId, currentUser.id);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUser, chatId]);

  const handleScroll = (location) => {
    if (location.isAtTop && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
    const isAtBottom = location.isAtBottom || false;
    setIsScrolledToBottom(isAtBottom);
    setShowScrollButton(!isAtBottom);
    if (isAtBottom && unreadCount > 0) {
      setUnreadCount(0);
      markMessagesAsRead();
    }
  };

  const handleScrollToBottom = (behavior = 'auto') => {
    if (messagesContainerRef.current?.scrollToBottom) {
      messagesContainerRef.current.scrollToBottom(behavior);
    }
    if (behavior === 'smooth') {
      setShowScrollButton(false);
      setUnreadCount(0);
      setIsScrolledToBottom(true);
      markMessagesAsRead();
    } else {
      setIsScrolledToBottom(true);
    }
  };

  // ─── Action handlers ──────────────────────────────────────────────────────
  const handleBlockUser = () => setShowBlockConfirmModal(true);
  const handleTyping = () => sendTyping();
  const handleClearChat = () => setShowClearConfirmModal(true);
  const handleSearchMessages = () => setShowSearchModal(true);
  const handleChangeTheme = () => setShowThemeModal(true);
  const handleTempChatSettings = () => setShowVanishSettingsModal(true);

  const handleMessageSelect = (messageId) => {
    setSelectedMessages(prev => {
      const next = new Set(prev);
      next.has(messageId) ? next.delete(messageId) : next.add(messageId);
      setIsSelectionMode(next.size > 0);
      return next;
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

  const handleForwardMessages = async (messages, targetChat) => {
    try {
      const isGroupTarget = targetChat.isGroup || targetChat.is_group || false;
      for (const message of messages) {
        const vanishAt = isTempChat
          ? new Date(Date.now() + selectedVanishDuration * 1000).toISOString()
          : null;

        const { error } = await supabase.from('messages').insert({
          chat_id: targetChat.id,
          senderId: currentUser.id,
          receiverId: isGroupTarget ? null : (targetChat.otherUser?.id || null),
          content: message.content,
          mediaPath: message.mediaPath || message.media_path,
          mediaType: message.mediaType || message.media_type,
          messageType: message.messageType || message.message_type
            || (message.media_type === 'voice' ? 'audio' : message.media_type)
            || 'text',
          reply_to: null,
          is_group_message: Boolean(isGroupTarget),
          vanish_at: vanishAt,
        });
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

  const handleViewContact = () => {
    if (!otherUserId || otherUserId === 'undefined') {
      showAlert('User information not available');
      return;
    }
    if (showUserDetails) {
      showUserDetails(otherUserId);
    } else {
      navigate(`/user-details/${otherUserId}`);
    }
  };

  const handleCreateReminder = () => navigate(`/create-reminder?userId=${otherUserId}`);

  // ─── Message search ───────────────────────────────────────────────────────
  const debouncedSearch = useCallback(
    debounce((query) => {
      if (!query.trim() || !chatId) { setSearchResults([]); return; }
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
          // ✅ FIX: dbToFrontend is now defined at module level — no crash
          setSearchResults((data || []).map(dbToFrontend));
        })
        .catch((error) => {
          console.error('Error searching messages:', error);
          setSearchResults([]);
        })
        .finally(() => setIsSearching(false));
    }, 500),
    [chatId],
  );

  const handleSearchQueryChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query.trim()) setSearchResults([]);
    debouncedSearch(query);
  };

  const scrollToMessage = (messageId) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.backgroundColor = 'rgba(0, 168, 132, 0.2)'; // ✅ Emerald, not green
      setTimeout(() => { el.style.backgroundColor = ''; }, 2000);
    }
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // ─── Theme selection ──────────────────────────────────────────────────────
  const handleThemeSelect = async (themeKey) => {
    await selectTheme(themeKey);
    setShowThemeModal(false);
  };

  // ─── Vanish mode toggle ───────────────────────────────────────────────────
  const handleTempChatToggle = async () => {
    try {
      const newState = !isTempChat;
      if (newState) {
        await supabase.from('temporary_chat_settings').upsert({
          chat_id: chatId,
          user_id: currentUser.id,
          is_enabled: true,
          vanish_duration: selectedVanishDuration,
          auto_delete_media: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'chat_id,user_id' });
      } else {
        await supabase.from('temporary_chat_settings')
          .update({ is_enabled: false, updated_at: new Date().toISOString() })
          .eq('chat_id', chatId)
          .eq('user_id', currentUser.id);
      }
      const tempChats = JSON.parse(localStorage.getItem('tempChats') || '{}');
      if (newState) tempChats[chatId] = { enabled: true, duration: selectedVanishDuration };
      else delete tempChats[chatId];
      localStorage.setItem('tempChats', JSON.stringify(tempChats));
      setIsTempChat(newState);
    } catch (error) {
      console.error('Error toggling temp chat:', error);
      hapticsManager.error();
      toast.error('Failed to toggle vanish mode');
    }
  };

  // ─── Media view ───────────────────────────────────────────────────────────
  const handleMediaView = (mediaUrl, mediaType, message) => {
    if (mediaType === 'image') {
      setCurrentImageUrl(mediaUrl);
      setCurrentImageMessage(message);
      setImageViewerOpen(true);
    } else {
      setCurrentMediaInfo({
        fileInfo: {
          file_name: message.file_name || 'Unknown',
          file_size: message.file_size || 0,
          mime_type: message.mediaType || message.media_type || 'video/mp4',
          storage_url: mediaUrl,
          file_type: mediaType,
        },
        messageId: message.id,
      });
      setMediaViewerOpen(true);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`${styles['chat-screen']} ${showGroupInfoDrawer ? styles['drawer-open'] : ''}`}>
      <div className={styles['chat-main-area']}>
        <ChatBackground
          active={true}
          showPattern={Boolean(currentPattern) || Boolean(chatThemes[chatTheme]?.is_pattern)}
        >
          <div className={styles['chat-main-area-content']}>
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
              onShowGame={() => navigate(`${location.pathname}/arena`)}
              onShowGroupInfo={() => setShowGroupInfoDrawer(true)}
              onBlockUser={handleBlockUser}
              onClearChat={handleClearChat}
              onCreateReminder={handleCreateReminder}
              onTempChatToggle={handleTempChatToggle}
              onTempChatSettings={handleTempChatSettings}
              isAdmin={currentUser?.isAdmin}
            />

            <div className={styles['nested-chat-content']}>
              {/* Connection banners */}
              {!navigator.onLine && connectionStatus === 'connecting' && (
                <div className={`${styles['connection-banner']} ${styles.connecting}`}>
                  <div className={styles.spinner} />
                  Waiting for network...
                </div>
              )}
              {!navigator.onLine && connectionStatus === 'disconnected' && (
                <div
                  className={`${styles['connection-banner']} ${styles.disconnected}`}
                  onClick={retryConnection}
                >
                  Offline. Tap to retry.
                </div>
              )}

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

              <div className={styles['messages-container']}>
                {isFetchingNextPage && (
                  <div className={styles['load-more-indicator']}>
                    <div className={styles['loading-spinner']} />
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
                  onDelete={(messageId) => deleteMessage(messageId)}
                  onEdit={() => { }}
                  onMediaView={handleMediaView}
                  onMediaDownload={handleMediaDownload}
                  onAcceptGame={handleAcceptGame}
                  onRejectGame={handleRejectGame}
                  onJoinGame={handleJoinGame}
                  isLoading={isMessagesLoading}
                  isGroupChat={Boolean(isGroupChat)}
                  onSenderClick={(senderId) => {
                    const isMobile = window.matchMedia('(max-width: 768px)').matches;
                    if (isMobile) navigate(`/user/${senderId}`);
                    else if (showUserDetails) showUserDetails(senderId);
                  }}
                  isScrolledToBottom={isScrolledToBottom}
                  onScroll={handleScroll}
                  followOutput="auto"
                  typingUsers={typingUsers}
                  initialTopMostItemIndex={initialScrollPosition}
                  onRangeChanged={(index) => debouncedSaveScroll(validChatId, index)}
                  chatId={validChatId}
                />

                {showScrollButton && (
                  <button
                    className={styles['scroll-bottom-btn']}
                    onClick={() => handleScrollToBottom('smooth')}
                  >
                    <ArrowDown size={20} />
                    {unreadCount > 0 && (
                      <span className={styles['unread-count']}>{unreadCount}</span>
                    )}
                  </button>
                )}
              </div>

              <MessageInput
                onSendMessage={sendMessage}
                onSendMedia={handleSendMedia}
                onTyping={handleTyping}
                replyingTo={replyingTo}
                onCancelReply={cancelReply}
                chatId={chatId}
                receiverId={otherUserId}
                currentUser={currentUser}
                disabled={
                  isGroupChat &&
                  otherUser?.admins_only_messages &&
                  otherUser?.my_role !== 'admin' &&
                  otherUser?.my_role !== 'creator'
                }
              />
            </div>
          </div>
        </ChatBackground>

        {/* ── Modals ────────────────────────────────────────────────────── */}

        {/* Search */}
        <Modal
          isOpen={showSearchModal}
          onClose={() => { setShowSearchModal(false); setSearchQuery(''); setSearchResults([]); }}
          title="Search Messages"
          size="medium"
        >
          <div className={styles['search-modal-content']}>
            <div className={styles['search-input-container']}>
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={handleSearchQueryChange}
                autoFocus
              />
            </div>
            <div className={styles['search-results']}>
              {isSearching ? (
                <div className={styles['search-loading']}>
                  <div className={styles['loading-spinner']} />
                  <p>Searching...</p>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map(message => (
                  <div
                    key={message.id}
                    className={styles['search-result-item']}
                    onClick={() => scrollToMessage(message.id)}
                  >
                    <div className={styles['search-result-content']}>{message.content}</div>
                    <div className={styles['search-result-time']}>
                      {new Date(message.createdAt || message.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              ) : searchQuery.trim() ? (
                <div className={styles['no-results']}>No messages found</div>
              ) : (
                <div className={styles['search-placeholder']}>Type to search messages</div>
              )}
            </div>
          </div>
        </Modal>

        {/* Theme Selector */}
        <Modal
          isOpen={showThemeModal}
          onClose={() => setShowThemeModal(false)}
          title="Choose Theme"
          size="large"
        >
          <div className={styles['theme-selector']}>
            <div className={styles['theme-section']}>
              <h4 className={styles['theme-section-title']}>Chat Themes</h4>
              <div className={styles['theme-grid']}>
                {Object.entries(chatThemes).map(([key, theme]) => (
                  <div
                    key={key}
                    className={`${styles['theme-capsule']} ${chatTheme === key ? styles.active : ''}`}
                    onClick={() => handleThemeSelect(key)}
                  >
                    <div
                      className={styles['theme-capsule-preview']}
                      style={{ background: theme.background }}
                    />
                    <span className={styles['theme-capsule-name']}>{theme.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles['pattern-picker-section']}>
              <h4 className={styles['theme-section-title']}>Wallpapers & Patterns</h4>
              <div className={styles['pattern-grid']}>
                {chatPatterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className={`${styles['pattern-card']} ${currentPattern === pattern.id ? styles.active : ''}`}
                    onClick={() => selectPattern(pattern.id)}
                  >
                    <div
                      className={styles['pattern-preview']}
                      style={{
                        WebkitMaskImage: `url(/assets/${pattern.id}.svg)`,
                        maskImage: `url(/assets/${pattern.id}.svg)`,
                        WebkitMaskSize: 'var(--chat-pattern-size, 400px)',
                        maskSize: 'var(--chat-pattern-size, 400px)',
                      }}
                    />
                    <span className={styles['pattern-card-name']}>{pattern.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>

        {/* Media Viewer (video/files) */}
        <MediaViewer
          isOpen={mediaViewerOpen}
          onClose={() => { setMediaViewerOpen(false); setCurrentMediaInfo(null); }}
          mediaId={currentMediaInfo?.messageId}
          fileInfo={currentMediaInfo?.fileInfo}
          onShare={handleShareAsForward}
        />

        {/* Forward Modal */}
        <ForwardModal
          isOpen={showForwardModal}
          onClose={() => { setShowForwardModal(false); setMessagesToForward([]); }}
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
          <div className={styles['group-call-modal-content']}>
            <div className={styles['call-illustration']}>
              {selectedCallType === 'voice'
                ? <Phone size={48} color="var(--brand-primary, #00a884)" />
                : <Video size={48} color="var(--brand-primary, #00a884)" />
              }
            </div>
            <p className={styles['call-modal-text']}>
              Start a group {selectedCallType} call with <strong>{otherUser?.name}</strong>?
            </p>
            <div className={styles['modal-actions']}>
              <button className={styles['btn-primary']} onClick={() => handleStartGroupCall(selectedCallType)}>
                <Phone size={18} />
                Start {selectedCallType === 'voice' ? 'Voice' : 'Video'} Call
              </button>
              <button className={styles['btn-secondary']} onClick={() => setShowGroupCallModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        {/* Vanish Settings */}
        <Modal
          isOpen={showVanishSettingsModal}
          onClose={() => setShowVanishSettingsModal(false)}
          title="Vanish Mode Settings"
          size="small"
        >
          <div className={styles['vanish-settings-content']}>
            <p>Choose how long messages should stay after being seen:</p>
            <div className={styles['duration-options']}>
              {vanishPresets.map(preset => (
                <label key={preset.id} className={styles['duration-option']}>
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
            <div className={styles['modal-actions']}>
              <button className={styles['btn-primary']} onClick={() => setShowVanishSettingsModal(false)}>
                Done
              </button>
            </div>
          </div>
        </Modal>

        {/* Clear Chat */}
        <Modal
          isOpen={showClearConfirmModal}
          onClose={() => setShowClearConfirmModal(false)}
          title="Clear Chat?"
          size="small"
        >
          <div className={styles['confirm-modal-content']}>
            <p>Are you sure you want to clear all messages? This cannot be undone.</p>
            <div className={styles['modal-actions']}>
              <button className={styles['btn-secondary']} onClick={() => setShowClearConfirmModal(false)}>
                Cancel
              </button>
              <button className={styles['btn-danger']} onClick={async () => {
                await confirmClearChat();
                setShowClearConfirmModal(false);
              }}>
                Clear
              </button>
            </div>
          </div>
        </Modal>

        {/* Block User */}
        <Modal
          isOpen={showBlockConfirmModal}
          onClose={() => setShowBlockConfirmModal(false)}
          title="Block User?"
          size="small"
        >
          <div className={styles['confirm-modal-content']}>
            <p>Are you sure you want to block this user? They won't be able to message or call you.</p>
            <div className={styles['modal-actions']}>
              <button className={styles['btn-secondary']} onClick={() => setShowBlockConfirmModal(false)}>
                Cancel
              </button>
              <button className={styles['btn-danger']} onClick={async () => {
                await confirmBlockUser();
                setShowBlockConfirmModal(false);
              }}>
                Block
              </button>
            </div>
          </div>
        </Modal>

        {/* Delete Selected Messages */}
        <Modal
          isOpen={showDeleteConfirmModal}
          onClose={() => setShowDeleteConfirmModal(false)}
          title="Delete Messages?"
          size="small"
        >
          <div className={styles['confirm-modal-content']}>
            <p>Delete selected messages for everyone?</p>
            <div className={styles['modal-actions']}>
              <button className={styles['btn-secondary']} onClick={() => setShowDeleteConfirmModal(false)}>
                Cancel
              </button>
              <button className={styles['btn-danger']} onClick={onSelectionDelete}>
                Delete
              </button>
            </div>
          </div>
        </Modal>
      </div>

      {/* Group Call Screen overlay */}
      {showGroupCallScreen && (
        <GroupCallScreen
          groupId={chatId}
          callType={selectedCallType || 'video'}
          onEndCall={handleEndGroupCall}
        />
      )}

      {/* Group Info Drawer (desktop only) */}
      {isDesktop && (isGroupChat || otherUser?.is_group) && (
        <GroupInfoDrawer
          isOpen={showGroupInfoDrawer}
          onClose={() => {
            setShowGroupInfoDrawer(false);
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

      {/* Fullscreen Image Viewer */}
      <ImageViewer
        isOpen={imageViewerOpen}
        onClose={() => { setImageViewerOpen(false); setCurrentImageUrl(null); setCurrentImageMessage(null); }}
        imageUrl={currentImageUrl}
        message={currentImageMessage}
        onDownload={onDownloadMedia}
        onShare={onShareAsForward}
      />
    </div>
  );
};

export default Chat;