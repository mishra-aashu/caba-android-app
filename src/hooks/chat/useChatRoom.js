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
  const activeChat = useChatStore(state => state.activeChat);
  
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

  // Sync activeChat with URL params if they differ — without scanning entire DB
  useEffect(() => {
    if (paramChatId && (!activeChat || String(activeChat.id) !== String(paramChatId))) {
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
  }, [paramChatId, paramOtherUserId, allChats.length, activeChat === null, setActiveChat, location.pathname]);




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

  // ─── NEW MESSAGE HANDLER (REF PATTERN TO AVOID TDZ) ───
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
      // [AUTO VANISH SYNC]
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

  // [NOTE] Auto-Vanish on load was removed as it prevented manual turn-off.
  // The system now correctly relies on:
  // 1. Initial settings fetch in useChatSettings
  // 2. Realtime sync in useChatSettings
  // 3. onNewMessage trigger above

  // ─── AUTHORIZATION CHECK ───
  const [authError, setAuthError] = useState(null);

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

  // [FIX] Mark as read when entering the room or when room changes
  useEffect(() => {
    if (chatId && chatId !== 'new' && currentUser?.id) {
      markMessagesAsRead();
    }
  }, [chatId, currentUser?.id, markMessagesAsRead]);

  useEffect(() => {
    if (authLoading || isDataLoading || isNewChat || !chatId || !currentUser) return;

    const verifyParticipation = async () => {
      // 1. Check in-memory chat list (fastest)
      const chatInList = allChats.find((c) => String(c.id) === String(chatId));
      if (chatInList) {
        setAuthError(null);
        return;
      }

      // 2. If not in list, check if it's a group the user belongs to
      if (isGroupChat) {
        const { data: group, error } = await supabase
          .from('groups')
          .select('id')
          .eq('id', chatId)
          .single();

        if (error || !group) {
          console.error('[Auth] Group access denied or not found');
          setAuthError('Unauthorized: You are not a member of this group.');
          return;
        }
      } else {
        // 3. For DMs, check the chats table (which should be protected by RLS)
        const { data: chat, error } = await supabase
          .from('chats')
          .select('id')
          .eq('id', chatId)
          .single();

        if (error || !chat) {
          console.error('[Auth] Chat access denied or not found');
          setAuthError('Unauthorized: You are not a participant of this chat.');
          return;
        }
      }
      setAuthError(null);
    };

    verifyParticipation();
  }, [chatId, allChats, authLoading, isDataLoading, isNewChat, isGroupChat, currentUser, supabase]);

  // ─── STORE / UI ───
  const saveScrollPosition = useChatStore((state) => state.saveScrollPosition);
  const initialScrollPosition = useChatStore(selectRoomScrollPosition(chatId));

  // ─── GAME HANDLERS ───
  const handleAcceptGame = useCallback(
    async (message) => {
      const { invitationId } = message.metadata || {};
      if (!invitationId) return;
      try {
        await messagesApi.sendMessage('Battle Accepted! 🔥', { vanishAt: null });
        navigate(`/games`);
      } catch (error) {
        toast.error('Failed to accept battle');
      }
    },
    [messagesApi, navigate, chatId, otherUserId]
  );

  const handleShareAsForward = useCallback(
    (mediaUrl, message) => [{ ...message, id: `fwd_${Date.now()}` }],
    []
  );

  const handleJoinGame = useCallback(
    () => navigate(`/games`),
    [navigate, chatId, otherUserId]
  );

  const handleRejectGame = useCallback(() => {
    toast.success('Battle declined');
  }, []);

  // [PERF] Memoize sub-hook APIs to stabilize downstream components
  const memoizedMessagesApi = useMemo(() => messagesApi, [messagesApi]);
  const memoizedMediaApi = useMemo(() => mediaApi, [mediaApi]);
  const memoizedPresenceApi = useMemo(() => presenceApi, [presenceApi]);
  const memoizedCallsApi = useMemo(() => callsApi, [callsApi]);
  const memoizedSettingsApi = useMemo(() => settingsApi, [settingsApi]);

  // [PERF] The master API object that ChatScreen consumes
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
    
    // Messages
    messages: memoizedMessagesApi.messages,
    isFetchingNextPage: memoizedMessagesApi.isFetchingNextPage,
    hasNextPage: memoizedMessagesApi.hasNextPage,
    fetchNextPage: memoizedMessagesApi.fetchNextPage,
    deleteMessage: memoizedMessagesApi.deleteMessage,
    forwardMessages: memoizedMessagesApi.forwardMessages,
    handleReactionToggle: memoizedMessagesApi.handleReactionToggle,
    isMessagesLoading: memoizedMessagesApi.isLoading,
    
    // Media & Sending
    sendMessage: memoizedMessagesApi.sendMessage,
    handleSendMedia: memoizedMediaApi.handleSendMedia,
    replyingTo: memoizedMessagesApi.replyingTo,
    handleReply: memoizedMessagesApi.handleReply,
    cancelReply: memoizedMessagesApi.cancelReply,
    handleMediaDownload: memoizedMediaApi.handleMediaDownload,

    // Presence & Typing
    typingUsers: memoizedPresenceApi.typingUsers,
    sendTyping: memoizedPresenceApi.sendTyping,
    
    // Status
    connectionStatus: memoizedMessagesApi.connectionStatus,
    retryConnection: memoizedMessagesApi.retryConnection,
    isMuted: memoizedSettingsApi.isMuted,
    isTempChat: memoizedSettingsApi.isTempChat,
    setIsTempChat: memoizedSettingsApi.setIsTempChat,
    toggleVanishMode: memoizedSettingsApi.toggleVanishMode,
    selectedVanishDuration: memoizedSettingsApi.selectedVanishDuration,
    updateVanishDuration: memoizedSettingsApi.updateVanishDuration,
    isVanishLoading: memoizedSettingsApi.isVanishLoading,
    vanishPresets: memoizedSettingsApi.vanishPresets,
    handleMuteToggle: memoizedSettingsApi.handleMuteToggle,

    // Calls
    activeGroupCall: memoizedCallsApi.activeGroupCall,
    showGroupCallScreen: memoizedCallsApi.showGroupCallScreen,
    setShowGroupCallScreen: memoizedCallsApi.setShowGroupCallScreen,
    handleVoiceCall: memoizedCallsApi.handleVoiceCall,
    handleVideoCall: memoizedCallsApi.handleVideoCall,
    handleEndGroupCall: memoizedCallsApi.handleEndGroupCall,
    handleStartGroupCall: memoizedCallsApi.handleStartGroupCall,
    
    // Modals & Alerts
    showAlert,
    confirmClearChat: memoizedSettingsApi.confirmClearChat,
    confirmBlockUser: memoizedSettingsApi.confirmBlockUser,
    confirmSelectionDelete: memoizedMessagesApi.confirmSelectionDelete,
    
    // Games
    handleAcceptGame,
    handleRejectGame,
    handleJoinGame,
    
    // Store & State
    supabase,
    initialScrollPosition,
    saveScrollPosition,
    allChats,
    authError,
    markMessagesAsRead,
    unreadCount,
    setUnreadCount,
    isScrolledToBottom,
    setIsScrolledToBottom,
    handleShareAsForward
  }), [
    chatId, otherUserId, isGroupChat, isNewChat, navigate, location, 
    currentUser, otherUser, setOtherUser, authLoading, isDataLoading,
    memoizedMessagesApi, memoizedMediaApi, memoizedPresenceApi, 
    memoizedCallsApi, memoizedSettingsApi, showAlert, handleAcceptGame, 
    handleRejectGame, handleJoinGame, supabase, initialScrollPosition, 
    saveScrollPosition, allChats, authError, markMessagesAsRead, 
    unreadCount, isScrolledToBottom, handleShareAsForward
  ]);
};

export default useChatRoom;