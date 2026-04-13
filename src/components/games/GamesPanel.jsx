/**
 * GamesPanel.jsx
 *
 * The Games Hub — shows:
 *   1. Online contacts (using Supabase Presence channels)
 *   2. Pending game invitations for the current user
 *   3. "Invite to Game" button per contact → navigates to Arena
 *
 * This panel is rendered in:
 *   - Desktop: Sidebar slot when /games route is active
 *   - Mobile: Full screen page at /games
 *
 * Required RLS Policies:
 *   - GAME_INVITATIONS: Users can read invites where they are sender/receiver
 *   - chats: Users can read/write chats where they are user1/user2
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useGameLobby } from '../../contexts/GameLobbyContext';
import {
  Gamepad2, Sword, Users, Clock, ChevronRight,
  Zap, Trophy, Circle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import PlayerAvatar from '../common/PlayerAvatar';
import { DB_TABLES } from '../../constants/gameData';
import styles from './GamesPanel.module.css';

// ─── Constants ────────────────────────────────────────
const INVITES_CHANNEL_PREFIX = 'games_panel_invites';
const MAX_INVITES = 30;
const REFRESH_DEBOUNCE_MS = 1000;

// ─── Helpers ──────────────────────────────────────────────
const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  
  if (mins < 0) return 'just now'; // Handle clock skew
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const isNotCurrentUser = (presence, currentUserId) => 
  presence.user_id !== currentUserId;

const normalizeUserIds = (id1, id2) => 
  [id1, id2].sort((a, b) => a.localeCompare(b));

// Simple debounce helper
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

  // ✅ Online users come from the shared GameLobbyProvider (single channel)
  const { onlineUsers } = useGameLobby();

  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [processingInviteId, setProcessingInviteId] = useState(null);
  const [tab, setTab] = useState('online'); // 'online' | 'invites'
  const isSubscribedRef = useRef(true);

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
      if (isSubscribedRef.current) {
        setPendingInvites(data || []);
      }
    } catch (error) {
      console.error('Error loading invites:', error);
      if (isSubscribedRef.current) {
        toast.error('Failed to load invitations');
      }
    } finally {
      if (isSubscribedRef.current) {
        setLoadingInvites(false);
      }
    }
  }, [dbUser?.id, supabase]);

  // Debounced refresh
  const debouncedRefresh = useMemo(
    () => debounce(loadInvites, REFRESH_DEBOUNCE_MS),
    [loadInvites]
  );

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
      }, () => {
        if (isSubscribedRef.current) {
          loadInvites();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: DB_TABLES.GAME_INVITATIONS,
        filter: `sender_id=eq.${dbUser.id}`,
      }, () => {
        if (isSubscribedRef.current) {
          loadInvites();
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [dbUser?.id, supabase, loadInvites]);


  // ── Navigate to arena with/without existing chat ───────
  const handleInviteUser = useCallback(async (targetUser) => {
    if (!dbUser?.id || !targetUser?.id) return;

    const loadingToast = toast.loading('Opening game room...');

    try {
      // Normalize user IDs to prevent duplicates
      const [user1_id, user2_id] = normalizeUserIds(dbUser.id, targetUser.id);

      // Try to find existing chat
      const { data: existingChat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('user1_id', user1_id)
        .eq('user2_id', user2_id)
        .maybeSingle();

      if (chatError && chatError.code !== 'PGRST116') throw chatError;

      if (existingChat?.id) {
        toast.dismiss(loadingToast);
        navigate(`/chat/${existingChat.id}/${targetUser.id}/arena`);
        return;
      }

      // Create a new DM chat if none exists
      const { data: newChat, error: insertError } = await supabase
        .from('chats')
        .insert([{ 
          user1_id, 
          user2_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select('id')
        .single();

      if (insertError) {
        // Handle potential race condition - chat might have been created between check and insert
        if (insertError.code === '23505') { // Unique violation
          const { data: raceChat } = await supabase
            .from('chats')
            .select('id')
            .eq('user1_id', user1_id)
            .eq('user2_id', user2_id)
            .single();
            
          if (raceChat?.id) {
            toast.dismiss(loadingToast);
            navigate(`/chat/${raceChat.id}/${targetUser.id}/arena`);
            return;
          }
        }
        throw insertError;
      }

      if (!newChat?.id) throw new Error('Failed to create chat room');

      toast.dismiss(loadingToast);
      navigate(`/chat/${newChat.id}/${targetUser.id}/arena`);
    } catch (err) {
      console.error('Error navigating to arena:', err);
      toast.dismiss(loadingToast);
      toast.error('Could not open game room. Please try again.');
    }
  }, [dbUser?.id, navigate, supabase]);

  const handleAcceptInvite = useCallback(async (invite) => {
    if (!invite.chat_id) {
      toast.error('Invalid game invitation');
      return;
    }

    setProcessingInviteId(invite.id);
    const loadingToast = toast.loading('Joining game...');

    try {
      // Verify chat still exists
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('id', invite.chat_id)
        .single();

      if (chatError || !chat) {
        toast.error('Game room no longer exists');
        loadInvites(); // Refresh to remove stale invite
        return;
      }

      toast.dismiss(loadingToast);
      navigate(`/chat/${invite.chat_id}/${invite.sender_id}/arena`);
    } catch (err) {
      console.error('Error accepting invite:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to join game');
    } finally {
      setProcessingInviteId(null);
    }
  }, [navigate, supabase, loadInvites]);

  const handleRejectInvite = useCallback(async (invite) => {
    setProcessingInviteId(invite.id);
    
    try {
      const { error } = await supabase
        .from(DB_TABLES.GAME_INVITATIONS)
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', invite.id);

      if (error) throw error;
      
      toast.success('Invitation declined');
      loadInvites();
    } catch (err) {
      console.error('Error rejecting invite:', err);
      toast.error('Failed to decline invitation');
    } finally {
      setProcessingInviteId(null);
    }
  }, [supabase, loadInvites]);

  const handleResume = useCallback((invite) => {
    if (!invite.chat_id) {
      toast.error('Invalid game session');
      return;
    }

    const opponentId = invite.sender_id === dbUser?.id 
      ? invite.receiver_id 
      : invite.sender_id;
      
    navigate(`/chat/${invite.chat_id}/${opponentId}/arena`);
  }, [navigate, dbUser?.id]);

  // ── Memoized filtered lists ────────────────────────────
  const pendingForMe = useMemo(() => 
    pendingInvites.filter(
      (inv) => inv.status === 'pending' && inv.receiver_id === dbUser?.id
    ),
    [pendingInvites, dbUser?.id]
  );

  const myActive = useMemo(() => 
    pendingInvites.filter(
      (inv) => inv.status !== 'rejected' &&
        (inv.sender_id === dbUser?.id || inv.receiver_id === dbUser?.id)
    ),
    [pendingInvites, dbUser?.id]
  );

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Gamepad2 size={20} />
          </div>
          <div>
            <h2 className={styles.headerTitle}>Game Hub</h2>
            <p className={styles.headerSub}>
              {onlineUsers.length} online · {pendingForMe.length} invite{pendingForMe.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button 
          className={styles.refreshBtn} 
          onClick={debouncedRefresh} 
          title="Refresh"
          disabled={loadingInvites}
        >
          <RefreshCw size={15} className={loadingInvites ? styles.spinning : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'online' ? styles.tabActive : ''}`}
          onClick={() => setTab('online')}
        >
          <Users size={14} />
          Online
          {onlineUsers.length > 0 && (
            <span className={styles.tabBadge}>{onlineUsers.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${tab === 'invites' ? styles.tabActive : ''}`}
          onClick={() => setTab('invites')}
        >
          <Sword size={14} />
          Invites
          {pendingForMe.length > 0 && (
            <span className={`${styles.tabBadge} ${styles.tabBadgeAlert}`}>
              {pendingForMe.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <AnimatePresence mode="wait">
          {tab === 'online' ? (
            <motion.div
              key="online"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
              className={styles.listWrap}
            >
              {onlineUsers.length === 0 ? (
                <EmptyState
                  icon={<Users size={36} />}
                  title="No one online"
                  sub="Invite friends to play together!"
                />
              ) : (
                <div className={styles.userList}>
                  {onlineUsers.map((user) => (
                    <OnlineUserCard
                      key={user.id}
                      user={user}
                      onInvite={() => handleInviteUser(user)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="invites"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className={styles.listWrap}
            >
              {loadingInvites && myActive.length === 0 ? (
                <div className={styles.loadingArea}>
                  <div className={styles.spinner} />
                  <p>Loading invitations...</p>
                </div>
              ) : myActive.length === 0 ? (
                <EmptyState
                  icon={<Trophy size={36} />}
                  title="No active games"
                  sub="Start a battle from any chat!"
                />
              ) : (
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
const OnlineUserCard = React.memo(({ user, onInvite }) => (
  <motion.div
    className={styles.userCard}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
  >
    <div className={styles.userCardLeft}>
      <div className={styles.avatarWrap}>
        <PlayerAvatar avatar={user.avatar} name={user.name} size={38} />
        <span className={styles.onlineDot} />
      </div>
      <div className={styles.userInfo}>
        <p className={styles.userName}>{user.name}</p>
        <p className={styles.userSub}>
          <Circle size={6} fill="currentColor" />
          Online {timeAgo(user.onlineSince)}
        </p>
      </div>
    </div>
    <button className={styles.inviteBtn} onClick={onInvite}>
      <Zap size={14} />
      <span>Invite</span>
    </button>
  </motion.div>
));

OnlineUserCard.displayName = 'OnlineUserCard';

// ─── Invite Card ───────────────────────────────────────────
const InviteCard = React.memo(({ 
  invite, 
  currentUserId, 
  isProcessing,
  onAccept, 
  onReject, 
  onResume 
}) => {
  const isReceiver = invite.receiver_id === currentUserId;
  const opponent = isReceiver ? invite.sender : invite.receiver;

  return (
    <motion.div
      className={`${styles.inviteCard} ${
        invite.status === 'pending' && isReceiver ? styles.inviteCardPending : ''
      }`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={styles.inviteTop}>
        <span className={styles.gameTypeBadge}>
          {invite.game_type?.replaceAll('_', ' ') || 'Game'}
        </span>
        <span className={`${styles.statusDot} ${styles[`status_${invite.status}`]}`}>
          {invite.status}
        </span>
      </div>

      <div className={styles.versus}>
        <div className={styles.player}>
          <PlayerAvatar 
            avatar={invite.sender?.avatar} 
            name={invite.sender?.name || 'Unknown'} 
            size={32} 
          />
          <span>{invite.sender?.name || 'Unknown'}</span>
        </div>
        <span className={styles.vsText}>VS</span>
        <div className={styles.player}>
          <PlayerAvatar 
            avatar={invite.receiver?.avatar} 
            name={invite.receiver?.name || 'Unknown'} 
            size={32} 
          />
          <span>{invite.receiver?.name || 'Unknown'}</span>
        </div>
      </div>

      <div className={styles.inviteActions}>
        <span className={styles.timeAgo}>
          <Clock size={11} />
          {timeAgo(invite.created_at)}
        </span>
        {invite.status === 'pending' && isReceiver ? (
          <div className={styles.actionBtns}>
            <button 
              className={styles.rejectBtn} 
              onClick={onReject}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Decline'}
            </button>
            <button 
              className={styles.acceptBtn} 
              onClick={onAccept}
              disabled={isProcessing}
            >
              {isProcessing ? 'Joining...' : (
                <>
                  Join Battle <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        ) : (
          <button 
            className={styles.resumeBtn} 
            onClick={onResume}
            disabled={isProcessing}
          >
            Resume <ChevronRight size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
});

InviteCard.displayName = 'InviteCard';

// ─── Empty State ───────────────────────────────────────────
const EmptyState = React.memo(({ icon, title, sub }) => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIcon}>{icon}</div>
    <h4>{title}</h4>
    <p>{sub}</p>
  </div>
));

EmptyState.displayName = 'EmptyState';

export default GamesPanel;