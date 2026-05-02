/**
 * useChatRoom.js
 *
 * Orchestrator hook that composes specialized sub-hooks.
 */
import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDialog } from '../../contexts/DialogContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useSupabase } from '../../contexts/SupabaseContext';
import useChatStore, { selectRoomScrollPosition } from '../../store/useChatStore';

import toast from 'react-hot-toast';
import { messageReadsService } from '../../services/messageReadsService';

// Sub-hooks
import { useChatParticipant } from './useChatParticipant';
import { useChatMessages } from './useChatMessages';
import { useChatMedia } from './useChatMedia';
import { useChatPresence } from './useChatPresence';
import { useChatCalls } from './useChatCalls';
import { useChatSettings } from './useChatSettings';

const useChatRoom = () => {

    const { chatId: paramChatId, otherUserId: paramOtherUserId } = useParams();
    const { activeChat } = useChatStore();

    // Use store if available, otherwise fallback to params
    const chatId = paramChatId || activeChat?.id;
    const rawOtherUserId = paramOtherUserId || activeChat?.metadata?.otherUserId || (activeChat?.isGroup ? 'group' : null);

    const navigate = useNavigate();
    const location = useLocation();
    const { user: currentUser, loading: authLoading, isAuthenticated } = useAuth();
    const { showAlert } = useDialog();
    const { supabase } = useSupabase();
    const setActiveChat = useChatStore(state => state.setActiveChat);
    
    // Restore live query but keep it minimal
    const rawChats = useLiveQuery(() => db.chats_list.toArray());
    const allChats = rawChats || [];
    const isDataLoading = rawChats === undefined;

    // Sync activeChat with URL params if they differ
    useEffect(() => {
        if (!paramChatId) return;
        
        const isSame = activeChat && String(activeChat.id) === String(paramChatId);
        if (!isSame) {
            console.log('🔄 [useChatRoom] URL Sync: Setting active chat', paramChatId);
            const chatInList = allChats.find(c => String(c.id) === String(paramChatId));
            if (chatInList) {
                setActiveChat(chatInList);
            } else {
                setActiveChat({ 
                    id: paramChatId, 
                    isGroup: paramOtherUserId === 'group' || location.pathname.endsWith('/group'),
                    metadata: { otherUserId: paramOtherUserId !== 'group' ? paramOtherUserId : null }
                });
            }
        }
    }, [paramChatId, paramOtherUserId, setActiveChat, location.pathname]);

    // ─── ROUTING & IDENTITY ───
    const isGroupChat = rawOtherUserId === 'group' || location.pathname.endsWith('/group');
    const isNewChat = chatId === 'new';
    const otherUserId = isGroupChat ? null : rawOtherUserId;

    // ─── AUTH GUARD ───
    useEffect(() => {
        if (!authLoading && !isAuthenticated) navigate('/login');
    }, [authLoading, isAuthenticated, navigate]);

    // ─── PARTICIPANT ───
    const { otherUser, setOtherUser } = useChatParticipant({
        chatId,
        otherUserId,
        isGroupChat,
        currentUser,
    });

    // ─── PRESENCE ───
    const presenceApi = useChatPresence({
        chatId,
        otherUserId,
        isGroupChat,
        currentUserId: currentUser?.id,
        onPresenceChange: useCallback(
            (status) => {
                setOtherUser((prev) => (prev ? { ...prev, ...status } : prev));
            },
            [setOtherUser]
        ),
    });

    // ─── READ STATUS ───
    const markMessagesAsRead = useCallback(async () => {
        try {
            if (!currentUser || !chatId || chatId === 'new') return;
            await messageReadsService.markAllAsRead(chatId, currentUser.id);
        } catch (error) {
            console.error('[ChatRoom] Error marking messages as read:', error);
        }
    }, [currentUser?.id, chatId]);

    // ─── NEW MESSAGE HANDLER (REF PATTERN) ───
    const onNewMessageRef = useRef(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);

    // ─── MESSAGES ───
    const messagesApi = useChatMessages({
        chatId,
        otherUserId,
        isGroupChat,
        isNewChat,
        currentUser,
        onNewMessage: (msg) => onNewMessageRef.current?.(msg),
    });

    // ─── MEDIA ───
    const mediaApi = useChatMedia({
        chatId,
        otherUserId,
        isGroupChat,
        currentUser,
        isNewChat,
        replyingTo: messagesApi.replyingTo,
        setReplyingTo: messagesApi.setReplyingTo,
    });

    // ─── CALLS ───
    const callsApi = useChatCalls({
        chatId,
        otherUserId,
        otherUser,
        isGroupChat,
        currentUser,
    });

    // ─── SETTINGS ───
    const settingsApi = useChatSettings({
        chatId,
        otherUserId,
        currentUser,
    });

    // Define the actual logic and update the ref
    useEffect(() => {
        onNewMessageRef.current = (msg) => {
            if ((msg.vanishAt || msg.vanish_at) && !settingsApi.isTempChat) {
                settingsApi.setIsTempChat(true);
            }

            if (!isScrolledToBottom) {
                setUnreadCount(prev => prev + 1);
            } else {
                markMessagesAsRead();
            }
        };
    }, [isScrolledToBottom, markMessagesAsRead, settingsApi]);

    // ─── NEW CHAT AUTO-TRANSITION ───
    useEffect(() => {
        if (!isNewChat || !otherUserId || allChats.length === 0) return;

        const newActiveChat = allChats.find(c => 
            !c.isGroup && (
                String(c.otherUserId) === String(otherUserId) || 
                String(c.metadata?.otherUserId) === String(otherUserId)
            )
        );

        if (newActiveChat) {
            console.log('[ChatRoom] New chat detected, navigating...', newActiveChat.id);
            navigate(`/chat/${newActiveChat.id}/${otherUserId}`, { replace: true });
        }
    }, [isNewChat, otherUserId, allChats, navigate]);

    // Mark as read when entering the room
    useEffect(() => {
        if (chatId && chatId !== 'new' && currentUser?.id) {
            markMessagesAsRead();
        }
    }, [chatId, currentUser?.id, markMessagesAsRead]);

    // ─── AUTHORIZATION CHECK ───
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        if (authLoading || isDataLoading || isNewChat || !chatId || !currentUser) return;

        const verifyParticipation = async () => {
            // [OFFLINE-FIRST] Step 1: Trust Local Cache (Dexie)
            // If the chat exists in our local list, they are authorized to see it.
            const chatInList = allChats.find((c) => String(c.id) === String(chatId));
            if (chatInList) {
                setAuthError(null);
                return;
            }

            // Step 2: Server-side validation (Only if offline cache is missing)
            // This allows entry to new chats shared via deep-link while online.
            if (!navigator.onLine) {
                // If offline and not in cache, we can't verify, but we also can't fetch.
                // We'll show a "not in cache" error instead of "unauthorized".
                setAuthError('This chat is not available offline. Please connect to the internet.');
                return;
            }

            try {
                if (isGroupChat) {
                    const { data: group, error } = await supabase
                        .from('groups')
                        .select('id')
                        .eq('id', chatId)
                        .single();

                    if (error || !group) {
                        setAuthError('Unauthorized: You are not a member of this group.');
                        return;
                    }
                } else {
                    const { data: chat, error } = await supabase
                        .from('chats')
                        .select('id')
                        .eq('id', chatId)
                        .single();

                    if (error || !chat) {
                        setAuthError('Unauthorized: You are not a participant of this chat.');
                        return;
                    }
                }
                setAuthError(null);
            } catch (err) {
                console.warn('[useChatRoom] Remote auth check failed:', err);
                // On error (e.g. network timeout), don't block if we can't be sure
            }
        };

        verifyParticipation();
    }, [chatId, allChats, authLoading, isDataLoading, isNewChat, isGroupChat, currentUser, supabase]);

    // ─── STORE / UI ───
    const saveScrollPosition = useChatStore((state) => state.saveScrollPosition);
    const initialScrollPosition = useChatStore(selectRoomScrollPosition(chatId));

    // ─── GAME HANDLERS ───
    const handleAcceptGame = useCallback(async (message) => {
        const { invitationId } = message.metadata || {};
        if (!invitationId) return;
        try {
            await messagesApi.sendMessage('Battle Accepted! 🔥', { vanishAt: null });
            navigate(`/games`);
        } catch (error) {
            toast.error('Failed to accept battle');
        }
    }, [messagesApi, navigate]);

    const handleShareAsForward = useCallback((mediaUrl, message) => {
        return [{ ...message, id: `fwd_${Date.now()}` }];
    }, []);

    const handleJoinGame = useCallback(() => navigate(`/games`), [navigate]);
    const handleRejectGame = useCallback(() => toast.success('Battle declined'), []);

    // ─── STABILIZE SUB-HOOK APIs ───
    // Only recreate when the actual data inside changes
    const stableMessagesApi = useMemo(() => ({
        messages: messagesApi.messages || [],
        isFetchingNextPage: messagesApi.isFetchingNextPage,
        hasNextPage: messagesApi.hasNextPage,
        fetchNextPage: messagesApi.fetchNextPage,
        deleteMessage: messagesApi.deleteMessage,
        forwardMessages: messagesApi.forwardMessages,
        handleReactionToggle: messagesApi.handleReactionToggle,
        isMessagesLoading: messagesApi.isMessagesLoading,
        isDexieLoading: messagesApi.isDexieLoading,
        sendMessage: messagesApi.sendMessage,
        replyingTo: messagesApi.replyingTo,
        handleReply: messagesApi.handleReply,
        cancelReply: messagesApi.cancelReply,
        connectionStatus: messagesApi.connectionStatus,
        retryConnection: messagesApi.retryConnection,
        confirmSelectionDelete: messagesApi.confirmSelectionDelete,
        handleManualRetry: messagesApi.handleManualRetry,
    }), [
        messagesApi.messages,
        messagesApi.isMessagesLoading,
        messagesApi.isDexieLoading,
        messagesApi.isFetchingNextPage,
        messagesApi.hasNextPage,
    ]);

    const stableMediaApi = useMemo(() => mediaApi, [mediaApi.handleSendMedia, mediaApi.handleMediaDownload]);
    const stablePresenceApi = useMemo(() => presenceApi, [presenceApi.typingUsers]);
    const stableCallsApi = useMemo(() => callsApi, [callsApi.activeGroupCall]);
    const stableSettingsApi = useMemo(() => settingsApi, [
        settingsApi.isMuted, 
        settingsApi.isTempChat, 
        settingsApi.selectedVanishDuration
    ]);

    // ─── FINAL STABLE API OBJECT ───
    return useMemo(() => ({
        // Identity
        chatId,
        validChatId: chatId,
        otherUserId,
        isGroupChat,
        isNewChat,
        navigate,
        location,
        currentUser,
        otherUser,
        setOtherUser,
        isInitializing: authLoading || isDataLoading,
        
        // Messages (STABLE)
        messages: stableMessagesApi.messages,
        isFetchingNextPage: stableMessagesApi.isFetchingNextPage,
        hasNextPage: stableMessagesApi.hasNextPage,
        fetchNextPage: stableMessagesApi.fetchNextPage,
        deleteMessage: stableMessagesApi.deleteMessage,
        forwardMessages: stableMessagesApi.forwardMessages,
        handleReactionToggle: stableMessagesApi.handleReactionToggle,
        isMessagesLoading: stableMessagesApi.isMessagesLoading,
        isDexieLoading: stableMessagesApi.isDexieLoading,
        
        // Media & Sending
        sendMessage: stableMessagesApi.sendMessage,
        handleSendMedia: stableMediaApi.handleSendMedia,
        replyingTo: stableMessagesApi.replyingTo,
        handleReply: stableMessagesApi.handleReply,
        cancelReply: stableMessagesApi.cancelReply,
        handleMediaDownload: stableMediaApi.handleMediaDownload,

        // Presence & Typing
        typingUsers: stablePresenceApi.typingUsers,
        sendTyping: stablePresenceApi.sendTyping,
        
        // Status
        connectionStatus: stableMessagesApi.connectionStatus,
        retryConnection: stableMessagesApi.retryConnection,
        isMuted: stableSettingsApi.isMuted,
        isTempChat: stableSettingsApi.isTempChat,
        setIsTempChat: stableSettingsApi.setIsTempChat,
        toggleVanishMode: stableSettingsApi.toggleVanishMode,
        selectedVanishDuration: stableSettingsApi.selectedVanishDuration,
        updateVanishDuration: stableSettingsApi.updateVanishDuration,
        isVanishLoading: stableSettingsApi.isVanishLoading,
        vanishPresets: stableSettingsApi.vanishPresets,
        handleMuteToggle: stableSettingsApi.handleMuteToggle,

        // Calls
        activeGroupCall: stableCallsApi.activeGroupCall,
        showGroupCallScreen: stableCallsApi.showGroupCallScreen,
        setShowGroupCallScreen: stableCallsApi.setShowGroupCallScreen,
        handleVoiceCall: stableCallsApi.handleVoiceCall,
        handleVideoCall: stableCallsApi.handleVideoCall,
        handleEndGroupCall: stableCallsApi.handleEndGroupCall,
        handleStartGroupCall: stableCallsApi.handleStartGroupCall,
        
        // Modals & Alerts
        showAlert,
        confirmClearChat: stableSettingsApi.confirmClearChat,
        confirmBlockUser: stableSettingsApi.confirmBlockUser,
        confirmSelectionDelete: stableMessagesApi.confirmSelectionDelete,
        
        // Games
        handleAcceptGame,
        handleRejectGame,
        handleJoinGame,
        
        // Store & State
        supabase,
        initialScrollPosition,
        saveScrollPosition,
        authError,
        markMessagesAsRead,
        unreadCount,
        setUnreadCount,
        isScrolledToBottom,
        setIsScrolledToBottom,
        handleShareAsForward,
        handleManualRetry: stableMessagesApi.handleManualRetry
    }), [
        chatId, otherUserId, isGroupChat, isNewChat, currentUser, otherUser, 
        authLoading, isDataLoading, stableMessagesApi, stableMediaApi, 
        stablePresenceApi, stableCallsApi, stableSettingsApi, showAlert, 
        handleAcceptGame, handleRejectGame, handleJoinGame, initialScrollPosition,
        authError, markMessagesAsRead, unreadCount, isScrolledToBottom
    ]);
};

export default useChatRoom;