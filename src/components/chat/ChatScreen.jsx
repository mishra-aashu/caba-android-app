import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { debounce } from 'lodash';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import VirtualizedMessageList from './VirtualizedMessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import { messageReadsService } from '../../services/messageReadsService';
import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins } from '../../utils/platformCheck';
import hapticsManager from '../../utils/hapticsManager';
import { UserDetailsContext } from '../../contexts/UserDetailsContext';
import useIsDesktop from '../../hooks/useIsDesktop';
import useChatStore from '../../store/useChatStore';
import useChatRoom from '../../hooks/chat/useChatRoom';
import ChatHeader from './parts/ChatHeader';
import ChatBackground from './ChatBackground';
import { useGroupDetails } from '../../hooks/useGroupDetails';
import styles from '../../styles/chat.module.css';
import { getStableMessageId, extractMessageContent } from '../../utils/messageHelpers';
import { resolveAvatarUrl } from '../../utils/avatarHelpers';
import { mapMessage as dbToFrontend } from '../../services/dataGateway';
import { useVanishCleanup } from '../../hooks/chat/useVanishCleanup';


const MediaViewer = lazy(() => import('../media/MediaViewer'));
const ImageViewer = lazy(() => import('./ImageViewer'));
const ForwardModal = lazy(() => import('./ForwardModal'));
const GroupCallScreen = lazy(() => import('../group/GroupCallScreen'));
const EmojiPicker = lazy(() => import('../common/EmojiPicker'));
const VanishSettingsModal = lazy(() => import('./VanishSettingsModal'));

