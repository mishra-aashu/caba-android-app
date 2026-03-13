import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { UserDetailsContext } from '../../contexts/UserDetailsContext';
import { useCall } from '../../contexts/CallContext';
import { useGroupCall } from '../../contexts/GroupCallContext';
import { useAuth } from '../../hooks/useAuth';
import { dpOptions } from '../../utils/dpOptions';
import { saveMessagesToDevice, loadMessagesFromDevice } from '../../utils/FileSystemManager';
import { frontendToDb, dbToFrontend } from '../../utils/dbFieldMapping';
import { db, addToSyncQueue } from '../../db/db';
import {
    ArrowLeft,
    MoreVertical,
    ArrowDown,
    Paperclip,
    Mic,
    Smile,
    ArrowRight,
    Search,
    UserPlus,
    UserMinus,
    Trash2,
    CheckCircle,
    Info,
    Ban,
    Gamepad2,
    Reply,
    Phone,
    Video,
    User,
    Palette,
    Copy,
    X as CloseIcon,
    Image as ImageIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import DropdownMenu from '../common/DropdownMenu';
import Modal from '../common/Modal';
import VirtualizedMessageList from './VirtualizedMessageList';
import MessageInput from './MessageInput';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeTyping } from '../../hooks/useRealtimeTyping';
import { useInfiniteMessages } from '../../hooks/useMessages';
import { useGroupDetails } from '../../hooks/useGroupDetails';
import { useQueryClient } from '@tanstack/react-query';
import { useData } from '../../contexts/DataContext';
import { messageReadsService } from '../../services/messageReadsService';
import ForwardModal from './ForwardModal';
import GroupCallScreen from '../group/GroupCallScreen';
import GroupInfoDrawer from '../groups/GroupInfoDrawer';
import { realtimeManager } from '../../utils/realtimeManager';
import groupCallService from '../../services/groupCallService';
import toast from 'react-hot-toast';
import { debounce } from 'lodash';
import useIsDesktop from '../../hooks/useIsDesktop';
import useChatStore, { selectRoomScrollPosition } from '../../store/useChatStore';
import { useDeleteMessage } from '../../hooks/useDeleteMessage';
import { getPublicMediaUrl } from '../../services/mediaService';
import ImageViewer from './ImageViewer';
import MediaViewer from '../media/MediaViewer';
import GameLobby from './GameLobby';
import ChatBackground from './ChatBackground';
import styles from '../../styles/chat.module.css';

