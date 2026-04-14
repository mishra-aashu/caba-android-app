/**
 * ArenaPage.jsx
 * 
 * Main battle arena container that orchestrates:
 * - Game lobby (invitation management)
 * - Active game room (WebRTC + game logic)
 * - Real-time synchronization with Supabase
 * - Auto-join/auto-exit logic for seamless UX
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTruthDareGame, GAME_STATES } from '../../hooks/useTruthDareGame';
import GameLobby from './GameLobby';
import ArenaRoom from './ArenaRoom';
import PlayerAvatar from '../common/PlayerAvatar';
import { ArrowLeft, Gamepad2, Sparkles, LogOut, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabase } from '../../contexts/SupabaseContext';
import { DB_TABLES } from '../../constants/gameData';
import toast from 'react-hot-toast';
import styles from './ArenaPage.module.css';

// ─── Constants ─────────────────────────────────────────────
const PRE_BATTLE_STAGES = [
  GAME_STATES.INVITING, 
  GAME_STATES.JOINING, 
  GAME_STATES.SETUP
];

// Grace period before auto-exit check fires (gives realtime time to populate)
const GRACE_PERIOD_MS = 6000;

const TOAST_IDS = {
  CONNECTION: 'arena-connect',
  DISCONNECTION: 'arena-disconnect',
};

// ─── Game Modal Component ──────────────────────────────────
const GameModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText, 
  cancelText, 
  type = 'danger',
  isProcessing = false 
}) => (
  <AnimatePresence>
    {isOpen && (
      <div className={styles['modal-overlay']}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.2 }}
          className={styles['modal-content']}
        >
          <div className={`${styles['modal-icon']} ${styles[type]}`}>
            <AlertCircle size={32} />
          </div>
          <h3 className={styles['modal-title']}>{title}</h3>
          <p className={styles['modal-message']}>{message}</p>
          <div className={styles['modal-actions']}>
            <button 
              onClick={onClose} 
              className={styles['modal-cancel']}
              disabled={isProcessing}
            >
              {cancelText || 'Cancel'}
            </button>
            <button 
              onClick={onConfirm} 
              className={`${styles['modal-confirm']} ${styles[type]}`}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : (confirmText || 'Confirm')}
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// ─── Main Arena Page Component ─────────────────────────────
const ArenaPage = () => {
  const { chatId, otherUserId } = useParams();
  const navigate = useNavigate();
  const { dbUser } = useAuth();
  const { supabase } = useSupabase();
  const game = useTruthDareGame(chatId, dbUser?.id, supabase);
  
  const [invitations, setInvitations] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, isProcessing: false });
  
  // Refs for tracking state to prevent stale closures
  const isLoadingRef = useRef(false);
  const lastPeerCountRef = useRef(0);
  const hasAutoJoinedRef = useRef(false);
  const isMountedRef = useRef(true);
  const gameStartedAtRef = useRef(null); // Tracks when the game became active

  // ─── Load Invitations ──────────────────────────────────────
  const loadInvitations = useCallback(async () => {
    // Basic UUID validation to prevent 400 Bad Request on "default" or invalid strings
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId);
    if (!chatId || !isUuid || isLoadingRef.current) {
        if (!isUuid && chatId) console.warn('[Arena] Invalid chatId (not a UUID):', chatId);
        setLoadingInvites(false);
        return;
    }
    
    isLoadingRef.current = true;
    setLoadingInvites(true);
    
    try {
      const { data, error } = await supabase
        .from(DB_TABLES.GAME_INVITATIONS)
        .select(`
          *,
          sender:${DB_TABLES.USERS}!sender_id (id, name, avatar),
          receiver:${DB_TABLES.USERS}!receiver_id (id, name, avatar)
        `)
        .eq('chat_id', chatId)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (isMountedRef.current) {
        setInvitations(data || []);
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
      if (isMountedRef.current) {
        toast.error('Failed to load game invitations');
      }
    } finally {
      isLoadingRef.current = false;
      if (isMountedRef.current) {
        setLoadingInvites(false);
      }
    }
  }, [chatId, supabase]);

  // ─── Initial Load & Realtime Subscription ──────────────────
  useEffect(() => {
    isMountedRef.current = true;
    loadInvitations();

    if (!chatId) return;

    const channel = supabase
      .channel(`arena_invites_${chatId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: DB_TABLES.GAME_INVITATIONS,
        filter: `chat_id=eq.${chatId}`
      }, (payload) => {
        console.log('🔔 Realtime Invitation Update:', payload.eventType);
        if (isMountedRef.current) {
          loadInvitations();
        }
      })
      .subscribe();

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [chatId, supabase, loadInvitations]);

  // ─── Connection Status Toasts ──────────────────────────────
  const peerCount = game.webrtc?.peers?.length || 0;
  const joinTimeoutRef = useRef(null);
  
  useEffect(() => {
    const prevCount = lastPeerCountRef.current;
    lastPeerCountRef.current = peerCount;

    // Join Timeout logic
    if (game.isActive && game.gameState.stage === GAME_STATES.JOINING) {
      if (!joinTimeoutRef.current) {
        joinTimeoutRef.current = setTimeout(() => {
          if (peerCount === 0 && isMountedRef.current) {
            toast.error('Connection timed out. Returning to lobby...', { id: 'arena-timeout' });
            game.closeGame();
          }
        }, 20000); // 20s timeout
      }
    } else {
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
    }

    // Only show toast on actual connection change
    if (peerCount > 0 && prevCount === 0) {
      toast.success('⚔️ Opponent Connected!', { 
        id: TOAST_IDS.CONNECTION, 
        duration: 3000 
      });
    } else if (peerCount === 0 && prevCount > 0 && game.isActive) {
      // Disconnection handling with brief grace period to avoid flicker
      const disconnectTimer = setTimeout(() => {
        if (lastPeerCountRef.current === 0 && isMountedRef.current) {
          toast.error('🔌 Opponent Disconnected', { 
            id: TOAST_IDS.DISCONNECTION,
            duration: 3000 
          });
        }
      }, 3000); // 3s grace
      return () => clearTimeout(disconnectTimer);
    }
  }, [peerCount, game.isActive, game.gameState.stage]);

  // ─── Auto-Join Logic (Only Once Per Session) ───────────────
  useEffect(() => {
    if (game.isActive || loadingInvites || hasAutoJoinedRef.current) return;
    if (!dbUser?.id || invitations.length === 0) return;

    const acceptedInv = invitations.find(inv => 
      inv.status === 'accepted' && 
      (inv.sender_id === dbUser.id || inv.receiver_id === dbUser.id)
    );

    if (acceptedInv) {
      console.log('🎮 Accepted game found, auto-joining battle...', acceptedInv.id);
      hasAutoJoinedRef.current = true;
      
      const amIHost = acceptedInv.sender_id === dbUser.id;
      game.joinBattle(acceptedInv.id, amIHost);
    }
  }, [invitations, game.isActive, dbUser?.id, loadingInvites, game.joinBattle]);

  // Track when game becomes active (for auto-exit grace period)
  useEffect(() => {
    if (game.isActive) {
      if (!gameStartedAtRef.current) {
        gameStartedAtRef.current = Date.now();
      }
    } else {
      gameStartedAtRef.current = null;
      hasAutoJoinedRef.current = false;
    }
  }, [game.isActive]);

  // ─── Auto-Exit Logic (Invitation Disappeared/Rejected) ─────
  // Grace period of 6s prevents false positives right after game starts
  // (realtime subscription needs time to populate the invitations list)
  useEffect(() => {
    if (!game.isActive || !game.gameState?.gameId || loadingInvites) return;

    // Don't fire during the grace period
    if (gameStartedAtRef.current && Date.now() - gameStartedAtRef.current < GRACE_PERIOD_MS) return;

    const isPreBattle = PRE_BATTLE_STAGES.includes(game.gameState.stage);
    if (!isPreBattle) return;

    // Only fire if we actually have data loaded (list is non-empty)
    if (invitations.length === 0) return;

    const stillActiveInList = invitations.some(
      inv => inv.id === game.gameState.gameId && inv.status !== 'rejected'
    );

    if (!stillActiveInList) {
      console.log('♻️ Invitation no longer valid, returning to lobby...');
      toast.error('Game invitation was cancelled or rejected');
      game.closeGame();
    }
  }, [invitations, game.isActive, game.gameState?.gameId, game.gameState?.stage, loadingInvites, game.closeGame]);

  // ─── Memoized Values ───────────────────────────────────────
  const pendingInvitesForMe = useMemo(() => 
    invitations.filter(inv => 
      inv.status === 'pending' && 
      inv.receiver_id === dbUser?.id
    ),
    [invitations, dbUser?.id]
  );

  const view = game.isActive ? 'game' : 'lobby';

  // ─── Event Handlers ────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (game.isActive) {
      setModalConfig({
        isOpen: true,
        title: 'Abandon Battle?',
        message: 'Are you sure you want to return to the lobby? Your current progress will be lost.',
        confirmText: 'Abandon',
        type: 'warning',
        isProcessing: false,
        onConfirm: async () => {
          setModalConfig(prev => ({ ...prev, isProcessing: true }));
          try {
            await game.closeGame();
            setModalConfig({ isOpen: false, isProcessing: false });
          } catch (error) {
            console.error('Error closing game:', error);
            toast.error('Failed to close game');
            setModalConfig(prev => ({ ...prev, isProcessing: false }));
          }
        }
      });
    } else {
      navigate(-1);
    }
  }, [game.isActive, game.closeGame, navigate]);

  const handleExit = useCallback(() => {
    setModalConfig({
      isOpen: true,
      title: 'Exit Arena?',
      message: 'This will disconnect your P2P session and return you to the previous page.',
      confirmText: 'Exit Arena',
      type: 'danger',
      isProcessing: false,
      onConfirm: async () => {
        setModalConfig(prev => ({ ...prev, isProcessing: true }));
        try {
          if (game.isActive) {
            await game.closeGame();
          }
          navigate(-1);
        } catch (error) {
          console.error('Error exiting arena:', error);
          navigate(-1); // Force exit even on error
        }
      }
    });
  }, [game.isActive, game.closeGame, navigate]);

  const handleAcceptInvite = useCallback((invitation) => {
    if (!invitation?.id) {
      toast.error('Invalid invitation');
      return;
    }
    
    console.log('🎮 Accepting invitation:', invitation.id);
    game.acceptGame(invitation);
  }, [game.acceptGame]);

  const handleRejectInvite = useCallback((invitation) => {
    if (!invitation?.id) {
      console.warn('⚠️ No invitation to reject');
      game.closeGame();
      return;
    }
    
    console.log('🎮 Rejecting invitation:', invitation.id);
    game.rejectGame(invitation);
  }, [game.rejectGame, game.closeGame]);

  const handleResumeGame = useCallback((invitation) => {
    if (!invitation?.id || !dbUser?.id) {
      toast.error('Cannot resume game');
      return;
    }
    
    const amIHost = invitation.sender_id === dbUser.id;
    game.joinBattle(invitation.id, amIHost);
  }, [game.joinBattle, dbUser?.id]);

  // ─── Game Props ────────────────────────────────────────────
  const gameProps = useMemo(() => ({
    ...game.gameState,
    userId: dbUser?.id,
    partnerId: otherUserId,
    onPick: game.pickType,
    onSend: game.sendChallenge,
    onComplete: game.completeTurn,
    onStart: () => game.startGame(otherUserId),
    onAccept: () => handleAcceptInvite(pendingInvitesForMe[0]),
    onReject: () => handleRejectInvite(pendingInvitesForMe[0]),
    onJoin: game.joinBattle,
    onSkip: game.skipTurn,
    onSwitch: game.switchType,
    onConfirmSettings: game.confirmSettings,
    isHost: game.gameState?.isHost ?? false,
    isMyTurn: game.isMyTurn
  }), [
    game.gameState,
    dbUser?.id,
    otherUserId,
    game.pickType,
    game.sendChallenge,
    game.completeTurn,
    game.startGame,
    game.joinBattle,
    game.skipTurn,
    game.switchType,
    game.confirmSettings,
    game.isMyTurn,
    pendingInvitesForMe,
    handleAcceptInvite,
    handleRejectInvite
  ]);

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className={styles['arena-page-container']}>
      {/* Navigation Bar */}
      <nav className={styles['arena-navbar']}>
        <button onClick={handleBack} className={styles['back-btn']}>
          <ArrowLeft size={20} />
          <span>Lobby</span>
        </button>

        <div className={styles['arena-logo']}>
          <div className={styles['logo-icon']}>
            <Gamepad2 size={24} className="text-white" />
          </div>
          <div className={styles['logo-text']}>
            <h1>BATTLE ARENA</h1>
            <span>
              {view === 'game' ? 'Live Battle' : 'Game Lobby'}
            </span>
          </div>
        </div>

        <button onClick={handleExit} className={styles['exit-btn']} title="Exit Arena">
          <LogOut size={20} />
          <span className={styles['exit-text']}>Exit</span>
        </button>
      </nav>

      {/* Pending Invitation Banner */}
      <AnimatePresence>
        {pendingInvitesForMe.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={styles['invitation-banner']}
          >
            <div className={styles['banner-content']}>
              <div className={styles['banner-left']}>
                <div className={styles['avatar-container']}>
                  <PlayerAvatar 
                    avatar={pendingInvitesForMe[0].sender?.avatar} 
                    name={pendingInvitesForMe[0].sender?.name || 'Unknown'} 
                    size={40} 
                  />
                  <div className={styles['notification-dot']} />
                </div>
                <div className={styles['banner-info']}>
                  <h4 className={styles['banner-title']}>
                    <Sparkles size={12} /> NEW CHALLENGE
                  </h4>
                  <p className={styles['banner-subtitle']}>
                    {pendingInvitesForMe[0].sender?.name || 'Unknown'} is ready!
                  </p>
                </div>
              </div>
              <button 
                className={styles['join-battle-btn']} 
                onClick={() => handleAcceptInvite(pendingInvitesForMe[0])}
              >
                JOIN BATTLE ⚔️
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={styles['arena-main']}>
        <AnimatePresence mode="wait">
          {view === 'lobby' ? (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <GameLobby 
                chatId={chatId}
                otherUserId={otherUserId}
                invitations={invitations}
                loading={loadingInvites}
                onStartTruthDare={() => game.startGame(otherUserId)}
                onResumeGame={handleResumeGame}
                onAcceptGame={handleAcceptInvite}
                onRejectGame={handleRejectInvite}
              />
            </motion.div>
          ) : (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ArenaRoom 
                chatId={chatId}
                userId={dbUser?.id}
                userName={dbUser?.name}
                gameProps={gameProps}
                webrtcProps={game.webrtc}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Exit/Abandon Modal */}
      <GameModal 
        {...modalConfig}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Decorative Elements */}
      <div className={styles['deco-glow-top']} />
      <div className={styles['deco-glow-bottom']} />
    </div>
  );
};

export default ArenaPage;