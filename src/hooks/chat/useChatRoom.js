/**
 * useChatRoom.js
 *
 * Encapsulates all state, data-fetching, and lifecycle side-effects for a single
 * chat room (both DM and group). Extracted from the monolithic Chat.jsx to
 * separate concerns and make the presenter component lean.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import { useCall } from '../../contexts/CallContext';
import { useGroupCall } from '../../contexts/GroupCallContext';
import { useDialog } from '../../contexts/DialogContext';
import { useData } from '../../contexts/DataContext';
import { useInfiniteMessages } from '../../hooks/useMessages';
import { useGroupDetails } from '../../hooks/useGroupDetails';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeTyping } from '../../hooks/useRealtimeTyping';
import { Capacitor } from '@capacitor/core';
import realtimeManager from '../../utils/realtimeManager';
import groupCallService from '../../services/groupCallService';
import useChatStore, { selectRoomMessages, selectRoomScrollPosition } from '../../store/useChatStore';
import useUserStore from '../../store/userStore';
import { saveMessagesToDevice, loadMessagesFromDevice } from '../../utils/FileSystemManager';
import toast from 'react-hot-toast';
import hapticsManager from '../../utils/hapticsManager';
import { db, addToSyncQueue } from '../../db/db';
import { frontendToDb, dbToFrontend } from '../../utils/dbFieldMapping';
import { getPublicMediaUrl } from '../../services/mediaService';

/**
 * useChatRoom
 *
 * Returns all state and handlers needed by Chat.jsx and its sub-components.
 * This hook absorbs ~1,400 lines of logic from Chat.jsx.
 */
