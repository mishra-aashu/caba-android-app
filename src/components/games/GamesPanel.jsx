import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSupabase } from '../../contexts/SupabaseContext';

import {
  Gamepad2, Sword, Users, Clock, ChevronRight,
  Zap, Trophy, Circle, RefreshCw, Bell,
  Flame, Swords
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import PlayerAvatar from '../common/PlayerAvatar';
import { useTruthDareGame } from '../../hooks/useTruthDareGame';
import { useChessGame } from '../../hooks/useChessGame';
import { GAME_TYPES } from '../../constants/gameData';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import ArenaRoom from '../chat/ArenaRoom';
import { DB_TABLES } from '../../constants/gameData';
import styles from './GamesPanel.module.css';
import usePresenceStore from '../../store/usePresenceStore';
import { isUserOnline, formatLastSeen } from '../../utils/dateFormatter';

// ─── Constants ────────────────────────────────────────
const INVITES_CHANNEL_PREFIX = 'games_panel_invites';
const MAX_INVITES = 30;
const REFRESH_DEBOUNCE_MS = 1000;
const INVITE_EXPIRY_MS = 3600000; // 1 hour expiry for auto-join

// ─── Helpers ──────────────────────────────────────────────
// NOTE: For invite card timestamps (created_at), we use a compact relative time.
// For user presence, we use the unified formatLastSeen from dateFormatter.
const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 0 || mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const normalizeUserIds = (id1, id2) => [id1, id2].sort((a, b) => a.localeCompare(b));

const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// ─── Main Component ────────────────────────────────────────
const GamesPanel = () => {
  const { dbUser } = useAuth();
  const { supabase } = useSupabase();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Contacts & Chats Filtering ───────────────────────
  const myContacts = useLiveQuery(() => db.contacts.toArray()) || [];
  const myChats = useLiveQuery(() => db.chats_list.toArray()) || [];
  
  const onlineUsersMap = usePresenceStore(state => state.onlineUsers);
  
  // ── All Opponents (Unified List) ──────────────────────
  const allOpponents = useMemo(() => {
    const opponentsMap = new Map();

    // 1. Process Contacts
    myContacts.forEach(contact => {
      const u = contact.otherUser;
      if (u && u.id) {
        opponentsMap.set(String(u.id), {
          id: u.id,
          name: contact.contactName || u.name || 'Unknown',
          avatar: u.avatar,
          isOnline: u.is_online || u.isOnline || false,
          lastSeen: u.last_seen || u.lastSeen || null
        });
      }
    });

    // 2. Process Recent Chats (to include people not in contacts)
    myChats.forEach(chat => {
      const u = chat.otherUser || chat.participant;
      if (u && u.id && !opponentsMap.has(String(u.id))) {
        opponentsMap.set(String(u.id), {
          id: u.id,
          name: u.name || 'Unknown',
          avatar: u.avatar,
          isOnline: u.is_online || u.isOnline || false,
          lastSeen: u.last_seen || u.lastSeen || null
        });
      }
    });

    // 3. Final List with sorting
    // We include onlineUsersMap in dependencies to ensure the list re-sorts
    // automatically when someone's status changes in the store.
    return Array.from(opponentsMap.values()).sort((a, b) => {
      const isOnlineA = onlineUsersMap[String(a.id)]?.isOnline || isUserOnline(a.isOnline, a.lastSeen);
      const isOnlineB = onlineUsersMap[String(b.id)]?.isOnline || isUserOnline(b.isOnline, b.lastSeen);
      
      if (isOnlineA && !isOnlineB) return -1;
      if (!isOnlineA && isOnlineB) return 1;
      
      const dateA = new Date(a.lastSeen || 0);
      const dateB = new Date(b.lastSeen || 0);
      return dateB - dateA;
    });
  }, [myContacts, myChats, onlineUsersMap]); // Added onlineUsersMap dependency

  // Reactive online count from the store
  const onlineCount = useMemo(() => {
    return allOpponents.filter(u => {
        const isLive = onlineUsersMap[String(u.id)]?.isOnline;
        const isDb = isUserOnline(u.isOnline, u.lastSeen);
        return isLive || isDb;
    }).length;
  }, [allOpponents, onlineUsersMap]);

  const [pendingInvites, setPendingInvites] = useState([]);

  const [loadingInvites, setLoadingInvites] = useState(true);
  const [processingInviteId, setProcessingInviteId] = useState(null);
  const [tab, setTab] = useState('online'); 
  const isSubscribedRef = useRef(true);

  // Unified Battle Context
  const [battleContext, setBattleContext] = useState(null); // { chatId, opponentId, gameType }
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGameSelector, setShowGameSelector] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const tdGame = useTruthDareGame(battleContext?.chatId, dbUser, supabase);
  const chessGame = useChessGame(battleContext?.chatId, dbUser, supabase);

  const activeGame = battleContext?.gameType === GAME_TYPES.CHESS ? chessGame : tdGame;

  // ── Load pending invitations ───────────────────────────
  const loadInvites = useCallback(async () => {
    if (!dbUser?.id) return;
    setLoadingInvites(true);
    try {
      const { data, error } = await supabase
        .from(DB_TABLES.GAME_INVITATIONS)
        .select(`
          *,
          sender:users!sender_id (id, name, avatar),
          receiver:users!receiver_id (id, name, avatar)
        `)
        .or(`sender_id.eq.${dbUser.id},receiver_id.eq.${dbUser.id}`)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(MAX_INVITES);

      if (error) throw error;
      if (isSubscribedRef.current) setPendingInvites(data || []);
    } catch (error) {
      console.error('Error loading invites:', error);
    } finally {
      if (isSubscribedRef.current) setLoadingInvites(false);
    }
  }, [dbUser?.id, supabase]);

  const debouncedRefresh = useMemo(() => debounce(loadInvites, REFRESH_DEBOUNCE_MS), [loadInvites]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  // ── Subscribe to invitation changes ────────────────────
  useEffect(() => {
    if (!dbUser?.id) return;
    const channel = supabase
      .channel(`${INVITES_CHANNEL_PREFIX}_${dbUser.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: DB_TABLES.GAME_INVITATIONS,
        filter: `receiver_id=eq.${dbUser.id}`,
      }, () => loadInvites())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: DB_TABLES.GAME_INVITATIONS,
        filter: `sender_id=eq.${dbUser.id}`,
      }, () => loadInvites())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dbUser?.id, supabase, loadInvites]);
  
  const handleRefreshPresence = async () => {
    setIsRefreshing(true);
    console.log('[GamesPanel] Manual refresh triggered');
    
    // Attempt to refresh the global presence channel via the manager
    try {
        const { realtimeManager } = await import('../../utils/realtimeManager');
        await realtimeManager.refreshChannel('game_lobby_presence');
        toast.success('Player list updated');
    } catch (err) {
        console.error('Refresh failed:', err);
    }
    
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (!activeGame.isActive && battleContext) {
      const timer = setTimeout(() => {
        setBattleContext(null);
        hasAutoJoinedRef.current = false;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeGame.isActive, battleContext]);


  // ── Handlers ──────────────────────────────────────────
  const handleInviteUser = (user) => {
    setSelectedUser(user);
    setShowGameSelector(true);
  };

  const handleConfirmInvite = useCallback(async (targetUser, gameType) => {
    if (!dbUser?.id || !targetUser?.id) return;
    setShowGameSelector(false);
    const loadingToast = toast.loading(`Sending ${gameType.replace('_', ' ')} invitation...`);
    try {
      const [user1_id, user2_id] = normalizeUserIds(dbUser.id, targetUser.id);
      
      // 1. Ensure chat exists
      let chatId;
      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .eq('user1_id', user1_id)
        .eq('user2_id', user2_id)
        .maybeSingle();

      if (existingChat?.id) {
        chatId = existingChat.id;
      } else {
        const { data: newChat, error: insertChatError } = await supabase
          .from('chats')
          .insert([{ user1_id, user2_id, updated_at: new Date().toISOString() }])
          .select('id')
          .single();
        if (insertChatError) throw insertChatError;
        chatId = newChat.id;
      }

      // 2. Create the game invitation record
      const { data: invite, error: inviteError } = await supabase
        .from(DB_TABLES.GAME_INVITATIONS)
        .insert({
          chat_id: chatId,
          sender_id: dbUser.id,
          receiver_id: targetUser.id,
          game_type: gameType,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      toast.dismiss(loadingToast);
      toast.success('Invitation sent!');
      
      // 3. Set context and join the battle in inviting state
      setBattleContext({ 
        chatId, 
        opponentId: targetUser.id,
        gameType: gameType,
        opponentMetadata: {
          name: targetUser.name,
          avatar: targetUser.avatar
        }
      });
      
      const targetGame = gameType === GAME_TYPES.CHESS ? chessGame : tdGame;
      targetGame.joinBattle(invite.id, true, invite.status, targetUser.id, { 
        name: targetUser.name, 
        avatar: targetUser.avatar 
      }); // true = isHost
      
      // 4. Refresh invites list
      loadInvites();
    } catch (err) {
      console.error('Error starting battle:', err);
      toast.dismiss(loadingToast);
      toast.error('Could not send invitation.');
    }
  }, [dbUser?.id, supabase, tdGame.joinBattle, chessGame.joinBattle, loadInvites]);

  const handleAcceptInvite = useCallback(async (invite) => {
    if (!invite.chat_id) return;
    setProcessingInviteId(invite.id);
    const loadingToast = toast.loading('Joining battle...');
    try {
      toast.dismiss(loadingToast);
      setBattleContext({ 
        chatId: invite.chat_id, 
        opponentId: invite.sender_id,
        gameType: invite.game_type,
        opponentMetadata: {
          name: invite.sender?.name,
          avatar: invite.sender?.avatar
        }
      });
      const targetGame = invite.game_type === GAME_TYPES.CHESS ? chessGame : tdGame;
      targetGame.acceptGame(invite);
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error('Failed to join battle');
    } finally {
      setProcessingInviteId(null);
    }
  }, [tdGame.acceptGame, chessGame.acceptGame]);

  // ── Handle Auto-Join from Notification (Moved after handleAcceptInvite) ──
  useEffect(() => {
    if (location.state?.autoJoinInvite) {
      const invite = location.state.autoJoinInvite;
      // Clear the state so it doesn't trigger again on re-render
      window.history.replaceState({}, document.title);
      handleAcceptInvite(invite);
    }
  }, [location.state, handleAcceptInvite]);

  // ── Auto-Join Logic (Restored) ─────────────────────────
  const hasAutoJoinedRef = useRef(false);
  useEffect(() => {
    // We only return if we are ALREADY in a playing/active state.
    // If we are in 'inviting' or 'joining', we might still need to transition to 'playing'.
    const isActuallyPlaying = activeGame.isActive && 
      !['inviting', 'joining', 'idle'].includes(activeGame.gameState?.stage);

    if (isActuallyPlaying || loadingInvites) return;
    if (!dbUser?.id || pendingInvites.length === 0) return;

    const acceptedInv = pendingInvites.find(inv => 
      inv.status === 'accepted' && 
      (inv.sender_id === dbUser.id || inv.receiver_id === dbUser.id) &&
      (Date.now() - new Date(inv.created_at).getTime() < INVITE_EXPIRY_MS)
    );

    if (acceptedInv) {
      // If we are already the host or guest of this specific game and it's in inviting/joining stage, 
      // transition it to playing now that the status is 'accepted'.
      if (activeGame.isActive && activeGame.gameState?.gameId === acceptedInv.id) {
         if (activeGame.gameState.stage === 'inviting' || activeGame.gameState.stage === 'joining') {
            const opponentId = acceptedInv.sender_id === dbUser.id ? acceptedInv.receiver_id : acceptedInv.sender_id;
            activeGame.joinBattle(acceptedInv.id, acceptedInv.sender_id === dbUser.id, 'accepted', opponentId);
            return;
         }
      }

      if (hasAutoJoinedRef.current) return;
      
      hasAutoJoinedRef.current = true;
      const opponentId = acceptedInv.sender_id === dbUser.id ? acceptedInv.receiver_id : acceptedInv.sender_id;
      setBattleContext({ 
        chatId: acceptedInv.chat_id, 
        opponentId, 
        gameType: acceptedInv.game_type,
        opponentMetadata: {
           name: acceptedInv.sender_id === dbUser.id ? acceptedInv.receiver?.name : acceptedInv.sender?.name,
           avatar: acceptedInv.sender_id === dbUser.id ? acceptedInv.receiver?.avatar : acceptedInv.sender?.avatar
        }
      });
      const targetGame = acceptedInv.game_type === GAME_TYPES.CHESS ? chessGame : tdGame;
      targetGame.joinBattle(acceptedInv.id, acceptedInv.sender_id === dbUser.id, acceptedInv.status, opponentId);
    }
  }, [pendingInvites, activeGame.isActive, activeGame.gameState?.stage, activeGame.gameState?.gameId, dbUser?.id, loadingInvites, tdGame.joinBattle, chessGame.joinBattle]);

  const handleRejectInvite = useCallback(async (invite) => {
    setProcessingInviteId(invite.id);
    try {
      await supabase.from(DB_TABLES.GAME_INVITATIONS)
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', invite.id);
      toast.success('Invitation declined');
      loadInvites();
    } catch (err) {
      toast.error('Failed to decline invitation');
    } finally {
      setProcessingInviteId(null);
    }
  }, [supabase, loadInvites]);

  const handleResume = useCallback((invite) => {
    const opponentId = invite.sender_id === dbUser?.id ? invite.receiver_id : invite.sender_id;
    const opponent = invite.sender_id === dbUser?.id ? invite.receiver : invite.sender;
    setBattleContext({ 
      chatId: invite.chat_id, 
      opponentId,
      gameType: invite.game_type,
      opponentMetadata: {
        name: opponent?.name,
        avatar: opponent?.avatar
      }
    });
    const targetGame = invite.game_type === GAME_TYPES.CHESS ? chessGame : tdGame;
    targetGame.joinBattle(invite.id, invite.sender_id === dbUser?.id, invite.status, opponentId, {
      name: opponent?.name,
      avatar: opponent?.avatar
    });
  }, [dbUser?.id, tdGame.joinBattle, chessGame.joinBattle]);

  const gameProps = useMemo(() => ({
    ...activeGame.gameState,
    gameType: battleContext?.gameType,
    userId: dbUser?.id,
    partnerId: battleContext?.opponentId,
    // Truth or Dare handlers
    onPick: tdGame.pickType,
    onSend: tdGame.sendChallenge,
    onComplete: tdGame.completeTurn,
    onStart: () => activeGame.startGame(battleContext?.opponentId),
    onAccept: () => {
      const invite = pendingInvites.find(inv => inv.chat_id === battleContext?.chatId && inv.status === 'pending');
      if (invite) activeGame.acceptGame(invite);
    },
    onReject: () => {
      const invite = pendingInvites.find(inv => inv.chat_id === battleContext?.chatId && inv.status === 'pending');
      if (invite) handleRejectInvite(invite);
    },
    onJoin: activeGame.joinBattle,
    onSkip: tdGame.skipTurn,
    onSwitch: tdGame.switchType,
    onConfirmSettings: tdGame.confirmSettings,
    onStartSpin: tdGame.startSpin,
    completeSpin: tdGame.completeSpin,
    askTD: tdGame.askTD,
    updateSettingsDraft: tdGame.updateSettingsDraft,
    
    // Chess handlers
    makeMove: chessGame.makeMove,
    
    onExit: () => activeGame.closeGame(),
    isHost: activeGame.isHost,
    isMyTurn: activeGame.isMyTurn,
    webrtc: activeGame.webrtc
  }), [activeGame, tdGame, chessGame, dbUser?.id, battleContext, pendingInvites, handleRejectInvite]);

  const pendingForMe = useMemo(() => 
    pendingInvites.filter(inv => inv.status === 'pending' && inv.receiver_id === dbUser?.id),
    [pendingInvites, dbUser?.id]
  );

  const myActive = useMemo(() => 
    pendingInvites.filter(inv => inv.status !== 'rejected' && (inv.sender_id === dbUser?.id || inv.receiver_id === dbUser?.id)),
    [pendingInvites, dbUser?.id]
  );

  // ─── Render View ────────────────────────────────────────
  if (battleContext && activeGame.isActive) {
    return createPortal(
      <div className={styles.fullScreenPanel}>
        <ArenaRoom 
          chatId={battleContext.chatId}
          userId={dbUser?.id}
          userName={dbUser?.name}
          gameProps={gameProps}
          webrtcProps={activeGame.webrtc}
          onExit={activeGame.closeGame}
        />
      </div>,
      document.body
    );
  }

  return (
    <div className={styles.panel}>
      <AnimatePresence>
        {showGameSelector && selectedUser && (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className={styles.modalOverlay}
                onClick={() => setShowGameSelector(false)}
            >
                <motion.div 
                    initial={{ y: 20, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }} 
                    exit={{ y: 20, opacity: 0 }} 
                    className={styles.selectionModal}
                    onClick={e => e.stopPropagation()}
                >
                    <h3>Choose Game</h3>
                    <p>Invite {selectedUser.name} to play:</p>
                    <div className={styles.gameOptions}>
                        <button className={styles.gameOption} onClick={() => handleConfirmInvite(selectedUser, GAME_TYPES.TRUTH_OR_DARE)}>
                            <Flame size={24} color="#f59e0b" />
                            <span>Truth or Dare</span>
                        </button>
                        <button className={styles.gameOption} onClick={() => handleConfirmInvite(selectedUser, GAME_TYPES.CHESS)}>
                            <Swords size={24} color="#3b82f6" />
                            <span>Chess Match</span>
                        </button>
                    </div>
                    <button className={styles.closeBtn} onClick={() => setShowGameSelector(false)}>Cancel</button>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Gamepad2 size={20} /></div>
          <div>
            <h2 className={styles.headerTitle}>Game Hub</h2>
            <p className={styles.headerSub}>
              {onlineCount} online · {pendingForMe.length} invite{pendingForMe.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={debouncedRefresh} disabled={loadingInvites}>
          <RefreshCw size={15} className={loadingInvites ? styles.spinning : ''} />
        </button>
      </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'online' ? styles.tabActive : ''}`} onClick={() => setTab('online')}>
            <Users size={14} /> Players {onlineCount > 0 && <span className={styles.tabBadge}>{onlineCount}</span>}
          </button>
          <button className={`${styles.tab} ${tab === 'invites' ? styles.tabActive : ''}`} onClick={() => setTab('invites')}>
            <Sword size={14} /> Invites {pendingForMe.length > 0 && <span className={`${styles.tabBadge} ${styles.tabBadgeAlert}`}>{pendingForMe.length}</span>}
          </button>
          <div className={styles.tabSpacer} />
          <button className={styles.refreshIconBtn} onClick={handleRefreshPresence} disabled={isRefreshing} title="Refresh list">
            <RefreshCw size={14} className={isRefreshing ? styles.spinning : ''} />
          </button>
        </div>

        <div className={styles.content}>
          <AnimatePresence mode="wait">
            {tab === 'online' ? (
              <motion.div key="online" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className={styles.listWrap}>
                {allOpponents.length > 0 ? (
                  <div className={styles.userList}>
                    {allOpponents.map((user) => (
                      <OnlineUserCard 
                        key={user.id} 
                        user={user} 
                        onInvite={() => handleInviteUser(user)} 
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState 
                    icon={<Users size={36} />} 
                    title="No contacts found" 
                    sub="Add some friends to start a battle!" 
                  />
                )}
              </motion.div>
          ) : (
            <motion.div key="invites" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className={styles.listWrap}>
              {loadingInvites && myActive.length === 0 ? <div className={styles.loadingArea}><div className={styles.spinner} /><p>Loading...</p></div> : 
               myActive.length === 0 ? <EmptyState icon={<Trophy size={36} />} title="No active games" sub="Start a battle from any chat!" /> : (
                <div className={styles.inviteList}>
                  {myActive.map((inv) => (
                    <InviteCard 
                      key={inv.id} 
                      invite={inv} 
                      currentUserId={dbUser?.id} 
                      isProcessing={processingInviteId === inv.id} 
                      onAccept={() => handleAcceptInvite(inv)} 
                      onReject={() => handleRejectInvite(inv)} 
                      onResume={() => handleResume(inv)} 
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Online User Card ──────────────────────────────────────
// Now uses a live selector from usePresenceStore for maximum reactivity.
const OnlineUserCard = React.memo(({ user, onInvite }) => {
  // 1. Check Live Presence Store first (reactive)
  const isOnlineLive = usePresenceStore(state => state.isUserOnline(user.id));
  
  // 2. Check Database Fallback
  const isOnlineDb = isUserOnline(user.isOnline, user.lastSeen);
  
  const isOnline = isOnlineLive || isOnlineDb;
  const isOffline = !isOnline;

  return (
    <motion.div 
      className={`${styles.userCard} ${isOffline ? styles.userCardOffline : ''}`} 
      whileHover={{ scale: 1.01 }} 
      whileTap={{ scale: 0.99 }}
    >
      <div className={styles.userCardLeft}>
        <div className={styles.avatarWrap}>
          <PlayerAvatar avatar={user.avatar} name={user.name} size={38} />
          <span className={isOffline ? styles.offlineDot : styles.onlineDot} />
        </div>
        <div className={styles.userInfo}>
          <p className={styles.userName}>{user.name}</p>
          <div className={styles.userSub}>
            {isOffline ? (
              // Offline: show "Last seen X" using the unified formatLastSeen
              user.lastSeen ? (
                <span className={styles.statusText}>
                  <Clock size={10} /> Last seen {formatLastSeen(user.lastSeen)}
                </span>
              ) : (
                <span className={styles.statusText}>
                  <Clock size={10} /> Offline
                </span>
              )
            ) : (
              // Online: confirmed by live presence or recent DB activity
              <span className={`${styles.statusText} ${styles.statusOnline}`}>
                <Circle size={6} fill="currentColor" /> Online
              </span>
            )}
          </div>
        </div>
      </div>
      <button className={styles.inviteBtn} onClick={onInvite}>
        {isOffline ? <Bell size={14} /> : <Zap size={14} />}
        <span>{isOffline ? 'Notify' : 'Invite'}</span>
      </button>
    </motion.div>
  );
});

// ─── Invite Card ───────────────────────────────────────────
const InviteCard = React.memo(({ invite, currentUserId, isProcessing, onAccept, onReject, onResume }) => {
  const isReceiver = invite.receiver_id === currentUserId;
  return (
    <motion.div className={`${styles.inviteCard} ${invite.status === 'pending' && isReceiver ? styles.inviteCardPending : ''}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className={styles.inviteTop}>
        <span className={styles.gameTypeBadge}>{invite.game_type?.replaceAll('_', ' ') || 'Game'}</span>
        <span className={`${styles.statusDot} ${styles[`status_${invite.status}`]}`}>{invite.status}</span>
      </div>
      <div className={styles.versus}>
        <div className={styles.player}><PlayerAvatar avatar={invite.sender?.avatar} name={invite.sender?.name || 'Unknown'} size={32} /><span>{invite.sender?.name || 'Unknown'}</span></div>
        <span className={styles.vsText}>VS</span>
        <div className={styles.player}><PlayerAvatar avatar={invite.receiver?.avatar} name={invite.receiver?.name || 'Unknown'} size={32} /><span>{invite.receiver?.name || 'Unknown'}</span></div>
      </div>
      <div className={styles.inviteActions}>
        <span className={styles.timeAgo}><Clock size={11} />{timeAgo(invite.created_at)}</span>
        {invite.status === 'pending' && isReceiver ? (
          <div className={styles.actionBtns}>
            <button className={styles.rejectBtn} onClick={onReject} disabled={isProcessing}>Decline</button>
            <button className={styles.acceptBtn} onClick={onAccept} disabled={isProcessing}>Join Battle <ChevronRight size={14} /></button>
          </div>
        ) : <button className={styles.resumeBtn} onClick={onResume} disabled={isProcessing}>Resume <ChevronRight size={14} /></button>}
      </div>
    </motion.div>
  );
});

// ─── Empty State ───────────────────────────────────────────
const EmptyState = React.memo(({ icon, title, sub }) => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIcon}>{icon}</div>
    <h4>{title}</h4>
    <p>{sub}</p>
  </div>
));

export default GamesPanel;