const ChatScreen = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const {
        chatId, otherUserId, isGroupChat, validChatId,
        otherUser, setOtherUser, isInitializing,
        messages, isFetchingNextPage, hasNextPage, fetchNextPage,
        typingUsers, sendTyping,
        isMuted, isTempChat, setIsTempChat, toggleVanishMode,
        selectedVanishDuration, updateVanishDuration, vanishPresets, isVanishLoading,

        sendMessage, handleSendMedia, replyingTo, handleReply, cancelReply, deleteMessage, forwardMessages,

        activeGroupCall, showGroupCallScreen, setShowGroupCallScreen,
        handleVoiceCall, handleVideoCall, handleEndGroupCall, handleStartGroupCall,
        handleMuteToggle, confirmClearChat, confirmBlockUser, confirmSelectionDelete,
        handleShareAsForward, handleMediaDownload,
        handleAcceptGame, handleRejectGame, handleJoinGame, handleReactionToggle,
        supabase, showAlert, initialScrollPosition, saveScrollPosition,
        isMessagesLoading,
        isDexieLoading,
        connectionStatus, retryConnection,
        authError, currentUser,
        markMessagesAsRead, unreadCount, setUnreadCount, isScrolledToBottom, setIsScrolledToBottom,
        handleManualRetry
    } = useChatRoom();

    useVanishCleanup(chatId);

    // ✅ Track whether this is genuinely a new chat (not just a re-mount)
    const previousChatIdRef = useRef(null);
    const isNewChat = previousChatIdRef.current !== chatId;
    useEffect(() => {
        previousChatIdRef.current = chatId;
    }, [chatId]);

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

    const isSelectionMode = useChatStore(state => state.isSelectionMode);
    const selectedMessageIds = useChatStore(state => state.selectedMessageIds);
    const clearSelection = useChatStore(state => state.clearSelection);

    const onSelectionDelete = useCallback(() => {
        const ids = Array.from(selectedMessageIds);
        if (ids.length === 0) return;
        confirmSelectionDelete(ids, () => {
            clearSelection();
        });
    }, [confirmSelectionDelete, clearSelection, selectedMessageIds]);

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
    const { showUserDetails, showGroupInfo, showThemeSelector, showSharedMedia } = useContext(UserDetailsContext) || {};

    useEffect(() => {
        if (!isNewChat) return; 
        if (chatId) setChatId(chatId);
    }, [chatId, setChatId, isNewChat]);

    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const { data: groupDetails } = useGroupDetails(isGroupChat ? chatId : null);

    const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
    const [currentMediaInfo, setCurrentMediaInfo] = useState(null);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [currentImageUrl, setCurrentImageUrl] = useState(null);
    const [currentImageMessage, setCurrentImageMessage] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [messagesToForward, setMessagesToForward] = useState([]);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showVanishSettingsModal, setShowVanishSettingsModal] = useState(false);
    const messagesContainerRef = useRef(null);

    const handleEmojiSelect = useCallback((emoji) => {
        if (emoji.startsWith('http')) {
            handleSendMedia(emoji, 'image');
            setShowEmojiPicker(false);
        } else {
            const event = new CustomEvent('add-emoji', { detail: emoji });
            window.dispatchEvent(event);
        }
    }, [handleSendMedia]);

    const handleToggleEmoji = useCallback(() => {
        setShowEmojiPicker(prev => !prev);
    }, []);

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

    useEffect(() => {
        if (!isNativeWithPlugins()) return;
        let keyboardSubscription;
        
        const setup = async () => {
            try {
                const { Keyboard } = await import('@capacitor/keyboard');
                keyboardSubscription = await Keyboard.addListener('keyboardDidShow', () => {
                    handleScrollToBottom('auto');
                });
            } catch (err) {
                console.warn('[Chat] Keyboard listeners failed:', err);
            }
        };
        setup();
        return () => { 
            if (keyboardSubscription) keyboardSubscription.remove();
        };
    }, [handleScrollToBottom]);

    const debouncedSaveScroll = useMemo(
        () => debounce((id, index) => saveScrollPosition(id, index), 500),
        [saveScrollPosition],
    );

    const handleRangeChanged = useCallback((startIndex) => {
        if (chatId && !isScrolledToBottom) {
            debouncedSaveScroll(chatId, startIndex);
        } else if (chatId && isScrolledToBottom) {
            debouncedSaveScroll.cancel();
            saveScrollPosition(chatId, null); // Sentinel for "at bottom"
        }
    }, [chatId, isScrolledToBottom, saveScrollPosition, debouncedSaveScroll]);

    useEffect(() => {
        if (!chatId || !currentUser || chatId === 'new') return;

        const handleReadTrigger = () => {
            if (document.visibilityState === 'visible' && !document.hidden && window.document.hasFocus()) {
                markMessagesAsRead();
            }
        };

        if (isNewChat) {
            markMessagesAsRead();
        }

        window.addEventListener('focus', handleReadTrigger);
        document.addEventListener('visibilitychange', handleReadTrigger);
        return () => {
            window.removeEventListener('focus', handleReadTrigger);
            document.removeEventListener('visibilitychange', handleReadTrigger);
        };
    }, [chatId, currentUser?.id, markMessagesAsRead, isNewChat]);


    const handleScroll = useCallback((scrollLocation) => {
        if (scrollLocation.isAtTop && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
        const isAtBottom = scrollLocation.isAtBottom || false;

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
        <div className={styles['chat-screen']}>
            <div className={styles['chat-main-area']}>
                <ChatBackground
                    showPattern={!isTempChat && (Boolean(currentPattern) || Boolean(chatThemes[chatTheme]?.is_pattern))}
                    isVanishMode={isTempChat}
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
                            onChangeTheme={showThemeSelector}
                            onShowSharedMedia={() => { console.log('[ChatScreen] SharedMedia clicked'); showSharedMedia?.(isGroupChat ? chatId : otherUserId, isGroupChat); }}
                            onShowGame={() => navigate(`/games`)}
                            onShowGroupInfo={() => {
                                if (isDesktop) showGroupInfo?.(chatId, otherUser);
                                else navigate(`/chat/${chatId}/group/info`);
                            }}
                            onBlockUser={confirmBlockUser}
                            onClearChat={confirmClearChat}
                            onCreateReminder={() => navigate(`/create-reminder?userId=${otherUserId}`)}
                            onTempChatToggle={handleTempChatToggle}
                            onTempChatSettings={() => {
                                setShowVanishSettingsModal(true);
                            }}
                            onDeleteSelected={onSelectionDelete}
                            onCopySelected={handleSelectionCopy}
                            onForwardSelected={handleSelectionForward}
                            onAddMember={() => navigate(`/chat/${chatId}/group/add-members`)}
                            isAdmin={isGroupChat ? (otherUser?.my_role === 'admin' || otherUser?.my_role === 'owner') : false}
                        />

                        <div className={`${styles['nested-chat-content']} gpu-layer`}>
                            {activeGroupCall && (
                                <div className={styles['active-call-banner']}>
                                    <div className={styles['banner-content']}>
                                        <span>Ongoing Group Call ({activeGroupCall.group_call_participants?.length} joined)</span>
                                    </div>
                                    <button className={styles['banner-join-btn']} onClick={() => { handleStartGroupCall('join'); }}>Join</button>
                                </div>
                            )}

                            {!navigator.onLine && (connectionStatus === 'connecting' || connectionStatus === 'disconnected') && (
                                <div className={`${styles['connection-banner']} ${messages.length > 0 ? styles['offline-mini'] : styles.disconnected}`} onClick={retryConnection}>
                                    {messages.length > 0 ? (
                                        <><span>Offline. Tap to retry.</span></>
                                    ) : (
                                        <>
                                            <div className={styles.spinner} />
                                            Waiting for network...
                                        </>
                                    )}
                                </div>
                            )}

                            <div className={`${styles['messages-container']} smooth-scroll`}>
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
                                    isVanishMode={isTempChat}
                                    onToggleVanish={toggleVanishMode}
                                    isLoading={isMessagesLoading}
                                    isDexieLoading={isDexieLoading}
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
                                    onRangeChanged={handleRangeChanged}
                                    chatId={validChatId}
                                    onManualRetry={handleManualRetry}
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
                                showEmojiPicker={showEmojiPicker}
                                onToggleEmoji={handleToggleEmoji}
                                isTempChat={isTempChat}
                                selectedVanishDuration={selectedVanishDuration}
                                onOpenVanishSettings={() => setShowVanishSettingsModal(true)}
                                onToggleVanish={toggleVanishMode}
                                disabled={
                                    isGroupChat &&
                                    otherUser?.admins_only_messages &&
                                    otherUser?.my_role !== 'admin' &&
                                    otherUser?.my_role !== 'creator'
                                }
                            />

                            <Suspense fallback={null}>
                                {showEmojiPicker && (
                                    <EmojiPicker
                                        isOpen={showEmojiPicker}
                                        onEmojiSelect={handleEmojiSelect}
                                        onClose={() => setShowEmojiPicker(false)}
                                        showTrigger={false}
                                        isInline={!isDesktop}
                                    />
                                )}
                            </Suspense>
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

                    {showForwardModal && (
                        <ForwardModal
                            isOpen={true}
                            onClose={() => { setShowForwardModal(false); setMessagesToForward([]); }}
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

                    {showVanishSettingsModal && (
                        <VanishSettingsModal
                            isOpen={true}
                            onClose={() => setShowVanishSettingsModal(false)}
                            presets={vanishPresets}
                            isLoading={isVanishLoading}
                            selectedDuration={selectedVanishDuration}
                            onSelectDuration={(duration) => {
                                updateVanishDuration(duration);
                            }}
                        />
                    )}
                </Suspense>

            </div>
        </div>
    );
};

export default ChatScreen;