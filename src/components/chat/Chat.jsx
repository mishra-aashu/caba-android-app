import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { useCall } from '../../context/CallContext';
import { useGroupCall } from '../../context/GroupCallContext';
import { useAuth } from '../../hooks/useAuth';
import { dpOptions } from '../../utils/dpOptions';
import { saveMessagesToDevice, loadMessagesFromDevice } from '../../utils/FileSystemManager';
import { frontendToDb, dbToFrontend } from '../../utils/dbFieldMapping';
import { db, addToSyncQueue } from '../../db/db';
import { validateEntity, Message } from '../../types/database';
import { Phone, Video, User, Bell, BellOff, Search, Image, Palette, Clock, Settings as SettingsIcon, Trash2, Ban, ArrowDown, ArrowLeft, ArrowRight, Copy, Edit, Reply, Gamepad2 } from 'lucide-react';
import { motion } from 'framer-motion';
import DropdownMenu from '../common/DropdownMenu';
import Modal from '../common/Modal';
import VirtualizedMessageList from './VirtualizedMessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import MediaViewer from '../media/MediaViewer';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeTyping } from '../../hooks/useRealtimeTyping';
import { useMessages } from '../../hooks/useMessages';
import { useQueryClient } from '@tanstack/react-query';
import { useData } from '../../contexts/DataContext';
import { messageReadsService } from '../../services/messageReadsService';
import { useTruthDareGame } from '../../hooks/useTruthDareGame';
import TruthDareModal from './TruthDareModal';
import GameRoom from './GameRoom';
import ForwardModal from './ForwardModal';
import GroupCallScreen from '../group/GroupCallScreen';
import GroupCallButton from '../group/GroupCallButton';
import GroupInfoDrawer from '../groups/GroupInfoDrawer';
import { formatLastSeen, isUserOnline } from '../../utils/timeUtils';
import NotificationSound from '../../utils/notificationSound';
import { realtimeManager } from '../../utils/realtimeManager';
import groupCallService from '../../services/groupCallService';
import toast from 'react-hot-toast';
import { debounce } from 'lodash';
import useUserStore from '../../store/userStore';
import { UserDetailsContext } from '../MainLayout';
import { useDialog } from '../../contexts/DialogContext';
import WallpaperPicker from './WallpaperPicker';
import useIsDesktop from '../../hooks/useIsDesktop';
import useChatStore, { selectMessages, selectSetMessages } from '../../store/useChatStore';
import '../../styles/chat.css';

import '../../styles/game-modal.css';

import './AttachmentMenu.css';

