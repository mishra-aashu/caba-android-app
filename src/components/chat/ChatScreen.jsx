import React, { useState, useEffect, useRef, useCallback, useMemo, memo, Suspense, lazy, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { ArrowDown, Phone, Video, Search, Palette, Clock, Trash2, Ban, ArrowLeft, Gamepad2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import VirtualizedMessageList from './VirtualizedMessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import { messageReadsService } from '../../services/messageReadsService';
import debounce from 'lodash/debounce';
import { Capacitor } from '@capacitor/core';
import hapticsManager from '../../utils/hapticsManager';
import { UserDetailsContext } from '../../contexts/UserDetailsContext';
import useIsDesktop from '../../hooks/useIsDesktop';
import useChatStore from '../../store/useChatStore';
import useChatRoom from '../../hooks/chat/useChatRoom';
import ChatHeader from './parts/ChatHeader';
import ChatBackground from './ChatBackground';
import styles from '../../styles/chat.module.css';
import { getStableMessageId, extractMessageContent } from '../../utils/messageHelpers';

const MediaViewer = lazy(() => import('../media/MediaViewer'));
const ImageViewer = lazy(() => import('./ImageViewer'));
const ForwardModal = lazy(() => import('./ForwardModal'));
const GroupCallScreen = lazy(() => import('../group/GroupCallScreen'));
const GroupInfoDrawer = lazy(() => import('../groups/GroupInfoDrawer'));
const GameLobby = lazy(() => import('./GameLobby'));

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
    seen_at: msg.seen_at,
  };
};