const useChatRoom = (options = {}) => {
    const { onNewMessage } = options;
    const { chatId, otherUserId } = useParams();
    const validChatId = chatId === 'new' ? null : chatId;
    const navigate = useNavigate();
    const location = useLocation();
    const { supabase } = useSupabase();
    const { user: currentUser, session, loading: authLoading, isAuthenticated } = useAuth();
    const { startCall } = useCall();
    const { initializeGroupCall, joinGroupCall, leaveGroupCall } = useGroupCall();
    const { showAlert } = useDialog();
    const queryClient = useQueryClient();
    const { chats: allChats } = useData();

    // ─── PAGINATION ───────────────────────────────────────────────────────────
    const {
        data: infiniteData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isMessagesLoading,
    } = useInfiniteMessages(validChatId);

    // ─── GROUP DATA ───────────────────────────────────────────────────────────
    const isGroupChat = otherUserId === 'group' || location.pathname.endsWith('/group');
    const { data: groupDetails } = useGroupDetails(isGroupChat ? validChatId : null);

    // ─── ZUSTAND STORE ────────────────────────────────────────────────────────
    const setStoreMessages = useChatStore(state => state.setMessages);
    const addStoreMessage = useChatStore(state => state.addMessage);
    const updateStoreMessage = useChatStore(state => state.updateMessage);
    const removeStoreMessage = useChatStore(state => state.removeMessage);
    const replaceTempMessage = useChatStore(state => state.replaceTempMessage);
    const saveScrollPosition = useChatStore(state => state.saveScrollPosition);
    const messages = useChatStore(useCallback(selectRoomMessages(validChatId), [validChatId]));
    const initialScrollPosition = useChatStore(selectRoomScrollPosition(validChatId));

    // ─── STATE ────────────────────────────────────────────────────────────────
    const [isInitializing, setIsInitializing] = useState(false);
    const [activeCallData, setActiveCallData] = useState(null);
    const [activeGroupCall, setActiveGroupCall] = useState(null);
    const [showGroupCallScreen, setShowGroupCallScreen] = useState(false);

    // otherUser: initialized synchronously from router state or cache for zero-flash load
    const [otherUser, setOtherUser] = useState(() => {
        const state = location.state;
        if (isGroupChat && state?.groupName) {
            return { id: chatId, name: state.groupName, avatar: state.groupAvatar || null, is_group: true, isGroup: true, member_count: state.memberCount || 0 };
        }
        if (allChats?.length > 0) {
            const activeChat = allChats.find(c => c.id == chatId);
            if (activeChat) {
                const effectiveId = isGroupChat ? chatId : otherUserId;
                return { ...activeChat, ...(activeChat.otherUser || {}), id: effectiveId, is_group: !!activeChat.isGroup, isGroup: !!activeChat.isGroup, member_count: activeChat.member_count || activeChat.otherUser?.member_count || 0 };
            }
        }
        if (isGroupChat) return { id: chatId, name: 'Group Chat', avatar: null, is_group: true, isGroup: true, member_count: 0 };
        return null;
    });

    const [isMuted, setIsMuted] = useState(false);
    const [isTempChat, setIsTempChat] = useState(false);
    const [vanishPresets, setVanishPresets] = useState([]);
    const [selectedVanishDuration, setSelectedVanishDuration] = useState(86400);
    const [replyingTo, setReplyingTo] = useState(null);

    // ─── REALTIME MESSAGING ───────────────────────────────────────────────────
    const handleNewMessage = useCallback((message) => {
        // 1. Sync React Query cache (critical for background fetch stability)
        queryClient.setQueryData(['messages', validChatId], (oldData) => {
            if (!oldData?.pages) return oldData;
            const newPages = [...oldData.pages];
            const firstPage = newPages[0];
            if (firstPage.data.some(m => m.id === message.id)) return oldData;
            newPages[0] = { ...firstPage, data: [message, ...firstPage.data] };
            return { ...oldData, pages: newPages };
        });

        // 2. Update Zustand store
        addStoreMessage(validChatId, message);

        // 3. User callback (for unread counts, etc)
        if (onNewMessage) onNewMessage(message);
    }, [validChatId, addStoreMessage, queryClient, onNewMessage]);

    const handleDeleteMessage = useCallback((deletedId) => {
        updateStoreMessage(validChatId, deletedId, { isDeleting: true });
        setTimeout(() => removeStoreMessage(validChatId, deletedId), 450);
    }, [validChatId, updateStoreMessage, removeStoreMessage]);

    const handleStatusUpdate = useCallback((updatedMessage) => {
        updateStoreMessage(validChatId, updatedMessage.id, updatedMessage);
    }, [validChatId, updateStoreMessage]);

    useRealtimeMessages(validChatId, {
        onNewMessage: handleNewMessage,
        onUpdateMessage: handleStatusUpdate,
        onDeleteMessage: handleDeleteMessage
    }, currentUser?.id);

    const { typingUsers, sendTyping } = useRealtimeTyping(validChatId, currentUser?.id);

    // ─── EFFECTS ──────────────────────────────────────────────────────────────

    // Sync group details into otherUser state
    useEffect(() => {
        if (groupDetails) {
            const memberCount = groupDetails.group_members?.length || 0;
            const memberPreviews = groupDetails.group_members?.slice(0, 5).map(m => ({ id: m.users?.id, name: m.users?.name || 'Unknown', avatar: m.users?.avatar, role: m.role })) || [];
            const myRole = groupDetails.group_members?.find(m => m.user_id === currentUser?.id)?.role || 'member';
            setOtherUser(prev => ({ ...(prev || {}), ...groupDetails, id: groupDetails.id, name: groupDetails.name, avatar: groupDetails.avatar_url, is_group: true, isGroup: true, member_count: memberCount, member_previews: memberPreviews, my_role: myRole, description: groupDetails.description }));
        }
    }, [groupDetails, currentUser?.id]);

    // Sync infinite query data to Zustand store
    useEffect(() => {
        if (infiniteData?.pages && validChatId) {
            const allMsgs = infiniteData.pages.flatMap(page => page.data).reverse();
            setStoreMessages(validChatId, allMsgs);
            if (allMsgs.length > 0) saveMessagesToDevice(validChatId, allMsgs);
        }
    }, [infiniteData, setStoreMessages, validChatId]);

    // Load from device cache on chat switch
    useEffect(() => {
        if (validChatId) {
            loadMessagesFromDevice(validChatId).then(localMessages => {
                if (localMessages?.length > 0) {
                    const currentRoomMsgs = useChatStore.getState().roomMessages[validChatId];
                    if (!currentRoomMsgs || currentRoomMsgs.length === 0) setStoreMessages(validChatId, localMessages);
                }
            });
        }
    }, [validChatId, setStoreMessages]);

    // Load mute and temp chat preferences
    useEffect(() => {
        const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
        setIsMuted(!!mutedChats[chatId]);
        const loadTempChatState = async () => {
            if (!chatId || !currentUser?.id) return;
            try {
                const { data } = await supabase.from('temporary_chat_settings').select('is_enabled, vanish_duration').eq('chat_id', chatId).eq('user_id', currentUser.id).maybeSingle();
                setIsTempChat(data?.is_enabled || false);
                if (data?.vanish_duration) setSelectedVanishDuration(data.vanish_duration);
            } catch {
                const tempChats = JSON.parse(localStorage.getItem('tempChats') || '{}');
                setIsTempChat(!!tempChats[chatId]);
            }
        };
        loadTempChatState();
    }, [chatId, currentUser, supabase]);

    // Fetch vanish duration presets
    useEffect(() => {
        const fetchVanishPresets = async () => {
            try {
                const { data } = await supabase
                    .from('vanish_duration_presets')
                    .select('*')
                    .order('duration_seconds', { ascending: true });
                if (data) setVanishPresets(data);
            } catch (error) {
                console.error('Error fetching vanish presets:', error);
            }
        };
        fetchVanishPresets();
    }, [supabase]);

    // Presence listener for DM online status
    useEffect(() => {
        if (isGroupChat || !otherUserId) return;
        const channelName = 'online-presence';
        const handleSync = () => {
            const channel = realtimeManager.subscriptions.get(channelName)?.values().next().value;
            if (!channel) return;
            const state = channel.presenceState();
            let isOnline = false;
            let lastSeen = null;
            Object.values(state).forEach(presences => presences.forEach(p => {
                if (p.user_id === otherUserId) { isOnline = true; lastSeen = p.online_at; }
            }));
            setOtherUser(prev => {
                if (!prev || (prev.is_online === isOnline && prev.last_seen === lastSeen)) return prev;
                return { ...prev, is_online: isOnline, last_seen: lastSeen || prev.last_seen };
            });
        };
        realtimeManager.subscribe(channelName, {}, { presence: { event: 'sync', callback: handleSync } });
    }, [otherUserId, isGroupChat]);

    // Detect ongoing group calls
    useEffect(() => {
        if (!isGroupChat || !chatId || !supabase) { setActiveCallData(null); return; }
        const checkActiveCall = async () => {
            const activeCall = await groupCallService.getActiveGroupCall(chatId);
            if (activeCall) {
                const isUserInCall = activeCall.group_call_participants?.some(p => p.user_id === currentUser?.id && !p.left_at);
                setActiveCallData(!isUserInCall ? activeCall : null);
            } else {
                setActiveCallData(null);
            }
        };
        checkActiveCall();
    }, [isGroupChat, chatId, supabase, currentUser?.id]);

    // Auth guard
    useEffect(() => {
        if (!authLoading && !isAuthenticated) navigate('/login');
        if (!authLoading && isAuthenticated && currentUser && !isGroupChat && otherUserId && otherUserId !== 'group') {
            if (isInitializing) return;
            setIsInitializing(true);
            useUserStore.getState().fetchUserIfNeeded(otherUserId).then(user => {
                if (user) {
                    setOtherUser(user);
                    const chat = allChats?.find(c => c.metadata?.otherUserId === otherUserId);
                    if (chat?.name) setOtherUser(prev => ({ ...prev, name: chat.name, contact_name: chat.name }));
                }
            }).catch(() => setOtherUser({ id: otherUserId, name: 'Unknown User', avatar: null }))
                .finally(() => setIsInitializing(false));
        }
    }, [chatId, otherUserId, authLoading, isAuthenticated, currentUser]);

    // ─── CALL HANDLERS ────────────────────────────────────────────────────────
    const handleVoiceCall = async () => {
        if (isGroupChat) { await handleStartGroupCall('voice'); return; }
        try {
            const { callId } = await startCall(otherUser.id, 'voice');
            navigate(`/call/${callId}`);
        } catch (error) { showAlert('Failed to start call: ' + error.message); }
    };

    const handleVideoCall = async () => {
        if (isGroupChat) { await handleStartGroupCall('video'); return; }
        try {
            const { callId } = await startCall(otherUser.id, 'video');
            navigate(`/call/${callId}`);
        } catch (error) { showAlert('Failed to start call: ' + error.message); }
    };

    const handleStartGroupCall = async (callType) => {
        try {
            setShowGroupCallScreen(true);
            await initializeGroupCall(chatId, callType);
        } catch (error) {
            hapticsManager.error();
            toast.error('Failed to start group call');
            setShowGroupCallScreen(false);
        }
    };

    const handleEndGroupCall = () => {
        leaveGroupCall();
        setShowGroupCallScreen(false);
        setActiveGroupCall(null);
    };

    // ─── MESSAGING HANDLERS ──────────────────────────────────────────────────
    const sendMessage = async (content) => {
        if (!content.trim() || !currentUser) return;

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

        const optimisticMsg = {
            ...dbToFrontend(dbMessageData),
            sender: currentUser,
            tempId: tempId
        };

        addStoreMessage(validChatId, optimisticMsg);
        setReplyingTo(null);

        try {
            hapticsManager.impact();
            const { tempId: _, ...localSaveData } = dbMessageData;
            await db.messages.add({
                ...localSaveData,
                id: `temp_${tempId}`,
                tempId: tempId
            });

            if (navigator.onLine) {
                const { data, error } = await supabase
                    .from('messages')
                    .insert(localSaveData)
                    .select()
                    .single();

                if (error) throw error;

                const frontendData = dbToFrontend(data);
                replaceTempMessage(validChatId, tempId, { ...frontendData, status: 'sent', sender: currentUser });

                await db.transaction('rw', db.messages, async () => {
                    await db.messages.delete(`temp_${tempId}`);
                    await db.messages.add(data);
                });
            } else {
                await addToSyncQueue('send_message', { ...localSaveData, tempId });
            }
        } catch (error) {
            console.error('Error sending message:', error);
            hapticsManager.error();
            if (navigator.onLine) toast.error('Failed to send message online.');
        }
    };

    const handleSendMedia = async (mediaPathOrFile, mediaType) => {
        if (!mediaPathOrFile || !currentUser) return;

        const isFile = mediaPathOrFile instanceof File || mediaPathOrFile instanceof Blob;
        const mediaPath = isFile ? null : mediaPathOrFile;
        const localFile = isFile ? mediaPathOrFile : null;

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

        const objectUrl = localFile ? URL.createObjectURL(localFile) : null;

        const optimisticMsg = {
            ...dbToFrontend(dbMessageData),
            sender: currentUser,
            tempId: tempId,
            media_url: objectUrl || (mediaPath ? (mediaPath.startsWith('http') ? mediaPath : getPublicMediaUrl(mediaPath)) : null)
        };

        addStoreMessage(validChatId, optimisticMsg);
        setReplyingTo(null);

        hapticsManager.impact();

        try {
            await db.messages.add({
                ...dbMessageData,
                id: `temp_media_${tempId}`,
                tempId: tempId
            });

            if (navigator.onLine && !localFile) {
                const { data, error } = await supabase
                    .from('messages')
                    .insert(dbMessageData)
                    .select()
                    .single();

                if (error) throw error;

                const realMsgWithSender = { ...dbToFrontend(data), sender: currentUser };
                replaceTempMessage(validChatId, tempId, realMsgWithSender);

                await db.transaction('rw', db.messages, async () => {
                    await db.messages.delete(`temp_media_${tempId}`);
                    await db.messages.add(data);
                });
            } else {
                await addToSyncQueue('send_message', {
                    ...dbMessageData,
                    tempId,
                    file: localFile
                });
                toast.success(localFile ? 'Media queued for upload/sync' : 'Media queued for sync (offline)');
            }
        } catch (error) {
            console.error('Error sending media message:', error);
            hapticsManager.error();
            if (navigator.onLine) toast.error('Failed to send media online.');
        }
    };

    const handleReply = (message) => {
        setReplyingTo(message);
    };

    const cancelReply = () => {
        setReplyingTo(null);
    };

    // ─── MESSAGING ACTIONS ────────────────────────────────────────────────────
    const confirmClearChat = async () => {
        try {
            const { error } = await supabase.from('messages').delete().eq('chat_id', chatId);
            if (error) throw error;
            setStoreMessages(chatId, []);
            toast.success('Chat cleared');
        } catch (error) {
            console.error('Error clearing chat:', error);
            toast.error('Failed to clear chat');
        }
    };

    const confirmBlockUser = async () => {
        try {
            const { error } = await supabase.from('relationships').upsert({
                user_id: currentUser.id,
                target_id: otherUserId,
                status: 'blocked'
            });
            if (error) throw error;
            toast.success('User blocked');
            navigate('/');
        } catch (error) {
            console.error('Error blocking user:', error);
            toast.error('Failed to block user');
        }
    };

    const confirmSelectionDelete = async (selectedIds, callback) => {
        try {
            const { error } = await supabase.from('messages').delete().in('id', selectedIds);
            if (error) throw error;
            selectedIds.forEach(id => removeStoreMessage(chatId, id));
            if (callback) callback();
            toast.success('Messages deleted');
        } catch (error) {
            console.error('Error deleting messages:', error);
            toast.error('Failed to delete messages');
        }
    };

    const handleShareAsForward = (mediaUrl, message) => {
        // Prepare for forwarding - the chat component handles the modal state
        // and which messages are being forwarded. This is a logic bridge.
        return [{ ...message, id: `fwd_${Date.now()}` }];
    };

    const handleMediaDownload = async (mediaUrl, message) => {
        try {
            const savedPath = await saveImageToDevice(mediaUrl, message.id || Date.now());
            toast.success('Saved to device');
            return savedPath;
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to save to device');
        }
    };

    // ─── MUTE HANDLER ─────────────────────────────────────────────────────────
    const handleMuteToggle = () => {
        const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
        if (isMuted) { delete mutedChats[chatId]; } else { mutedChats[chatId] = true; }
        localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
        setIsMuted(!isMuted);
        toast.success(isMuted ? 'Notifications unmuted' : 'Notifications muted');
    };

    return {
        // Route
        chatId, otherUserId, validChatId, isGroupChat, navigate, location,
        // Users
        currentUser, otherUser, setOtherUser, isInitializing,
        // Messages
        messages, isFetchingNextPage, hasNextPage, fetchNextPage,
        typingUsers, sendTyping,
        // Mute / Temp
        isMuted, isTempChat, setIsTempChat, vanishPresets, setVanishPresets, selectedVanishDuration, setSelectedVanishDuration,
        // Store
        addStoreMessage, updateStoreMessage, removeStoreMessage, replaceTempMessage,
        // Calls
        activeCallData, activeGroupCall, showGroupCallScreen, setShowGroupCallScreen,
        handleVoiceCall, handleVideoCall, handleEndGroupCall, handleStartGroupCall,
        // Handlers
        handleMuteToggle, confirmClearChat, confirmBlockUser, confirmSelectionDelete,
        handleShareAsForward, handleMediaDownload,
        // Misc
        supabase, isAuthenticated, authLoading, allChats, queryClient,
        showAlert, initialScrollPosition, saveScrollPosition,
        isMessagesLoading,
        // Messaging
        sendMessage, handleSendMedia, replyingTo, setReplyingTo, handleReply, cancelReply,
    };
};

export default useChatRoom;