const GroupChat = () => {
    const { chatId } = useParams();
    const validChatId = chatId;
    const navigate = useNavigate();
    const location = useLocation();
    const { supabase } = useSupabase();
    const {
        chatTheme,
        chatWallpaper,
        chatThemes,
        chatPatterns,
        currentPattern,
        selectTheme,
        selectPattern,
        setChatId
    } = useChatTheme();
    const { user: currentUser, isAuthenticated, loading: authLoading } = useAuth();
    const { initializeGroupCall, joinGroupCall, leaveGroupCall } = useGroupCall();
    const isDesktop = useIsDesktop();
    const queryClient = useQueryClient();
    const { chats: allChats } = useData();
    const { showGroupInfo } = React.useContext(UserDetailsContext) || {};

    // Store actions
    const saveScrollPosition = useChatStore(state => state.saveScrollPosition);
    const initialScrollPosition = useChatStore(selectRoomScrollPosition(validChatId));

    // Delete Mutation
    const { mutate: deleteMessageMutation } = useDeleteMessage(validChatId);

    // Group Details
    const { data: groupDetails, isLoading: isGroupLoading, error: groupError } = useGroupDetails(validChatId);

    // Messages Pagination
    const {
        data: infiniteData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isMessagesLoading
    } = useInfiniteMessages(validChatId);

    // Derive messages from infinite data
    const messages = useMemo(() => {
        if (!infiniteData?.pages) return [];
        const allMsgs = infiniteData.pages.flatMap(page => page.data);
        // Important: VirtualizedMessageList usually expects them in order, 
        // but let's check what it expects. Usually it's reversed for infinite scroll.
        return [...allMsgs].reverse();
    }, [infiniteData]);

    const [group, setGroup] = useState(() => {
        const state = location.state;
        if (state?.groupName) {
            return {
                id: chatId,
                name: state.groupName,
                avatar: state.groupAvatar || null,
                member_count: state.memberCount || 0,
            };
        }
        return { id: chatId, name: 'Group Chat', avatar: null, member_count: 0 };
    });

    const [showGroupCallScreen, setShowGroupCallScreen] = useState(false);
    const [activeCallData, setActiveCallData] = useState(null);
    const [showGroupInfoDrawer, setShowGroupInfoDrawer] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [messagesToForward, setMessagesToForward] = useState([]);
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [showGameLobby, setShowGameLobby] = useState(false);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [currentImageUrl, setCurrentImageUrl] = useState(null);
    const [currentImageMessage, setCurrentImageMessage] = useState(null);
    const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
    const [currentMediaInfo, setCurrentMediaInfo] = useState(null);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [authError, setAuthError] = useState(null);

    const messagesContainerRef = useRef(null);

    // Sync chatId with theme context
    useEffect(() => {
        if (chatId) setChatId(chatId);
    }, [chatId, setChatId]);

    // Update group state when details load
    useEffect(() => {
        if (groupError) {
            console.error('[Auth] Group access denied:', groupError);
            setAuthError('Unauthorized: Group not found or access denied.');
            return;
        }

        if (groupDetails) {
            const isMember = groupDetails.group_members?.some(m => m.user_id === currentUser?.id);
            if (!isMember) {
                setAuthError('Unauthorized: You are not a member of this group.');
                return;
            }

            setGroup({
                ...groupDetails,
                id: groupDetails.id,
                name: groupDetails.name,
                avatar: groupDetails.avatar_url,
                member_count: groupDetails.group_members?.length || 0,
                my_role: groupDetails.group_members?.find(m => m.user_id === currentUser?.id)?.role || 'member'
            });
            setAuthError(null);
        }
    }, [groupDetails, groupError, currentUser?.id, isGroupLoading, validChatId, authLoading]);

    // ─── Authorization Guard ───
    useEffect(() => {
        if (authError) {
            toast.error(authError);
            navigate('/', { replace: true });
        }
    }, [authError, navigate]);

    // Theme Sync
    useEffect(() => {
        if (chatId) setChatId(chatId);
    }, [chatId, setChatId]);

    // Message Sync
    useEffect(() => {
        if (messages.length > 0 && validChatId) {
            saveMessagesToDevice(validChatId, messages);
        }
    }, [messages, validChatId]);

    // Debounced scroll position saver
    const debouncedSaveScroll = useCallback(
        debounce((id, index) => {
            saveScrollPosition(id, index);
        }, 500),
        [saveScrollPosition]
    );

    // Initial Load
    useEffect(() => {
        if (chatId) {
            setUnreadCount(0);
        }
    }, [chatId]);

    // Realtime
    const markMessagesAsRead = useCallback(async () => {
        if (!currentUser || !chatId) return;
        try {
            await messageReadsService.markAllAsRead(chatId, currentUser.id);
        } catch (e) {
            console.error('Read receipt error:', e);
        }
    }, [currentUser, chatId]);

    const { status: connectionStatus, retry: retryConnection } = useRealtimeMessages(validChatId, {
        onNewMessage: (newMessage) => {
            if (!isScrolledToBottom) {
                setUnreadCount(prev => prev + 1);
            } else {
                markMessagesAsRead();
            }
        }
    }, currentUser?.id);

    const { typingUsers, sendTyping } = useRealtimeTyping(validChatId, currentUser?.id);

    // Calls Monitor
    useEffect(() => {
        if (!chatId) return;
        const checkActiveCall = async () => {
            const activeCall = await groupCallService.getActiveGroupCall(chatId);
            if (activeCall) {
                const isUserInCall = activeCall.group_call_participants?.some(p => p.user_id === currentUser?.id && !p.left_at);
                setActiveCallData(isUserInCall ? null : activeCall);
            } else {
                setActiveCallData(null);
            }
        };
        checkActiveCall();
        const channelName = `group_calls_${chatId}`;
        realtimeManager.subscribe(channelName, {}, {
            postgres_changes: [
                { event: '*', schema: 'public', table: 'calls', filter: `group_id=eq.${chatId}`, handler: checkActiveCall },
                { event: '*', schema: 'public', table: 'group_call_participants', handler: checkActiveCall }
            ]
        });
        return () => realtimeManager.unsubscribe(channelName);
    }, [chatId, currentUser?.id]);

    // Handlers
    const sendMessage = async (content) => {
        if (!content.trim() || !currentUser) return;
        const tempId = Date.now().toString();
        const dbData = {
            chat_id: validChatId,
            sender_id: currentUser.id,
            content: content.trim(),
            message_type: 'text',
            is_group_message: true,
            created_at: new Date().toISOString(),
            status: navigator.onLine ? 'sending' : 'pending'
        };

        const tempMessage = { ...dbToFrontend(dbData), sender: currentUser, id: tempId, tempId };

        // Optimistic Update
        queryClient.setQueryData(['messages', validChatId], (old) => {
            if (!old) return { pages: [{ data: [tempMessage] }], pageParams: [null] };
            const newPages = [...old.pages];
            newPages[0] = { ...newPages[0], data: [tempMessage, ...newPages[0].data] };
            return { ...old, pages: newPages };
        });

        try {
            if (navigator.onLine) {
                const { data, error } = await supabase.from('messages').insert(dbData).select().single();
                if (error) throw error;

                // Replace temp message with real one
                queryClient.setQueryData(['messages', validChatId], (old) => {
                    if (!old) return old;
                    const newPages = old.pages.map(page => ({
                        ...page,
                        data: page.data.map(m => m.tempId === tempId ? { ...dbToFrontend(data), sender: currentUser } : m)
                    }));
                    return { ...old, pages: newPages };
                });
            } else {
                await addToSyncQueue('send_message', { ...dbData, tempId });
            }
        } catch (e) {
            toast.error('Send failed');
            // Rollback optimistic update
            queryClient.invalidateQueries({ queryKey: ['messages', validChatId] });
        }
    };

    const handleSendMedia = async (fileOrPath, mediaType) => {
        if (!fileOrPath || !currentUser) return;
        const isFile = fileOrPath instanceof File;
        const tempId = Date.now().toString();
        const dbData = {
            chat_id: validChatId,
            sender_id: currentUser.id,
            content: mediaType === 'image' ? '📷 Photo' : '🎥 Video',
            media_type: mediaType,
            message_type: mediaType,
            is_group_message: true,
            created_at: new Date().toISOString(),
            status: 'sending'
        };

        const previewUrl = isFile ? URL.createObjectURL(fileOrPath) : fileOrPath;
        const tempMessage = { ...dbToFrontend(dbData), sender: currentUser, id: tempId, tempId, media_url: previewUrl };

        // Optimistic Update
        queryClient.setQueryData(['messages', validChatId], (old) => {
            if (!old) return { pages: [{ data: [tempMessage] }], pageParams: [null] };
            const newPages = [...old.pages];
            newPages[0] = { ...newPages[0], data: [tempMessage, ...newPages[0].data] };
            return { ...old, pages: newPages };
        });

        try {
            await addToSyncQueue('send_message', { ...dbData, tempId, file: isFile ? fileOrPath : null });
            if (navigator.onLine) toast.success('Media uploading...');
        } catch (e) {
            toast.error('Media upload failed');
            // Rollback
            queryClient.invalidateQueries({ queryKey: ['messages', validChatId] });
        }
    };

    const handleScroll = (pos) => {
        if (pos.isAtTop && hasNextPage && !isFetchingNextPage) fetchNextPage();
        setIsScrolledToBottom(pos.isAtBottom);
        setShowScrollButton(!pos.isAtBottom);
        if (pos.isAtBottom && unreadCount > 0) {
            setUnreadCount(0);
            markMessagesAsRead();
        }
    };

    const handleForwardMessages = async (messages, targetChat) => {
        try {
            const isGroupTarget = targetChat.isGroup || targetChat.is_group || false;

            for (const message of messages) {
                const forwardMessage = {
                    chat_id: targetChat.id,
                    sender_id: currentUser.id,
                    receiver_id: isGroupTarget ? null : (targetChat.otherUser?.id || null),
                    content: message.content,
                    media_path: message.mediaPath || message.media_path,
                    media_type: message.mediaType || message.media_type,
                    message_type: message.messageType || message.message_type || (message.media_type === 'voice' ? 'audio' : message.media_type) || 'text',
                    reply_to: null,
                    is_group_message: Boolean(isGroupTarget),
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

    // Selection Handlers
    const exitSelectionMode = useCallback(() => {
        setSelectedMessages(new Set());
        setIsSelectionMode(false);
    }, []);

    const handleMessageSelect = (messageId) => {
        setSelectedMessages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
                if (newSet.size === 0) setIsSelectionMode(false);
            } else {
                newSet.add(messageId);
                setIsSelectionMode(true);
            }
            return newSet;
        });
    };

    const handleSelectionCopy = () => {
        const selectedMsgs = messages.filter(msg => selectedMessages.has(msg.id));
        const copyText = selectedMsgs.map(msg => msg.content).join('\n\n');
        navigator.clipboard.writeText(copyText);
        exitSelectionMode();
        toast.success('Messages copied');
    };

    const handleSelectionForward = () => {
        const selectedMsgs = messages.filter(msg => selectedMessages.has(msg.id));
        setMessagesToForward(selectedMsgs);
        setShowForwardModal(true);
        exitSelectionMode();
    };

    const handleSelectionDelete = () => {
        if (selectedMessages.size === 0) return;
        setShowDeleteModal(true);
    };

    const confirmSelectionDelete = async () => {
        setShowDeleteModal(false);
        const ids = Array.from(selectedMessages);
        exitSelectionMode();

        try {
            // Optimistic update for multiple deletion (optional, but good for UX)
            queryClient.setQueryData(['messages', validChatId], (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        data: page.data.map(m => ids.includes(m.id) ? { ...m, is_deleted: true, isDeleted: true } : m)
                    }))
                };
            });

            const { error } = await supabase
                .from('messages')
                .update({ is_deleted: true })
                .in('id', ids);

            if (error) throw error;
            toast.success('Deleted successfully');
        } catch (error) {
            console.error('Error deleting messages:', error);
            toast.error('Failed to delete messages');
            queryClient.invalidateQueries({ queryKey: ['messages', validChatId] });
        }
    };

    // Search Handlers
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
                    setSearchResults(data?.map(m => dbToFrontend(m)) || []);
                })
                .catch((error) => {
                    console.error('Error searching messages:', error);
                    setSearchResults([]);
                })
                .finally(() => {
                    setIsSearching(false);
                });
        }, 500),
        [chatId, supabase]
    );

    const handleSearchQueryChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
        }
        debouncedSearch(query);
    };

    const scrollToMessage = (messageId) => {
        const messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageElement.classList.add('highlight-message');
            setTimeout(() => {
                messageElement.classList.remove('highlight-message');
            }, 2000);
        }
        setShowSearchModal(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleSearchMessages = () => {
        setShowSearchModal(true);
    };

    const handleMediaDownload = async (url, filename) => {
        try {
            toast.loading('Downloading...', { id: 'download' });
            const response = await fetch(url);
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Downloaded!', { id: 'download' });
        } catch (e) {
            toast.error('Download failed', { id: 'download' });
        }
    };

    // Removed page transitions for instant look

    if (authLoading) return <div className="loading"><div className="loading-spinner"></div></div>;
    if (!isAuthenticated) { navigate('/login'); return null; }

    return (
        <div
            className={`${styles['chat-screen']} ${showGroupInfoDrawer ? styles['drawer-open'] : ''}`}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%' }}
        >
            <div className={styles['chat-main-area']}>
                <ChatBackground
                    active={true}
                    showPattern={Boolean(currentPattern) || chatThemes[chatTheme]?.is_pattern}
                >
                    <div className={styles['chat-main-area-content']}>
                        <header className={styles['chat-header']}>
                            <button className={styles['back-btn']} onClick={() => navigate('/')}><ArrowLeft size={20} /></button>
                            <div className={styles['chat-user-info']} onClick={() => isDesktop ? showGroupInfo(chatId, group) : navigate(`/chat/${chatId}/group/info`)}>
                                <div className={styles['user-avatar']}>
                                    {group?.avatar ? <img src={group.avatar} alt={group.name} /> : <div className={styles['user-avatar-placeholder']}>{group?.name?.charAt(0)}</div>}
                                </div>
                                <div className={styles['user-details']}>
                                    <h3 className={styles['user-name']}>{group?.name}</h3>
                                    <p className={styles['user-status']}>{group?.member_count} members</p>
                                </div>
                            </div>
                            <div className={styles['chat-actions']}>
                                <button className={styles['icon-btn']} onClick={() => setShowGroupCallScreen(true)}><Phone size={20} /></button>
                                <button className={styles['icon-btn']} onClick={() => setShowGroupCallScreen(true)}><Video size={20} /></button>
                                <DropdownMenu items={[
                                    { icon: <User size={16} />, label: 'Group Info', onClick: () => isDesktop ? showGroupInfo(chatId, group) : navigate(`/chat/${chatId}/group/info`) },
                                    { icon: <Search size={16} />, label: 'Search Messages', onClick: handleSearchMessages },
                                    { icon: <Palette size={16} />, label: 'Themes', onClick: () => setShowThemeModal(true) },
                                    { icon: <ImageIcon size={16} />, label: 'Shared Media', onClick: () => navigate(`${location.pathname}/media`) },
                                    { icon: <Gamepad2 size={16} />, label: 'Game Room', onClick: () => setShowGameLobby(true) },
                                    ...(currentUser?.isAdmin ? [
                                        { icon: <Crown size={16} />, label: 'Admin', onClick: () => navigate('/admin') }
                                    ] : []),
                                    { divider: true },
                                    { icon: <Ban size={16} />, label: 'Leave Group', onClick: () => setShowGroupInfoDrawer(true), danger: true }
                                ]} />
                            </div>
                        </header>

                        {activeCallData && (
                            <div className="active-call-banner">
                                <div className="banner-content">
                                    <span>Ongoing Group Call ({activeCallData.group_call_participants?.length} joined)</span>
                                </div>
                                <button className="banner-join-btn" onClick={() => { joinGroupCall(activeCallData.id); setShowGroupCallScreen(true); }}>Join</button>
                            </div>
                        )}

                        {!navigator.onLine && connectionStatus === 'connecting' && (
                            <div className={`${styles['connection-banner']} ${styles.connecting}`}>
                                <div className={styles.spinner}></div>
                                Waiting for network...
                            </div>
                        )}

                        {!navigator.onLine && connectionStatus === 'disconnected' && (
                            <div className={`${styles['connection-banner']} ${styles.disconnected}`} onClick={retryConnection} style={{ cursor: 'pointer' }}>
                                Offline. Tap to retry.
                            </div>
                        )}

                        {/* Selection Toolbar */}
                        {isSelectionMode && (
                            <div className={styles['selection-toolbar']}>
                                <button className={styles['selection-close-btn']} onClick={exitSelectionMode}>
                                    <CloseIcon size={20} />
                                </button>
                                <div className={styles['selection-info']}>
                                    {selectedMessages.size} selected
                                </div>
                                <div className={styles['selection-actions']}>
                                    {selectedMessages.size === 1 && (
                                        <button
                                            className={styles['selection-action-btn']}
                                            title="Reply"
                                            onClick={() => {
                                                const messageId = Array.from(selectedMessages)[0];
                                                const message = messages.find(msg => msg.id === messageId);
                                                if (message) setReplyingTo(message);
                                                exitSelectionMode();
                                            }}
                                        >
                                            <Reply size={16} />
                                        </button>
                                    )}
                                    <button className={styles['selection-action-btn']} title="Copy" onClick={handleSelectionCopy}>
                                        <Copy size={16} />
                                    </button>
                                    <button className={styles['selection-action-btn']} title="Forward" onClick={handleSelectionForward}>
                                        <ArrowRight size={16} />
                                    </button>
                                    <button className={styles['selection-action-btn']} title="Delete" onClick={handleSelectionDelete}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={styles['messages-container']}>
                            {isFetchingNextPage && <div className={styles['load-more-indicator']}><div className={styles['loading-spinner']}></div></div>}
                            <VirtualizedMessageList
                                ref={messagesContainerRef}
                                messages={messages}
                                currentUser={currentUser}
                                chatId={validChatId}
                                isGroupChat={true}
                                onScroll={handleScroll}
                                onReply={setReplyingTo}
                                onForward={handleForwardMessage}
                                onDelete={(messageId) => deleteMessageMutation(messageId)}
                                selectedMessages={selectedMessages}
                                isSelectionMode={isSelectionMode}
                                onMessageSelect={handleMessageSelect}
                                onMediaView={(url, type, msg) => {
                                    if (type === 'image') { setCurrentImageUrl(url); setCurrentImageMessage(msg); setImageViewerOpen(true); }
                                    else { setCurrentMediaInfo({ fileInfo: { storage_url: url, file_type: type }, messageId: msg.id }); setMediaViewerOpen(true); }
                                }}
                                onMediaDownload={handleMediaDownload}
                                isLoading={isMessagesLoading}
                                isScrolledToBottom={isScrolledToBottom}
                                typingUsers={typingUsers}
                                onSenderClick={(userId) => navigate(`/chat/new/${userId}`)}
                                initialTopMostItemIndex={initialScrollPosition}
                                onRangeChanged={(index) => debouncedSaveScroll(validChatId, index)}
                            />
                            {showScrollButton && (
                                <button className={styles['scroll-bottom-btn']} onClick={() => messagesContainerRef.current?.scrollToBottom('smooth')}>
                                    <ArrowDown size={20} />
                                    {unreadCount > 0 && <span className={styles['unread-count']}>{unreadCount}</span>}
                                </button>
                            )}
                        </div>

                        <MessageInput
                            onSendMessage={sendMessage}
                            onSendMedia={handleSendMedia}
                            onTyping={sendTyping}
                            replyingTo={replyingTo}
                            onCancelReply={() => setReplyingTo(null)}
                            chatId={chatId}
                            currentUser={currentUser}
                            disabled={group?.admins_only_messages && group?.my_role !== 'admin' && group?.my_role !== 'creator'}
                        />
                    </div>

                    {!isDesktop && showGroupInfoDrawer && (
                        <GroupInfoDrawer
                            isOpen={showGroupInfoDrawer}
                            onClose={() => setShowGroupInfoDrawer(false)}
                            group={group}
                        />
                    )}

                    {showGroupCallScreen && (
                        <GroupCallScreen groupId={chatId} onEndCall={() => setShowGroupCallScreen(false)} />
                    )}

                    <ImageViewer
                        isOpen={imageViewerOpen}
                        onClose={() => setImageViewerOpen(false)}
                        imageUrl={currentImageUrl}
                        message={currentImageMessage}
                    />

                    <MediaViewer
                        isOpen={mediaViewerOpen}
                        onClose={() => setMediaViewerOpen(false)}
                        {...currentMediaInfo}
                    />

                    <Modal isOpen={showThemeModal} onClose={() => setShowThemeModal(false)} title="Choose Theme" size="large">
                        <div className={styles['theme-selector']}>
                            <div className={styles['theme-section']}>
                                <h4 className={styles['theme-section-title']}>Chat Themes</h4>
                                <div className={styles['theme-grid']}>
                                    {Object.entries(chatThemes).map(([key, theme]) => (
                                        <div
                                            key={key}
                                            className={`${styles['theme-capsule']} ${chatTheme === key ? styles.active : ''}`}
                                            onClick={() => selectTheme(key)}
                                        >
                                            <div
                                                className={styles['theme-capsule-preview']}
                                                style={{ background: theme.background }}
                                            />
                                            <span className={styles['theme-capsule-name']}>
                                                {theme.name}
                                            </span>
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
                                                    '--pattern-url': `url(/assets/${pattern.id}.svg)`,
                                                    WebkitMaskImage: 'var(--pattern-url)',
                                                    maskImage: 'var(--pattern-url)'
                                                }}
                                            />
                                            <span className={styles['pattern-card-name']}>{pattern.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Modal>

                    <Modal 
                        isOpen={showGameLobby} 
                        onClose={() => setShowGameLobby(false)} 
                        title="Arena Lobby" 
                        size="large"
                    >
                        <GameLobby 
                            chatId={chatId} 
                            otherUserId={null} 
                            onStartTruthDare={() => navigate(`/chat/${chatId}/arena`)}
                            onResumeGame={() => navigate(`/chat/${chatId}/arena`)}
                        />
                    </Modal>

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

                    {/* Confirmation Modal for deletion */}
                    <Modal
                        isOpen={showDeleteModal}
                        onClose={() => setShowDeleteModal(false)}
                        title="Delete Messages"
                    >
                        <div className={styles['delete-confirm-modal']}>
                            <p>Are you sure you want to delete {selectedMessages.size} message{selectedMessages.size > 1 ? 's' : ''}?</p>
                            <div className={styles['modal-actions']}>
                                <button className={`${styles['modal-btn']} ${styles.secondary}`} onClick={() => setShowDeleteModal(false)}>Cancel</button>
                                <button className={`${styles['modal-btn']} ${styles.danger}`} onClick={confirmSelectionDelete}>Delete</button>
                            </div>
                        </div>
                    </Modal>

                    {/* Search Modal */}
                    <Modal
                        isOpen={showSearchModal}
                        onClose={() => setShowSearchModal(false)}
                        title="Search Messages"
                    >
                        <div className={styles['search-modal-content']}>
                            <div className={styles['search-input-container']}>
                                <Search size={18} />
                                <input
                                    type="text"
                                    placeholder="Search in group..."
                                    className={styles['search-input']}
                                    value={searchQuery}
                                    onChange={handleSearchQueryChange}
                                    autoFocus
                                />
                            </div>

                            <div className={styles['search-results']}>
                                {isSearching ? (
                                    <div className={styles['search-loading']}>Searching...</div>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map(result => (
                                        <div
                                            key={result.id}
                                            className={styles['search-result-item']}
                                            onClick={() => scrollToMessage(result.id)}
                                        >
                                            <div className={styles['result-header']}>
                                                <span className={styles['result-sender']}>{result.sender_name || 'Member'}</span>
                                                <span className={styles['result-time']}>{new Date(result.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className={styles['result-content']}>{result.content}</p>
                                        </div>
                                    ))
                                ) : searchQuery ? (
                                    <div className={styles['no-results']}>No messages found</div>
                                ) : (
                                    <div className={styles['search-placeholder']}>Type to search messages</div>
                                )}
                            </div>
                        </div>
                    </Modal>
                </ChatBackground>
            </div>
        </div>
    );
};

export default GroupChat;