const Chat = () => {
  const { chatId, otherUserId } = useParams();
  // Define validChatId early so it can be used in useState and hooks
  const validChatId = chatId === 'new' ? null : chatId;
  const navigate = useNavigate();
  const location = useLocation();
  const { supabase } = useSupabase();
  const { chatTheme, chatThemes, selectTheme, setChatId, setScrollPercentage } = useChatTheme();
  const { user: currentUser, session, loading: authLoading, isAuthenticated } = useAuth();
  const { startCall } = useCall();
  const { initializeGroupCall, joinGroupCall, leaveGroupCall } = useGroupCall();
  const { showAlert } = useDialog();
  const isDesktop = useIsDesktop();
  const showUserDetails = React.useContext(UserDetailsContext);
  const queryClient = useQueryClient();
  const { chats: allChats } = useData();

  // State
  // ─── INSTANT DATA INITIALIZATION (Frame 1) ─────────────────────────────────
  // We initialize the local state directly from the React Query cache.
  // This ensures that 'Frame 1' of the component already has messages,
  // preventing the 'blank blink' before the first useEffect runs.
  const [messages, setMessages] = useState(() => {
    if (!validChatId) return [];
    const cached = queryClient.getQueryData(['messages', validChatId]);
    return Array.isArray(cached) ? cached : [];
  });
  const [messagesLoading, setMessagesLoading] = useState(!messages.length && validChatId);
  const [showGroupCallScreen, setShowGroupCallScreen] = useState(false);
  const [activeCallData, setActiveCallData] = useState(null);
  const [activeGroupCall, setActiveGroupCall] = useState(null);

  // isGroupChat: Route "chat/:chatId/group" has NO :otherUserId param, so otherUserId is undefined.
  // We must detect group by pathname. DM route gives otherUserId = UUID; group route gives path ending in /group.
  const isGroupChat = otherUserId === 'group' || location.pathname.endsWith('/group');

  // Initialise otherUser synchronously from router state (passed by GroupsPage on navigate).
  // This means the header renders the real group name on frame 1 — zero Loading flash.
  // For DMs or direct URL access, falls back to null and loads via initializeChat / useEffect.
  const [otherUser, setOtherUser] = useState(() => {
    const state = location.state;
    // 1. Try to use rich state passed from router
    if (isGroupChat && state?.groupName) {
      return {
        id: chatId,
        name: state.groupName,
        avatar: state.groupAvatar || null,
        is_group: true,
        isGroup: true,
        member_count: state.memberCount || 0,
      };
    }

    // 2. Try to use data from allChats cache (extremely fast, covers both DMs and Groups)
    if (allChats && allChats.length > 0) {
      const activeChat = allChats.find(c => c.id == chatId);
      if (activeChat) {
        // If it's a DM (has otherUserId), we MUST use otherUserId for the user fetch
        // and only use activeChat properties as metadata.
        const effectiveOtherUserId = isGroupChat ? chatId : otherUserId;

        return {
          ...activeChat,
          ...(activeChat.otherUser || {}),
          id: effectiveOtherUserId, // CRITICAL: Must be the user ID, not chat ID
          is_group: !!activeChat.isGroup,
          isGroup: !!activeChat.isGroup,
          member_count: activeChat.member_count || activeChat.otherUser?.member_count || 0,
        };
      }
    }

    // 3. Fallback: For group chats, return a valid placeholder IMMEDIATELY.
    // This ensures the header never renders "Loading..." or null state for groups,
    // even if we visited via direct URL.
    if (isGroupChat) {
      return {
        id: chatId,
        name: 'Group Chat',
        avatar: null,
        is_group: true,
        isGroup: true,
        member_count: 0,
      };
    }

    // 4. For DMs, start null (we need to fetch the user to know their name)
    return null;
  });

  // Initialize chat theme when chatId changes
  useEffect(() => {
    if (chatId) {
      setChatId(chatId);
    }
  }, [chatId, setChatId]);

  // Ensure group placeholder is set immediately when chatId changes for groups
  useEffect(() => {
    if (isGroupChat && chatId) {
      setOtherUser(prev => {
        // If we already have valid data for this group, keep it
        if (prev?.id === chatId && prev?.is_group && prev?.name) {
          return prev;
        }
        // Otherwise set placeholder to prevent "Loading..." state
        return {
          id: chatId,
          name: 'Group Chat',
          avatar: null,
          is_group: true,
          isGroup: true,
          member_count: 0
        };
      });
    }
  }, [chatId, isGroupChat]);


  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isTempChat, setIsTempChat] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [vanishPresets, setVanishPresets] = useState([]);
  const [selectedVanishDuration, setSelectedVanishDuration] = useState(86400);

  // 🔥 ZUSTAND STORE SYNC: Keep the Zustand store in sync with local state
  // This enables granular re-renders - only VirtualizedMessageList re-renders when messages change
  const setStoreMessages = useChatStore(selectSetMessages);
  
  useEffect(() => {
    if (messages.length > 0) {
      setStoreMessages(messages);
    }
  }, [messages, setStoreMessages]);

  // ─── REACT QUERY MESSAGE HOOK ──────────────────────────────────────────────
  const { data: queryMessages, isLoading: queryLoading } = useMessages(validChatId);

  // showLoading: show spinner only on initial load if no data
  const showLoading = queryLoading && messages.length === 0;

  // Sync query results with local messages state.
  useEffect(() => {
    if (queryMessages) {
      // Merge logic: authoritative query data + optimistic sends not yet in DB
      setMessages(prev => {
        const dbIds = new Set(queryMessages.map(m => m.id));
        const pendingOptimistic = prev.filter(m => m.tempId && !dbIds.has(m.id));

        // Sort merged list by time - handle both formats for safety during transition
        const merged = [...queryMessages, ...pendingOptimistic];
        merged.sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0));

        // Sync user store for all fetched users
        queryMessages.forEach(msg => {
          if (msg.sender) useUserStore.getState().setUser(msg.sender);
          if (msg.receiver) useUserStore.getState().setUser(msg.receiver);
        });

        // Background persistence sync
        if (validChatId) saveMessagesToDevice(validChatId, merged);

        return merged;
      });
      setMessagesLoading(false);
    }
  }, [queryMessages, validChatId]);

  // ─── MAIN MESSAGE FETCH EFFECT ───────────────────────────────────────────────
  // Runs every time the user opens a different chat (validChatId changes).
  //
  // Step 1 – INSTANT: If the cache already has messages for this chat, show them
  //          right away. The user sees content immediately with zero loading.
  //
  // Step 2 – BACKGROUND: Always fire a fresh DB fetch regardless of cache.
  //          When it resolves, merge any new messages (sent while away, or
  //          messages from the other user) into the cache and update the UI.
  //          The `cancelled` flag ensures a stale response from a previous chat
  //          can never overwrite the current chat's messages.
  // ─── KEEP CACHE IN SYNC ─────────────────────────────────────────────────────
  // Write realtime/optimistic changes (deletes, status updates, new messages) back
  // to the React Query cache so they persist when the user navigates back.
  // We guard with a chatId ref so that stale effect closures from a PREVIOUS chat
  // cannot overwrite the CURRENT chat's cache with the wrong messages.
  const activeChatIdRef = useRef(validChatId);
  useEffect(() => { activeChatIdRef.current = validChatId; }, [validChatId]);

  useEffect(() => {
    // Only write back if messages actually belong to the currently visible chat.
    if (validChatId && activeChatIdRef.current === validChatId && messages.length > 0) {
      queryClient.setQueryData(['messages', validChatId], messages);
    }
  }, [messages, validChatId, queryClient]);

  // When switching chats, pivot the state immediately.
  // We use this effect to handle clearing unread counts and 
  // ensuring the list is seeded if the query hook hasn't updated yet.
  useEffect(() => {
    if (chatId && chatId !== 'new') {
      setUnreadCount(0);
      setHasMoreMessages(true);

      const cached = queryClient.getQueryData(['messages', chatId]);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setMessages(cached);
        setMessagesLoading(false);
      } else {
        // Fallback: Check mobile filesystem for permanent backup
        loadMessagesFromDevice(chatId).then(localMessages => {
          if (localMessages && localMessages.length > 0) {
            setMessages(localMessages);
            queryClient.setQueryData(['messages', chatId], localMessages);
            setMessagesLoading(false);
          } else {
            setMessages([]);
            setMessagesLoading(true);
          }
        });
      }
    }
  }, [chatId, queryClient]);

  // Auto-scroll to bottom when chat switches or new messages arrive
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      setIsScrolledToBottom(true);
    }
  }, [chatId, messages.length]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [currentMediaInfo, setCurrentMediaInfo] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messagesToForward, setMessagesToForward] = useState([]);
  const [showGameRoom, setShowGameRoom] = useState(false);
  const [showGroupInfoDrawer, setShowGroupInfoDrawer] = useState(false);
  const [showVanishSettingsModal, setShowVanishSettingsModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showBlockConfirmModal, setShowBlockConfirmModal] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const {
    isOpen: isGameOpen,
    gameState,
    startGame,
    pickType,
    sendChallenge,
    completeTurn,
    closeGame
  } = useTruthDareGame(chatId, currentUser?.id);

  const handleNewMessage = useCallback((newMessage) => {
    const isOwnMessage = (newMessage.senderId || newMessage.sender_id) === currentUser?.id;

    setMessages(prev => {
      const exists = prev.some(msg => msg.id === newMessage.id);
      if (exists) return prev;

      // Own message from realtime: never add as new — only replace our temp, or skip (insert response will handle it)
      if (isOwnMessage) {
        const tempIndex = prev.findIndex(msg =>
          msg.tempId && msg.content === newMessage.content
        );
        if (tempIndex !== -1) {
          return prev.map((msg, i) => (i === tempIndex ? newMessage : msg));
        }
        return prev; // already have it from insert response or will get it; avoid duplicate
      }

      // From other user: replace temp if same content/time, else else add
      const isAlreadyPresent = prev.some(msg =>
        (msg.tempId && msg.content === newMessage.content && (msg.createdAt === newMessage.createdAt || msg.created_at === newMessage.created_at)) ||
        msg.id === newMessage.id
      );

      if (isAlreadyPresent) {
        return prev.map(msg =>
          (msg.tempId && msg.content === newMessage.content && (msg.createdAt === newMessage.createdAt || msg.created_at === newMessage.created_at))
            ? newMessage
            : msg
        );
      }

      return [...prev, newMessage];
    });

    // Play notification sound for incoming messages
    const senderId = newMessage.senderId || newMessage.sender_id;
    if (senderId !== currentUser?.id && !isMuted) {
      NotificationSound.playMessageNotification();
    }

    // Increment unread count if not scrolled to bottom
    if (!isScrolledToBottom) {
      setUnreadCount(prev => prev + 1);
    } else {
      markMessagesAsRead();
    }

    // Check if this is a game invite acceptance that should open the game room
    // When user accepts an invitation, they become the sender of the 'accepted' message
    if (newMessage.type === 'game_invite' && newMessage.status === 'accepted') {
      if (senderId === currentUser?.id) {
        startGame(otherUserId);
      }
    }
  }, [isScrolledToBottom, currentUser?.id, isMuted, startGame]);

  const handleDeleteMessage = useCallback((deletedId) => {
    // Mark as deleting first to trigger CSS animation
    setMessages((prev) => prev.map(m => m.id === deletedId ? { ...m, isDeleting: true } : m));

    // Remove from state after animation finishes
    setTimeout(() => {
      setMessages((prev) => prev.filter(m => m.id !== deletedId));
    }, 450);
  }, []);

  const handleStatusUpdate = useCallback((updatedMessage) => {
    setMessages(prev => prev.map(msg =>
      msg.id === updatedMessage.id ? updatedMessage : msg
    ));
  }, []);

  useRealtimeMessages(validChatId, {
    onNewMessage: handleNewMessage,
    onUpdateMessage: handleStatusUpdate,
    onDeleteMessage: handleDeleteMessage
  }, currentUser?.id);

  const { typingUsers, sendTyping } = useRealtimeTyping(validChatId, currentUser?.id);


  // Load group info for group chats - MUST BE DEFINED BEFORE initializeChat
  const loadGroupInfo = async (groupId) => {
    try {
      // Run all 3 queries in parallel but handle failures gracefully
      const results = await Promise.allSettled([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', groupId),
        supabase.from('group_members').select('user_id, role, users!inner(id, name, avatar)').eq('group_id', groupId).limit(5),
        supabase.from('group_members').select('role').eq('group_id', groupId).eq('user_id', currentUser?.id).single(),
      ]);

      const groupResult = results[0];
      const countResult = results[1];
      const membersResult = results[2];
      const roleResult = results[3];

      if (groupResult.status === 'rejected' || (groupResult.status === 'fulfilled' && groupResult.value.error)) {
        throw groupResult.reason || groupResult.value.error;
      }

      const group = groupResult.value.data;

      // Extract data safely from other results (they might have failed)
      const memberCount = (countResult.status === 'fulfilled' && !countResult.value.error)
        ? countResult.value.count
        : 0;

      const memberPreviews = (membersResult.status === 'fulfilled' && !membersResult.value.error && membersResult.value.data)
        ? membersResult.value.data.map(m => ({
          id: m.users?.id,
          name: m.users?.name || 'Unknown',
          avatar: m.users?.avatar,
          role: m.role
        }))
        : [];

      const myRole = (roleResult.status === 'fulfilled' && !roleResult.value.error && roleResult.value.data)
        ? roleResult.value.data.role
        : 'member';

      // Set full group info
      setOtherUser({
        ...group,
        name: group.name,
        avatar: group.avatar_url,
        is_group: true,
        isGroup: true,
        member_count: memberCount,
        member_previews: memberPreviews,
        my_role: myRole,
        description: group.description
      });

    } catch (error) {
      console.error('Error loading group info:', error);
      // Fallback — never show blank
      setOtherUser(prev => ({
        id: groupId,
        name: prev?.name || 'Group Chat',
        avatar: prev?.avatar || null,
        is_group: true,
        member_count: prev?.member_count || 0,
      }));
    }
  };

  const loadOtherUserInfo = async (userId) => {
    try {
      if (!userId) {
        console.warn('loadOtherUserInfo called with null userId');
        return;
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setOtherUser(user);
      useUserStore.getState().setUser(user);

      // Load contact name - only if we have currentUser
      if (currentUser?.id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('contact_name')
          .eq('user_id', currentUser.id)
          .eq('contact_user_id', userId)
          .maybeSingle();

        if (contact) {
          setOtherUser(prev => ({ ...prev, contact_name: contact.contact_name }));
        }
      }
    } catch (error) {
      console.error('Error loading user info:', error);
      // Set fallback user data to prevent crashes
      setOtherUser({
        id: userId,
        name: 'Unknown User',
        avatar: null
      });
    }
  };

  // Initialize chat function - MUST BE DEFINED BEFORE useEffect that calls it
  const initializeChat = async () => {
    if (!chatId) return;

    if (isGroupChat) {
      // 1. INSTANT INITIALIZATION: Try to get data from allChats first (same as DMs)
      if (allChats && allChats.length > 0) {
        const activeChat = allChats.find(c => c.id === chatId && c.isGroup);
        if (activeChat && activeChat.otherUser) {
          // Use group data from chat list - instant display!
          setOtherUser({
            ...activeChat.otherUser,
            is_group: true,
            isGroup: true,
            member_count: activeChat.otherUser.member_count || 0
          });
          // Still load full group info in background for member details, etc.
          loadGroupInfo(chatId);
          return; // Success! Instant UI population.
        }
      }

      // 2. FALLBACK: Set placeholder and load from database
      setOtherUser(prev => {
        // Keep existing data if we're already on this group (prevents flicker on re-render)
        if (prev?.id === chatId && prev?.is_group) return prev;
        return { id: chatId, name: 'Group Chat', avatar: null, is_group: true, member_count: 0 };
      });
      loadGroupInfo(chatId); // non-blocking, will overwrite placeholder when done
      return;
    }

    // For DM chats: reset stale state before loading ONLY if it's a different user
    // (Removing setOtherUser(null) to prevent header flicker)

    // 1. INSTANT INITIALIZATION: Try to get data from allChats first
    if (allChats && allChats.length > 0) {
      const activeChat = allChats.find(c => c.id == chatId);
      if (activeChat) {
        const effectiveOtherUserId = isGroupChat ? chatId : otherUserId;
        setOtherUser({
          ...activeChat,
          ...(activeChat.otherUser || {}),
          id: effectiveOtherUserId, // CRITICAL: Use correct ID
          is_group: !!activeChat.isGroup
        });
        return; // Success! Instant UI population.
      }
    }

    // 2. FALLBACK: Load from database
    if (otherUserId && otherUserId !== 'group') {
      await loadOtherUserInfo(otherUserId);
    }
  };

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
  }, [chatId, otherUserId, authLoading, isAuthenticated, currentUser, allChats]);

  // ─── INSTANT GROUP HEADER ─────────────────────────────────────────────────
  // Fires immediately on chatId change WITHOUT waiting for currentUser/auth.
  // Sets a placeholder synchronously then overwrites with real data from DB or allChats.
  useEffect(() => {
    if (!isGroupChat || !chatId) return;

    // 1. FIRST: Try to get group data from allChats (instant, no loading)
    if (allChats && allChats.length > 0) {
      const activeChat = allChats.find(c => c.id == chatId && c.isGroup);
      if (activeChat && (activeChat.name || activeChat.otherUser?.name)) {
        // We have group data from chat list - use it immediately!
        setOtherUser(prev => {
          // Only update if we don't already have real data for this group
          if (prev?.id == chatId && prev?.is_group && prev?.name && prev.name !== 'Group Chat') {
            return prev;
          }
          return {
            ...activeChat,
            ...(activeChat.otherUser || {}),
            id: chatId,
            is_group: true,
            isGroup: true,
            member_count: activeChat.member_count || activeChat.otherUser?.member_count || 0
          };
        });
        // If we got data from allChats, we're done - no need to fetch from DB here
        // (initializeChat will handle loading full details if needed)
        return;
      }
    }

    // 2. Ensure placeholder is set if we don't have data yet
    setOtherUser(prev => {
      // Keep existing data if it's valid for this group
      if (prev?.id === chatId && prev?.is_group && prev?.name) {
        return prev;
      }
      // Set placeholder
      return { id: chatId, name: 'Group Chat', avatar: null, is_group: true, isGroup: true, member_count: 0 };
    });

    // 3. If no supabase yet, wait for it
    if (!supabase) {
      return;
    }

    // 4. Load from database if we don't have data from allChats yet
    let cancelled = false;
    (async () => {
      try {
        const [groupResult, countResult] = await Promise.all([
          supabase.from('groups').select('id, name, avatar_url, description').eq('id', chatId).single(),
          supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', chatId),
        ]);
        if (cancelled) return;
        if (groupResult.error) throw groupResult.error;
        const group = groupResult.data;
        setOtherUser(prev => {
          // Don't overwrite if we already have real data
          if (prev?.id === chatId && prev?.is_group && prev?.name && prev.name !== 'Group Chat') {
            return prev;
          }
          return {
            ...(prev || {}),
            ...group,
            name: group.name,
            avatar: group.avatar_url,
            is_group: true,
            isGroup: true,
            member_count: countResult.count || 0,
          };
        });
      } catch (err) {
        if (!cancelled) console.warn('Group header fast-fetch failed:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [chatId, isGroupChat, supabase, allChats]);

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

    // Load temp chat state from DB
    const loadTempChatState = async () => {
      if (!chatId || !currentUser?.id) return;
      try {
        const { data } = await supabase
          .from('temporary_chat_settings')
          .select('is_enabled, vanish_duration')
          .eq('chat_id', chatId)
          .eq('user_id', currentUser.id)
          .maybeSingle();
        setIsTempChat(data?.is_enabled || false);
        if (data?.vanish_duration) setSelectedVanishDuration(data.vanish_duration);
      } catch (e) {
        const tempChats = JSON.parse(localStorage.getItem('tempChats') || '{}');
        setIsTempChat(!!tempChats[chatId]);
      }
    };

    const fetchVanishPresets = async () => {
      try {
        const { data, error } = await supabase
          .from('vanish_duration_presets')
          .select('*')
          .order('duration_seconds', { ascending: true });
        if (data) setVanishPresets(data);
      } catch (error) {
        console.error('Error fetching vanish presets:', error);
      }
    };

    loadTempChatState();
    fetchVanishPresets();
  }, [chatId, currentUser, supabase]);

  // Subscribe to real-time updates for other user's online status
  useEffect(() => {
    if (!otherUserId) return;

    const channelName = `user_status_${otherUserId}`;
    console.log(`🔌 Consolidating user status subscription for: ${otherUserId}`);

    realtimeManager.subscribe(
      channelName,
      {},
      {
        postgres_changes: [
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${otherUserId}`,
            handler: (payload) => {
              const updatedUser = payload.new;
              setOtherUser(prev => ({
                ...prev,
                is_online: Boolean(updatedUser.is_online),
                last_seen: updatedUser.last_seen
              }));
            }
          }
        ]
      }
    );

    return () => {
      console.log(`🔌 Cleaning up user status for: ${otherUserId}`);
      realtimeManager.unsubscribe(channelName);
    };
  }, [otherUserId]);

  // Handle detecting ongoing group calls
  useEffect(() => {
    if (!isGroupChat || !chatId || !supabase) {
      setActiveCallData(null);
      return;
    }

    const checkActiveCall = async () => {
      const activeCall = await groupCallService.getActiveGroupCall(chatId);
      // Only show banner if user is NOT in the call already
      if (activeCall) {
        const isUserInCall = activeCall.group_call_participants?.some(p => p.user_id === currentUser?.id && !p.left_at);
        if (!isUserInCall) {
          setActiveCallData(activeCall);
        } else {
          setActiveCallData(null);
        }
      } else {
        setActiveCallData(null);
      }
    };

    checkActiveCall();

    // Subscribe to call changes for this group
    const channelName = `group_calls_${chatId}`;
    realtimeManager.subscribe(
      channelName,
      {},
      {
        postgres_changes: [
          {
            event: '*',
            schema: 'public',
            table: 'calls',
            filter: `group_id=eq.${chatId}`,
            handler: () => checkActiveCall()
          },
          {
            event: '*',
            schema: 'public',
            table: 'group_call_participants',
            handler: (payload) => {
              // Only trigger if it's related to a call in this group
              // (Simplest is to re-check when any participant changes if we don't have call_id filter easily here)
              checkActiveCall();
            }
          }
        ]
      }
    );

    return () => {
      realtimeManager.unsubscribe(channelName);
    };
  }, [chatId, isGroupChat, supabase, currentUser?.id]);


  const loadMessages = async (isLoadMore = false) => {
    if (!chatId || chatId === 'new') return;

    if (isLoadMore) {
      setLoadingMore(true);
    }

    try {
      // OPTIMIZED QUERY: Use joins to fetch user data in single query
      let query = supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id (
            id,
            name,
            avatar,
            is_online,
            last_seen
          ),
          receiver:receiver_id (
            id,
            name,
            avatar,
            is_online,
            last_seen
          )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false }); // Load latest first for pagination

      if (isLoadMore && messages.length > 0) {
        const oldestMessage = messages[0]; // messages is in ascending order
        const oldestTime = oldestMessage.createdAt || oldestMessage.created_at;
        if (oldestTime) {
          query = query.lt('created_at', oldestTime);
        }
      }

      query = query.limit(50); // Load 50 messages at a time

      const { data, error } = await query;

      if (error) throw error;

      const newMessages = data || [];

      if (isLoadMore) {
        const combined = [...data.map(m => dbToFrontend(m)).reverse(), ...messages];
        setMessages(combined);
        await saveMessagesToDevice(chatId, combined);
        setHasMoreMessages(data.length === 50);
      } else {
        const reversed = data.map(m => dbToFrontend(m)).reverse();
        setMessages(reversed);
        await saveMessagesToDevice(chatId, reversed);
        setHasMoreMessages(data.length === 50);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreMessages = () => {
    if (chatId && hasMoreMessages && !loadingMore) {
      loadMessages(true);
    }
  };

  const cleanup = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleBlockUser = async () => {
    setShowBlockConfirmModal(true);
  };

  const confirmBlockUser = async () => {
    setShowBlockConfirmModal(false);
    if (!otherUser || !currentUser) return;

    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert([
          {
            blocker_id: currentUser.id,
            blocked_id: otherUser.id
          }]);

      if (error) throw error;
      toast.success(`${otherUser.name} blocked`);
      navigate('/');
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    }
  };


  const sendMessage = async (content) => {
    if (!content.trim() || !currentUser) return;

    // 1. Optimistic Update - Show message immediately
    const tempId = Date.now();
    const vanishAt = isTempChat ? new Date(Date.now() + selectedVanishDuration * 1000).toISOString() : null;

    const dbMessageData = frontendToDb({
      chatId: validChatId,
      senderId: currentUser.id,
      receiverId: isGroupChat ? null : otherUserId,
      content: content.trim(),
      mediaPath: null,
      mediaType: null,
      isGroupMessage: Boolean(isGroupChat),
      replyTo: replyingTo ? replyingTo.id : null,
      messageType: 'text',
      createdAt: new Date().toISOString(),
      vanishAt: vanishAt,
      status: navigator.onLine ? 'sending' : 'pending',
      tempId: tempId
    });

    // Optimistic message for UI
    const optimisticMsg = {
      ...dbToFrontend(dbMessageData),
      sender: currentUser,
      tempId: tempId
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setReplyingTo(null);

    try {
      // 2. Persistent Save to local Dexie (for offline resilience)
      const { tempId: _, ...localSaveData } = dbMessageData;
      await db.messages.add({
        ...localSaveData,
        id: `temp_${tempId}`, // local-only temp ID
        tempId: tempId
      });

      // 3. Conditional Sending
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('messages')
          .insert(localSaveData)
          .select()
          .single();

        if (error) throw error;

        // Replace temporary message in state and Dexie
        const frontendData = dbToFrontend(data);
        setMessages(prev => prev.map(msg =>
          msg.tempId === tempId ? { ...frontendData, status: 'sent', sender: currentUser } : msg
        ));

        // Update Dexie with real record and remove temp one
        await db.transaction('rw', db.messages, async () => {
          await db.messages.delete(`temp_${tempId}`);
          await db.messages.add(data);
        });

      } else {
        // 4. Offline: Add to sync queue with precision tempId
        await addToSyncQueue('send_message', { ...localSaveData, tempId });
        toast.success('Message queued for sync (offline)');
      }

      NotificationSound.playMessageNotification();

    } catch (error) {
      console.error('Error sending message:', error);
      // We don't rollback if it's already in Dexie/SyncQueue, but we show error if it failed online attempt
      if (navigator.onLine) {
        toast.error('Failed to send message online.');
      }
    }
  };


  const handleSendMedia = async (mediaPath, mediaType) => {
    if (!mediaPath || !currentUser) return;

    const tempId = Date.now();
    const vanishAt = isTempChat ? new Date(Date.now() + selectedVanishDuration * 1000).toISOString() : null;
    const content = mediaType === 'image' ? '📷 Photo'
      : mediaType === 'video' ? '🎥 Video'
        : '🎤 Voice Message';

    const dbMessageData = {
      chat_id: validChatId,
      sender_id: currentUser.id,
      receiver_id: isGroupChat ? null : otherUserId,
      content: content,
      media_path: mediaPath,
      media_type: mediaType,
      message_type: mediaType === 'voice' ? 'audio' : mediaType,
      reply_to: replyingTo?.id || null,
      is_group_message: Boolean(isGroupChat),
      vanish_at: vanishAt,
      status: navigator.onLine ? 'sending' : 'pending',
      created_at: new Date().toISOString(),
    };

    // Optimistic UI update
    const optimisticMsg = {
      ...dbToFrontend(dbMessageData),
      sender: currentUser,
      tempId: tempId
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setReplyingTo(null);

    try {
      // 1. Persistent Save to local Dexie
      await db.messages.add({
        ...dbMessageData,
        id: `temp_media_${tempId}`,
        tempId: tempId
      });

      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('messages')
          .insert(dbMessageData)
          .select()
          .single();

        if (error) throw error;

        const frontendMsg = dbToFrontend(data);
        setMessages(prev => prev.map(msg =>
          msg.tempId === tempId ? { ...frontendMsg, sender: currentUser } : msg
        ));

        // Update Dexie
        await db.transaction('rw', db.messages, async () => {
          await db.messages.delete(`temp_media_${tempId}`);
          await db.messages.add(data);
        });

      } else {
        // 2. Offline: Add to sync queue with precision tempId
        await addToSyncQueue('send_message', { ...dbMessageData, tempId });
        toast.success('Media queued for sync (offline)');
      }

      NotificationSound.playMessageNotification();

    } catch (error) {
      console.error('Error sending media message:', error);
      if (navigator.onLine) {
        toast.error('Failed to send media online.');
      }
    }
  };



  const handleTyping = () => {
    sendTyping();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTyping();
    }, 3000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledToBottom(true);
  };

  const markMessagesAsRead = useCallback(async () => {
    try {
      if (!currentUser || !chatId || chatId === 'new') return;

      // Use messageReadsService for consistent read receipt tracking
      await messageReadsService.markAllAsRead(chatId, currentUser.id);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUser, chatId]);

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
    const ids = Array.from(selectedMessages);
    const prevMessages = messages;
    setMessages(prev => prev.filter(m => !selectedMessages.has(m.id)));
    exitSelectionMode();

    try {
      const { error } = await supabase.from('messages').delete().in('id', ids);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting messages:', error);
      toast.error('Failed to delete messages');
      setMessages(prevMessages);
      queryClient.setQueryData(['messages', validChatId], prevMessages);
    }
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
    // Only allow edit if single message and it's user's message
    if (selectedMessages.size !== 1) return;

    const messageId = Array.from(selectedMessages)[0];
    const message = messages.find(msg => msg.id === messageId);

    if (message && (message.senderId || message.sender_id) === currentUser.id) {
      // Trigger edit mode for that message
      setReplyingTo(null); // Clear reply if any
      exitSelectionMode();

      // Find the MessageItem component and trigger edit mode
      const messageElement = document.getElementById(`message-${messageId}`);
      if (messageElement) {
        // Find the edit button and click it, or trigger edit directly
        const editBtn = messageElement.querySelector('.menu-item[onclick*="onEdit"]');
        if (editBtn) {
          editBtn.click();
        } else {
          // Fallback: trigger edit mode directly by finding the MessageItem
          const messageItem = messageElement.closest('.message-item');
          if (messageItem) {
            // Dispatch a custom event to trigger edit mode
            const editEvent = new CustomEvent('triggerEdit', { detail: { messageId } });
            messageItem.dispatchEvent(editEvent);
          }
        }
      }
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
      toast.error('Failed to toggle vanish mode');
    }
  };

  const handleTempChatSettings = () => {
    setShowVanishSettingsModal(true);
  };

  const handleClearChat = async () => {
    setShowClearConfirmModal(true);
  };

  const confirmClearChat = async () => {
    setShowClearConfirmModal(false);

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
      showAlert('Failed to clear chat. Please try again.');
    }
  };

  // State for group call modal
  const [showGroupCallModal, setShowGroupCallModal] = useState(false);
  const [selectedCallType, setSelectedCallType] = useState('voice');

  const handleVoiceCall = async () => {
    if (isGroupChat) {
      await handleStartGroupCall('voice');
      return;
    }

    try {
      const { callId } = await startCall(otherUser.id, 'voice');
      navigate(`/call/${callId}`);
    } catch (error) {
      console.error('Failed to start voice call:', error);
      showAlert('Failed to start call: ' + error.message);
    }
  };

  const handleVideoCall = async () => {
    if (isGroupChat) {
      await handleStartGroupCall('video');
      return;
    }

    try {
      const { callId } = await startCall(otherUser.id, 'video');
      navigate(`/call/${callId}`);
    } catch (error) {
      console.error('Failed to start video call:', error);
      showAlert('Failed to start call: ' + error.message);
    }
  };

  const handleStartGroupCall = async (callType) => {
    try {
      setShowGroupCallScreen(true);
      await initializeGroupCall(chatId, callType);
    } catch (error) {
      console.error('Failed to start group call:', error);
      toast.error('Failed to start group call');
      setShowGroupCallScreen(false);
    }
  };

  const handleEndGroupCall = () => {
    leaveGroupCall();
    setShowGroupCallScreen(false);
    setActiveGroupCall(null);
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
      mime_type: message.mediaType || message.media_type || 'image/jpeg',
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
      showAlert('Failed to download media');
    }
  };

  // Animation variants for framer motion
  const pageVariants = {
    initial: {
      opacity: 0,
      x: 20,
    },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
      },
    },
  };

  // Memoize the header and other static parts if needed, but defining a component inside a component is a bug

  return (
    <motion.div 
      className={`chat-screen ${showGroupInfoDrawer ? 'drawer-open' : ''}`}
      // FIX: Added 'layout' prop to fix the Framer Motion transition bug
      // This tells Framer Motion to properly handle layout changes during transitions
      layout
      initial="initial"
      animate="animate"
      variants={pageVariants}
      // 👇 यह लाइन एनिमेशन के टाइम गैप बनने से रोकेगी 👇
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100dvh' }}
    >
      <div className="chat-main-area">
        {/* Chat Header - always render, even if otherUser is loading */}
        <header className="chat-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
          </button>

          <div className="chat-user-info" onClick={() => isGroupChat ? (isDesktop ? setShowGroupInfoDrawer(true) : navigate(`/chat/${chatId}/group/info`)) : handleViewContact()} style={{ cursor: otherUser ? 'pointer' : 'default' }}>
            <div className="user-avatar">
              {otherUser?.avatar ? (
                parseInt(otherUser.avatar) ? (
                  <img src={dpOptions.find(dp => dp.id === parseInt(otherUser.avatar))?.path || otherUser.avatar} alt={otherUser.name} />
                ) : (
                  <img src={otherUser.avatar} alt={otherUser.name} />
                )
              ) : (
                <div className="user-avatar-loading"></div>
              )}
            </div>
            <div className="user-details">
              <h3 className="user-name">
                {isGroupChat
                  ? (otherUser?.name || 'Group Chat')
                  : (otherUser ? (otherUser.contact_name || otherUser.name) : 'Loading...')
                }
              </h3>
              <p className="user-status">
                {isGroupChat ? (
                  // Group-specific status: show member count
                  otherUser?.member_count ? `${otherUser.member_count} members` : ''
                ) : (
                  // Regular user status
                  otherUser ? (
                    Object.keys(typingUsers).length > 0 ? 'typing...' : isUserOnline(Boolean(otherUser.is_online), otherUser.last_seen) ? 'Online' : `Last seen ${formatLastSeen(otherUser.last_seen)}`
                  ) : 'Loading...'
                )}
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
                // Show "View Group Info" for groups, "View Contact" for regular users
                ...(isGroupChat ? [
                  {
                    icon: <User size={16} />,
                    label: 'View Group Info',
                    onClick: () => isDesktop ? setShowGroupInfoDrawer(true) : navigate(`/chat/${chatId}/group/info`)
                  }
                ] : [
                  {
                    icon: <User size={16} />,
                    label: 'View Contact',
                    onClick: handleViewContact
                  }
                ]),
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
                // Show Search only for non-group chats (groups can have their own search)
                ...(!isGroupChat ? [{
                  icon: <Search size={16} />,
                  label: 'Search Messages',
                  onClick: handleSearchMessages
                }] : []),
                {
                  icon: <Palette size={16} />,
                  label: 'Themes',
                  onClick: handleChangeTheme
                },
                {
                  icon: <Image size={16} />,
                  label: 'Chat Wallpaper',
                  onClick: () => setShowWallpaperPicker(true)
                },
                {
                  icon: <Gamepad2 size={16} />,
                  label: 'Game Room',
                  onClick: () => setShowGameRoom(true)
                },
                { divider: true },
                // Show "Clear Chat" only for non-group chats
                ...(!isGroupChat ? [
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
                  }
                ] : []),
                // Show "Leave Group" option for group chats (opens drawer with leave option)
                ...(isGroupChat ? [
                  { divider: true },
                  {
                    icon: <Ban size={16} />,
                    label: 'Leave Group',
                    onClick: () => isDesktop ? setShowGroupInfoDrawer(true) : navigate(`/chat/${chatId}/group/info`),
                    danger: true
                  }
                ] : [
                  { divider: true },
                  {
                    icon: <Ban size={16} />,
                    label: 'Block User',
                    onClick: handleBlockUser,
                    danger: true
                  }
                ])
              ]}
            />
          </div>
        </header>

        {/* Ongoing Call Banner */}
        {activeCallData && (
          <div className="active-call-banner">
            <div className="banner-content">
              <div className="call-icon">
                {activeCallData.call_type === 'video' ? <Video size={18} /> : <Phone size={18} />}
              </div>
              <div className="call-details">
                <span className="banner-title">Ongoing Group Call</span>
                <span className="banner-subtitle">
                  {activeCallData.group_call_participants?.length || 0} participants calling...
                </span>
              </div>
            </div>
            <button
              className="banner-join-btn"
              onClick={() => {
                joinGroupCall(activeCallData.id);
                setShowGroupCallScreen(true);
              }}
            >
              Join
            </button>
          </div>
        )}

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
                    const isMine = (message.senderId || message.sender_id) === currentUser.id;
                    return message && isMine;
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
          style={{ transform: 'translateZ(0)' }}
        >
          {/* Load More Indicator */}
          {loadingMore && (
            <div className="load-more-indicator">
              <div className="loading-spinner"></div>
              <p>Loading more messages...</p>
            </div>
          )}

          <VirtualizedMessageList
            messages={messages}
            currentUser={currentUser}
            selectedMessages={selectedMessages}
            isSelectionMode={isSelectionMode}
            onMessageSelect={handleMessageSelect}
            onReply={handleReply}
            onForward={handleForwardMessage}
            onDelete={(messageId) => {
              setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isDeleting: true } : m));
              setTimeout(() => {
                setMessages(prev => prev.filter(m => m.id !== messageId));
              }, 450);
            }}
            onEdit={handleMessageEdit}
            onMediaView={handleMediaView}
            onMediaDownload={handleMediaDownload}
            isLoading={showLoading}
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
            followOutput="auto"
            typingUsers={typingUsers}
            initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
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
                  </div>
                  <span style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: chatTheme === key ? '600' : '500', color: chatTheme === key ? '#25d366' : 'var(--text-primary)' }}>
                    {theme.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Modal>

        {/* Media Viewer Modal */}
        <Modal
          isOpen={mediaViewerOpen}
          onClose={() => {
            setMediaViewerOpen(false);
            setCurrentMediaInfo(null);
          }}
          title="Media Viewer"
          size="fullscreen"
        >
          <div className="media-viewer-content">
            {currentMediaInfo?.fileInfo?.file_type === 'image' ? (
              <img src={currentMediaInfo.fileInfo.storage_url} alt="Full screen media" className="full-media" />
            ) : currentMediaInfo?.fileInfo?.file_type === 'video' ? (
              <video src={currentMediaInfo.fileInfo.storage_url} controls autoPlay className="full-media" />
            ) : (
              <div className="unsupported-media">Unsupported media type</div>
            )}
          </div>
        </Modal>

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

        {/* Truth or Dare Game Modal */}
        <TruthDareModal
          isOpen={isGameOpen}
          gameState={gameState}
          userId={currentUser?.id}
          partnerId={otherUser?.id}
          onPick={pickType}
          onSend={sendChallenge}
          onComplete={completeTurn}
          onClose={closeGame}
          onStart={startGame}
          chatId={chatId}
        />

        {/* Game Room Modal */}
        <Modal
          isOpen={showGameRoom}
          onClose={() => setShowGameRoom(false)}
          title="Game Room"
          size="large"
        >
          <GameRoom
            chatId={chatId}
            currentUser={currentUser}
            onClose={() => setShowGameRoom(false)}
          />
        </Modal>

        {/* Call Selection Modal */}
        {/* This modal is not present in the original code, but was in the instruction.
            Assuming it's a new addition or a re-interpretation of existing call logic.
            I will add it as per the instruction's provided JSX.
            However, the instruction's provided JSX for this modal is incomplete (missing startCall function).
            I will use the original handleVoiceCall/handleVideoCall logic for now,
            or if the instruction implies a new `startCall` function, I'll need more context.
            Given the instruction's `startCall('voice')` and `startCall('video')`,
            I'll assume a new `startCall` function is intended to be defined elsewhere
            that takes the call type. For now, I'll include the modal as provided.
        */}
        {/* The instruction's provided JSX for this modal is also missing from the original code.
            I will omit it as it seems to be an artifact of a different change,
            and the current instruction is about wrapping existing content.
            The existing `handleVoiceCall` and `handleVideoCall` already handle call initiation.
        */}

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
                onClick={handleStartGroupCall}
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
              <button className="btn-danger" onClick={confirmClearChat}>Clear</button>
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
              <button className="btn-danger" onClick={confirmBlockUser}>Block</button>
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
              <button className="btn-danger" onClick={confirmSelectionDelete}>Delete</button>
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
              loadGroupInfo(chatId);
            }
          }}
          group={otherUser}
          onCallStart={(type) => {
            setSelectedCallType(type);
            setShowGroupCallModal(true);
          }}
        />
      )}
    </motion.div>
  );
};

export default Chat;
