import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTruthDareGame, GAME_STATES } from '../../hooks/useTruthDareGame';
import GameLobby from './GameLobby';
import ArenaRoom from './ArenaRoom';
import PlayerAvatar from '../common/PlayerAvatar';
import { ArrowLeft, Gamepad2, Sparkles, LogOut, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const GameModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, type = 'danger' }) => {
    if (!isOpen) return null;
    return (
        <AnimatePresence>
            <div className={styles['modal-overlay']}>
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className={styles['modal-content']}
                >
                    <div className={`${styles['modal-icon']} ${styles[type]}`}>
                        <AlertCircle size={32} />
                    </div>
                    <h3 className={styles['modal-title']}>{title}</h3>
                    <p className={styles['modal-message']}>{message}</p>
                    <div className={styles['modal-actions']}>
                        <button onClick={onClose} className={styles['modal-cancel']}>
                            {cancelText || 'Cancel'}
                        </button>
                        <button onClick={onConfirm} className={`${styles['modal-confirm']} ${styles[type]}`}>
                            {confirmText || 'Confirm'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
import styles from './ArenaPage.module.css';
import { useSupabase } from '../../contexts/SupabaseContext';
import { DB_TABLES } from '../../constants/gameData';
import toast from 'react-hot-toast';

const ArenaPage = () => {
    const { chatId, otherUserId } = useParams();
    const navigate = useNavigate();
    const { dbUser } = useAuth();
    const { supabase } = useSupabase();
    const game = useTruthDareGame(chatId, dbUser?.id, supabase);
    const peerCount = game.webrtc?.peers?.length || 0;

    const [modalConfig, setModalConfig] = useState({ isOpen: false });

    // --- Connection Status Toasts ---
    useEffect(() => {
        if (peerCount > 0) {
            toast.success("⚔️ Opponent Connected!", { id: 'arena-connect', duration: 3000 });
        }
    }, [peerCount]);

    // Global invitations for this Arena room
    const [invitations, setInvitations] = useState([]);
    const [loadingInvites, setLoadingInvites] = useState(true);
    
    useEffect(() => {
        if (!chatId) return;
        
        const loadInvitations = async () => {
            setLoadingInvites(true);
            try {
                const { data } = await supabase
                    .from(DB_TABLES.GAME_INVITATIONS)
                    .select(`
                        *,
                        sender:${DB_TABLES.USERS}!sender_id (id, name, avatar),
                        receiver:${DB_TABLES.USERS}!receiver_id (id, name, avatar)
                    `)
                    .eq('chat_id', chatId)
                    .in('status', ['pending', 'accepted'])
                    .order('created_at', { ascending: false });
                
                setInvitations(data || []);
            } finally {
                setLoadingInvites(false);
            }
        };

        loadInvitations();

        // Subscribe to any changes in invitations for this chat
        const channel = supabase
            .channel(`arena_invites_${chatId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: DB_TABLES.GAME_INVITATIONS,
                filter: `chat_id=eq.${chatId}`
            }, () => {
                console.log("🔔 Realtime Invitation Update!");
                loadInvitations();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [chatId, supabase]);

    // --- Auto-Join Logic (Root Fix: Sync) ---
    useEffect(() => {
        if (!game.isActive && invitations.length > 0) {
            // Find any accepted game we are part of
            const acceptedInv = invitations.find(inv => 
                inv.status === 'accepted' && 
                (inv.sender_id === dbUser?.id || inv.receiver_id === dbUser?.id)
            );

            if (acceptedInv) {
                console.log("🎮 Accepted game found, auto-joining battle...", acceptedInv.id);
                const amIHost = acceptedInv.sender_id === dbUser?.id;
                game.joinBattle(acceptedInv.id, amIHost);
            }
        }
    }, [invitations, game.isActive, dbUser?.id]);

    // --- Sync Logic: If current game disappears or was rejected (auto-exit) ---
    useEffect(() => {
        if (game.isActive && game.gameState.gameId && !loadingInvites) {
            // If we are in a pre-battle stage, we must be part of an 'active' invitation in the list
            const preBattleStages = [GAME_STATES.INVITING, GAME_STATES.JOINING, GAME_STATES.SETUP];
            if (preBattleStages.includes(game.gameState.stage)) {
                const stillActiveInList = invitations.some(inv => inv.id === game.gameState.gameId);
                
                if (!stillActiveInList) {
                    console.log("♻️ Connection broken or invitation no longer valid, returning to lobby...");
                    game.closeGame();
                }
            }
        }
    }, [invitations, game.isActive, game.gameState.gameId, game.gameState.stage, loadingInvites]);

    // Single source of truth: view is derived from game activities
    const view = game.isActive ? 'game' : 'lobby';

    const handleBack = () => {
        if (game.isActive) {
            setModalConfig({
                isOpen: true,
                title: "Abandon Battle?",
                message: "Are you sure you want to return to the lobby? Your current progress will be lost.",
                confirmText: "Abandon",
                type: 'warning',
                onConfirm: async () => {
                    await game.closeGame();
                    setModalConfig({ isOpen: false });
                }
            });
        } else {
            navigate(-1);
        }
    };

    const handleExit = () => {
        setModalConfig({
            isOpen: true,
            title: "Exit Arena?",
            message: "This will disconnect your P2P session and return you to the previous page.",
            confirmText: "Exit Arena",
            type: 'danger',
            onConfirm: async () => {
                if (game.isActive) {
                    await game.closeGame();
                }
                navigate(-1);
            }
        });
    };

    const pendingInvitesForMe = invitations.filter(inv => inv.status === 'pending' && dbUser?.id === inv.receiver_id);

    const gameProps = {
        ...game.gameState,
        userId: dbUser?.id,
        partnerId: otherUserId,
        onPick: game.pickType,
        onSend: game.sendChallenge,
        onComplete: game.completeTurn,
        onStart: () => game.startGame(otherUserId),
        onAccept: () => {
            const pending = invitations.filter(inv => inv.status === 'pending' && dbUser?.id === inv.receiver_id);
            if (pending.length > 0) {
                console.log("🎮 Accepting invitation:", pending[0].id);
                game.acceptGame(pending[0]);
            } else {
                console.warn("⚠️ No pending invitation found to accept");
            }
        },
        onReject: () => {
            const pending = invitations.filter(inv => inv.status === 'pending' && dbUser?.id === inv.receiver_id);
            if (pending.length > 0) {
                console.log("🎮 Rejecting invitation:", pending[0].id);
                game.rejectGame(pending[0]);
            } else {
                console.warn("⚠️ No pending invitation found to reject");
                game.closeGame();
            }
        },
        onJoin: game.joinBattle,
        onSkip: game.skipTurn,
        onSwitch: game.switchType,
        onConfirmSettings: game.confirmSettings,
        isHost: game.gameState.isHost,
        isMyTurn: game.isMyTurn
    };

    return (
        <div className={styles['arena-page-container']}>
            <nav className={styles['arena-navbar']}>
                <button onClick={handleBack} className={styles['back-btn']}>
                    <ArrowLeft size={20} />
                    <span>Lobby</span>
                </button>

                <div className={styles['arena-logo']}>
                    <div className={styles['logo-icon']}><Gamepad2 size={24} className="text-white" /></div>
                    <div className={styles['logo-text']}>
                        <h1>BATTLE ARENA</h1>
                        <span>Live Battle</span>
                    </div>
                </div>

                <button onClick={handleExit} className={styles['exit-btn']} title="Exit Arena">
                    <LogOut size={20} />
                    <span className={styles['exit-text']}>Exit</span>
                </button>
            </nav>

            {/* ⚔️ ROOT LEVEL INVITATION BANNER (HIGH VISIBILITY) */}
            {pendingInvitesForMe.length > 0 && (
                <div style={{ 
                    position: 'relative', 
                    zIndex: 10001, 
                    padding: '10px 16px',
                    background: 'rgba(236, 72, 153, 0.12)',
                    borderBottom: '1px solid rgba(236,72,153,0.3)',
                    backdropFilter: 'blur(12px)',
                    width: '100%',
                    boxSizing: 'border-box'
                }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        gap: '12px',
                        maxWidth: '1200px',
                        margin: '0 auto'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <div className="relative" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                                <div style={{ 
                                    width: '40px', 
                                    height: '40px', 
                                    borderRadius: '50%', 
                                    overflow: 'hidden', 
                                    border: '2px solid #ec4899',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#1a1a1a'
                                }}>
                                    <PlayerAvatar avatar={pendingInvitesForMe[0].sender?.avatar} name={pendingInvitesForMe[0].sender?.name} size={30} />
                                </div>
                                <div style={{ 
                                    position: 'absolute', 
                                    top: '-1px', 
                                    right: '-1px', 
                                    background: '#ec4899', 
                                    borderRadius: '50%', 
                                    width: '10px', 
                                    height: '10px',
                                    border: '1.5px solid #000'
                                }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h4 style={{ color: '#ec4899', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px', margin: 0, letterSpacing: '0.05em' }}>
                                    <Sparkles size={11} /> NEW CHALLENGE
                                </h4>
                                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: '700', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {pendingInvitesForMe[0].sender?.name} is ready!
                                </p>
                            </div>
                        </div>
                        <button 
                            className={styles['join-battle-btn']} 
                            onClick={() => game.acceptGame(pendingInvitesForMe[0])}
                            style={{ 
                                padding: '8px 20px', 
                                fontSize: '11px', 
                                background: '#ec4899', 
                                border: 'none', 
                                borderRadius: '8px', 
                                color: 'white', 
                                fontWeight: '900',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                boxShadow: '0 0 15px rgba(236, 72, 153, 0.4)'
                            }}
                        >
                            JOIN BATTLE ⚔️
                        </button>
                    </div>
                </div>
            )}

            <main className={styles['arena-main']} style={{ flex: 1, position: 'relative', marginTop: 0 }}>
                {view === 'lobby' ? (
                    <GameLobby 
                        chatId={chatId}
                        otherUserId={otherUserId}
                        invitations={invitations}
                        loading={loadingInvites}
                        onStartTruthDare={() => game.startGame(otherUserId)}
                        onResumeGame={(inv) => game.joinBattle(inv.id, inv.sender_id === dbUser?.id)}
                        onAcceptGame={(inv) => game.acceptGame(inv)}
                        onRejectGame={(inv) => game.rejectGame(inv)}
                    />
                ) : (
                    <ArenaRoom 
                        chatId={chatId}
                        userId={dbUser?.id}
                        userName={dbUser?.name}
                        gameProps={gameProps}
                        webrtcProps={game.webrtc}
                    />
                )}
            </main>

            <GameModal 
                {...modalConfig} 
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} 
            />

            <div className={styles['deco-glow-top']} />
            <div className={styles['deco-glow-bottom']} />
        </div>
    );
};

export default ArenaPage;