const ChatScreen = () => {
  const { chatId, otherUserId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, authLoading, isAuthenticated } = useAuth();
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);

  const markMessagesAsRead = useCallback(async () => {
    try {
      if (!currentUser || !chatId || chatId === 'new') return;
      await messageReadsService.markAllAsRead(chatId, currentUser.id);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUser?.id, chatId]);

  const onNewMessage = useCallback((msg) => {
    if (!isScrolledToBottom) {
      setUnreadCount(prev => prev + 1);
    } else {
      markMessagesAsRead();
    }
  }, [isScrolledToBottom, markMessagesAsRead]);

  const chatRoomOptions = useMemo(() => ({ onNewMessage }), [onNewMessage]);

  const {
    validChatId, isGroupChat,
    otherUser, setOtherUser, isInitializing,
    messages, isFetchingNextPage, hasNextPage, fetchNextPage,
    typingUsers, sendTyping,
    isMuted, isTempChat, setIsTempChat, vanishPresets, setVanishPresets,
    selectedVanishDuration, setSelectedVanishDuration,
    sendMessage, handleSendMedia, replyingTo, handleReply, cancelReply, deleteMessage, forwardMessages,
    activeGroupCall, showGroupCallScreen, setShowGroupCallScreen,
    handleVoiceCall, handleVideoCall, handleEndGroupCall, handleStartGroupCall,
    handleMuteToggle, confirmClearChat, confirmBlockUser, confirmSelectionDelete,
    handleShareAsForward, handleMediaDownload,
    handleAcceptGame, handleRejectGame, handleJoinGame, handleReactionToggle,
    supabase, showAlert, initialScrollPosition, saveScrollPosition,
    isMessagesLoading, allChats, 
    connectionStatus, retryConnection,
    authError,
  } = useChatRoom(chatRoomOptions);

  useEffect(() => {
    if (handleReactionToggle) {
        window.handleReactionToggle = handleReactionToggle;
    }
    return () => { delete window.handleReactionToggle; };
  }, [handleReactionToggle]);

  useEffect(() => {
    if (authError) {
      toast.error(authError);
      navigate('/', { replace: true });
    }
  }, [authError, navigate]);

  const [showGameLobby, setShowGameLobby] = useState(false);

  const onSelectionDelete = () => {
    confirmSelectionDelete(Array.from(selectedMessageIds), () => {
      clearSelection();
      setShowDeleteConfirmModal(false);
    });
  };

  const {
    chatTheme,
    chatThemes,
    chatPatterns,
    currentPattern,
    selectTheme,
    selectPattern,
    setChatId,
  } = useChatTheme();

  const isDesktop = useIsDesktop();
  const { showUserDetails, showGroupInfo } = useContext(UserDetailsContext) || {};

  useEffect(() => {
    if (chatId) setChatId(chatId);
  }, [chatId, setChatId]);

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const isSelectionMode = useChatStore(state => state.isSelectionMode);
  const selectedMessageIds = useChatStore(state => state.selectedMessageIds);
  const clearSelection = useChatStore(state => state.clearSelection);

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
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showBlockConfirmModal, setShowBlockConfirmModal] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showGroupCallModal, setShowGroupCallModal] = useState(false);
  const [selectedCallType, setSelectedCallType] = useState('voice');

  const messagesContainerRef = useRef(null);

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
    setup();
    return () => { if (cleanup) cleanup(); };
  }, []);

  const debouncedSaveScroll = useCallback(
    debounce((id, index) => saveScrollPosition(id, index), 500),
    [saveScrollPosition],
  );

  useEffect(() => {
    if (chatId && currentUser && chatId !== 'new') {
      const timer = setTimeout(() => {
        markMessagesAsRead();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [chatId, currentUser?.id, markMessagesAsRead]);

  useEffect(() => {
    const handleEvents = () => {
      if (!document.hidden && chatId && currentUser && chatId !== 'new') {
        markMessagesAsRead();
      }
    };

    window.addEventListener('focus', handleEvents);
    document.addEventListener('visibilitychange', handleEvents);
    return () => {
      window.removeEventListener('focus', handleEvents);
      document.removeEventListener('visibilitychange', handleEvents);
    };
  }, [chatId, currentUser?.id, markMessagesAsRead]);

  const handleScrollToBottom = useCallback((behavior = 'auto') => {
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
  }, [markMessagesAsRead]);

  const handleScroll = useCallback((location) => {
    if (location.isAtTop && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
    const isAtBottom = location.isAtBottom || false;
    
    setIsScrolledToBottom(prev => (prev !== isAtBottom ? isAtBottom : prev));
    setShowScrollButton(prev => (prev !== !isAtBottom ? !isAtBottom : prev));
    
    if (isAtBottom && unreadCount > 0) {
      setUnreadCount(0);
      markMessagesAsRead();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, unreadCount, markMessagesAsRead]);

  const handleForwardMessages = async (msgs, targetChat) => {
    if (!forwardMessages) return;
    await forwardMessages(msgs, targetChat);
  };

  const handleSelectionForward = () => {
    const selectedMsgs = messages.filter((msg, index) => {
      const msgId = getStableMessageId(msg, index);
      return selectedMessageIds.has(msgId);
    });
    setMessagesToForward(selectedMsgs);
    setShowForwardModal(true);
    clearSelection();
  };

  const handleSelectionCopy = () => {
    const selectedMsgs = messages.filter((msg, index) => {
      const msgId = getStableMessageId(msg, index);
      return selectedMessageIds.has(msgId);
    });
    const copyText = selectedMsgs.map(msg => extractMessageContent(msg)).join('\n\n');
    navigator.clipboard.writeText(copyText);
    clearSelection();
    showAlert('Messages copied to clipboard');
  };

  const handleViewContact = () => {
    if (isGroupChat) {
      if (isDesktop) showGroupInfo?.(chatId, otherUser);
      else navigate(`/chat/${chatId}/group/info`);
      return;
    }
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
          setSearchResults((data || []).map(dbToFrontend));
        })
        .catch((error) => {
          console.error('Error searching messages:', error);
          setSearchResults([]);
        })
        .finally(() => setIsSearching(false));
    }, 500),
    [chatId, supabase],
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
      el.style.backgroundColor = 'rgba(0, 168, 132, 0.2)';
      setTimeout(() => { el.style.backgroundColor = ''; }, 2000);
    }
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

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
      setIsTempChat(newState);
    } catch (error) {
      console.error('Error toggling temp chat:', error);
      hapticsManager.error();
      toast.error('Failed to toggle vanish mode');
    }
  };

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
              onSearchMessages={() => setShowSearchModal(true)}
              onChangeTheme={() => setShowThemeModal(true)}
              onShowGame={() => navigate(`${location.pathname}/arena`)}
              onShowGroupInfo={() => setShowGroupInfoDrawer(true)}
              onBlockUser={() => setShowBlockConfirmModal(true)}
              onClearChat={() => setShowClearConfirmModal(true)}
              onCreateReminder={() => navigate(`/create-reminder?userId=${otherUserId}`)}
              onTempChatToggle={handleTempChatToggle}
              onTempChatSettings={() => setShowVanishSettingsModal(true)}
              onDeleteSelected={onSelectionDelete}
              onCopySelected={handleSelectionCopy}
              onForwardSelected={handleSelectionForward}
              isAdmin={currentUser?.isAdmin}
            />

            <div className={styles['nested-chat-content']}>
              {activeGroupCall && (
                <div className={styles['active-call-banner']}>
                  <div className={styles['banner-content']}>
                    <span>Ongoing Group Call ({activeGroupCall.group_call_participants?.length} joined)</span>
                  </div>
                  <button className={styles['banner-join-btn']} onClick={() => { handleStartGroupCall('join'); }}>Join</button>
                </div>
              )}

              {!navigator.onLine && connectionStatus === 'connecting' && (
                <div className={`${styles['connection-banner']} ${styles.connecting}`}>
                  <div className={styles.spinner} />
                  Waiting for network...
                </div>
              )}
              {!navigator.onLine && connectionStatus === 'disconnected' && (
                <div className={`${styles['connection-banner']} ${styles.disconnected}`} onClick={retryConnection}>
                  Offline. Tap to retry.
                </div>
              )}

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
                  onReply={handleReply}
                  onForward={(msg) => { setMessagesToForward([msg]); setShowForwardModal(true); }}
                  onDelete={(messageId) => deleteMessage(messageId)}
                  onEdit={() => { }}
                  onMediaView={handleMediaView}
                  onMediaDownload={handleMediaDownload}
                  onAcceptGame={handleAcceptGame}
                  onRejectGame={handleRejectGame}
                  onJoinGame={handleJoinGame}
                  isLoading={isMessagesLoading}
                  isFetchingNextPage={isFetchingNextPage}
                  fetchNextPage={fetchNextPage}
                  hasNextPage={hasNextPage}
                  isGroupChat={Boolean(isGroupChat)}
                  onSenderClick={(senderId) => {
                    const isMobile = window.matchMedia('(max-width: 768px)').matches;
                    if (isMobile) navigate(`/chat/new/${senderId}`);
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
                  <button className={styles['scroll-bottom-btn']} onClick={() => handleScrollToBottom('smooth')}>
                    <ArrowDown size={20} />
                    {unreadCount > 0 && <span className={styles['unread-count']}>{unreadCount}</span>}
                  </button>
                )}
              </div>

              <MessageInput
                onSendMessage={sendMessage}
                onSendMedia={handleSendMedia}
                onTyping={() => sendTyping()}
                replyingTo={replyingTo}
                onCancelReply={cancelReply}
                chatId={chatId}
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

        <Suspense fallback={null}>
          {showSearchModal && (
            <Modal isOpen={true} onClose={() => { setShowSearchModal(false); setSearchQuery(''); setSearchResults([]); }} title="Search Messages" size="medium">
              <div className={styles['search-modal-content']}>
                <div className={styles['search-input-container']}>
                  <input type="text" placeholder="Search messages..." value={searchQuery} onChange={handleSearchQueryChange} autoFocus />
                </div>
                <div className={styles['search-results']}>
                  {isSearching ? (
                    <div className={styles['search-loading']}><div className={styles['loading-spinner']} /><p>Searching...</p></div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map(message => (
                      <div key={message.id} className={styles['search-result-item']} onClick={() => scrollToMessage(message.id)}>
                        <div className={styles['search-result-content']}>{message.content}</div>
                        <div className={styles['search-result-time']}>{new Date(message.createdAt || message.created_at).toLocaleDateString()}</div>
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
          )}

          {showThemeModal && (
            <Modal isOpen={true} onClose={() => setShowThemeModal(false)} title="Choose Chat Theme" size="large">
              <div className={styles['theme-selector']}>
                <div className={styles['theme-grid']}>
                  {Object.entries(chatThemes).map(([key, theme]) => (
                    <div key={key} className={`${styles['theme-capsule']} ${chatTheme === key ? styles.active : ''}`} onClick={() => selectTheme(key)}>
                      <div className={styles['theme-capsule-preview']} style={{ background: theme.background }} />
                      <div className={styles['theme-capsule-info']}>
                        <span className={styles['theme-capsule-name']}>{theme.name}</span>
                        <span className={styles['theme-capsule-category']}>{theme.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Modal>
          )}

          {showForwardModal && (
            <ForwardModal
              isOpen={true}
              onClose={() => { setShowForwardModal(false); setMessagesToForward([]); }}
              chats={allChats}
              messagesToForward={messagesToForward}
              onForward={handleForwardMessages}
              currentUser={currentUser}
            />
          )}

          {showGroupCallScreen && (
            <GroupCallScreen groupId={chatId} onEndCall={handleEndGroupCall} />
          )}

          {imageViewerOpen && (
            <ImageViewer isOpen={true} onClose={() => setImageViewerOpen(false)} imageUrl={currentImageUrl} message={currentImageMessage} />
          )}

          {mediaViewerOpen && (
            <MediaViewer isOpen={true} onClose={() => { setMediaViewerOpen(false); setCurrentMediaInfo(null); }} mediaId={currentMediaInfo?.messageId} fileInfo={currentMediaInfo?.fileInfo} onShare={handleShareAsForward} />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default ChatScreen;
