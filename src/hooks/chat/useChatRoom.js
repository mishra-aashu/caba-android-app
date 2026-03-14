/**
 * useChatRoom.js
 *
 * Orchestrator hook that composes specialized sub-hooks.
 */
import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDialog } from '../../contexts/DialogContext';
import { useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useSupabase } from '../../contexts/SupabaseContext';
import useChatStore, { selectRoomScrollPosition } from '../../store/useChatStore';
// FIX: Missing toast import — was causing runtime crash
import toast from 'react-hot-toast';

// Sub-hooks
import { useChatParticipant } from './useChatParticipant';
import { useChatMessages } from './useChatMessages';
import { useChatMedia } from './useChatMedia';
import { useChatPresence } from './useChatPresence';
import { useChatCalls } from './useChatCalls';
import { useChatSettings } from './useChatSettings';

const useChatRoom = (options = {}) => {
  const { onNewMessage } = options;
  const { chatId, otherUserId: rawOtherUserId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user: currentUser, loading: authLoading, isAuthenticated } = useAuth();
  const { showAlert } = useDialog();
  const rawChats = useLiveQuery(() => db.chats_list.toArray());
  const allChats = rawChats || [];
  const isDataLoading = rawChats === undefined;
  const { supabase } = useSupabase();

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

  // ─── MESSAGES ───
  const messagesApi = useChatMessages({
    chatId,
    otherUserId,
    isGroupChat,
    isNewChat,
    currentUser,
    onNewMessage,
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

  // ─── AUTHORIZATION CHECK ───
  const [authError, setAuthError] = useState(null);

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
        // useGroupDetails will naturally handle authorization if RLS is set up,
        // but we double-check here for extra safety.
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
        navigate(`/arena/${chatId}/${otherUserId}`);
      } catch (error) {
        toast.error('Failed to accept battle');
      }
    },
    [messagesApi, navigate, chatId, otherUserId]
  );

  // FIX: Wrapped in useCallback to prevent unnecessary re-renders
  const handleShareAsForward = useCallback(
    (mediaUrl, message) => [{ ...message, id: `fwd_${Date.now()}` }],
    []
  );

  const handleJoinGame = useCallback(
    () => navigate(`/arena/${chatId}/${otherUserId}`),
    [navigate, chatId, otherUserId]
  );

  const handleRejectGame = useCallback(() => {
    toast.success('Battle declined');
  }, []);

  return {
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
    isInitializing: false,
    allChats,
    authLoading,
    isAuthenticated,
    supabase,

    // Messages
    ...messagesApi,
    confirmSelectionDelete: messagesApi.deleteSelectedMessages,

    // Media
    ...mediaApi,

    // Presence
    ...presenceApi,

    // Calls
    ...callsApi,
    activeGroupCall: null,

    // Settings
    ...settingsApi,
    setVanishPresets: () => {},

    // UI Extras
    showAlert,
    initialScrollPosition,
    saveScrollPosition,
    queryClient,
    handleShareAsForward,
    handleAcceptGame,
    handleJoinGame,
    handleRejectGame,
    handleReactionToggle: messagesApi.toggleReaction,
    authError,
  };
};

export default useChatRoom;