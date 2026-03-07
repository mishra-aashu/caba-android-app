import React, { useState } from 'react';
import { Check, Send, Gamepad2, Flame, Sparkles, Zap, ShieldAlert, User, Swords } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './GameRoom.module.css';

const TruthDareGame = ({
    gameState,
    userId,
    partnerId,
    onPick,
    onSend,
    onComplete,
    onStart,
    onAccept,
    onReject,
    onJoin,
    onSpin,
    isHost,
    isEmbedded = false
}) => {
    const [challengeText, setChallengeText] = useState('');
    const [isSpinning, setIsSpinning] = useState(false);

    const handleSendChallenge = () => {
        if (!challengeText.trim()) return;
        onSend(challengeText);
        setChallengeText('');
    };

    const stage = gameState?.stage || 'idle';
    const isAsker = gameState?.turn === userId;
    const isPerformer = !isAsker && stage !== 'idle';

    if (stage === 'idle') {
        return (
            <div className={styles['td-container']}>
                <div className={styles['logo-icon-large']}>
                    <Flame size={48} className={styles['text-white']} />
                </div>

                <div className={styles['td-header']}>
                    <h2 className={styles['td-title']}>TRUTH OR DARE</h2>
                    <p className={styles['td-subtitle']}>Reveal your deepest secrets or face the ultimate challenge.</p>
                </div>

                <button
                    onClick={onStart}
                    className={styles['launch-btn']}
                >
                    <Gamepad2 size={20} />
                    START BATTLE
                </button>
            </div>
        );
    }

    if (stage === 'inviting') {
        if (isHost) {
            return (
                <div className={`${styles['td-container']} ${styles['inviting-view']}`}>
                    <div className={styles['inviting-status']}>
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className={styles['pulse-icon']}
                        >
                            <Gamepad2 size={48} className={styles['text-pink-500']} />
                        </motion.div>
                        <h2 className={`${styles['td-title']} ${styles['gradient-text']}`}>Waiting for Opponent...</h2>
                        <p className={styles['td-subtitle']}>They've been challenged. Are they brave enough?</p>
                        <div className={styles['loading-dots']}>
                            <span>.</span><span>.</span><span>.</span>
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div className={`${styles['td-container']} ${styles['inviting-view']}`}>
                    <div className={styles['inviting-status']}>
                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className={`${styles['pulse-icon']} ${styles['glow-pink']}`}
                        >
                            <Swords size={64} className={styles['text-pink-500']} />
                        </motion.div>
                        <h2 className={`${styles['td-title']} ${styles['gradient-text']}`}>Challenge Received!</h2>
                        <p className={styles['td-subtitle']}>You've been invited to a Battle of Truth and Dare</p>

                        <div className={styles['arena-invitation-actions']}>
                            <button className={`${styles['accept-btn']} ${styles['arena-btn']}`} onClick={onAccept}>
                                ACCEPT BATTLE
                            </button>
                            <button className={`${styles['skip-btn']} ${styles['arena-btn']}`} onClick={onReject}>
                                DECLINE
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
    }

    if (stage === 'accepted') {
        return (
            <div className={`${styles['td-container']} ${styles['inviting-view']}`}>
                <div className={styles['inviting-status']}>
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`${styles['pulse-icon']} ${styles['glow-pink']}`}
                    >
                        <Zap size={64} className={`${styles['text-yellow-400']} ${styles['fill-yellow-400']}`} />
                    </motion.div>
                    <h2 className={`${styles['td-title']} ${styles['gradient-text']}`}>Accepted! 🔥</h2>
                    <p className={styles['td-subtitle']}>Your opponent is ready. Ready to enter the arena?</p>

                    <div className={styles['arena-invitation-actions']}>
                        <button className={`${styles['accept-btn']} ${styles['arena-btn']}`} onClick={onJoin}>
                            YES, LET'S GO!
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (stage === 'deciding_turn') {
        const isWinner = gameState.winnerId === userId;
        const winnerName = isWinner ? "YOU" : "PARTNER";

        return (
            <div className={styles['td-container']}>
                <div className={styles['td-header']}>
                    <h2 className={`${styles['td-title']} ${styles['gradient-text']}`}>WHO GOES FIRST?</h2>
                    <p className={styles['td-subtitle']}>Destiny is choosing...</p>
                </div>

                <div className={styles['spinner-arena']}>
                    <div className={styles['players-row']}>
                        <div className={`${styles['player-marker']} ${gameState.winnerId === userId ? styles.winner : ''}`}>
                            <div className={styles['player-avatar']}>
                                <User size={40} />
                            </div>
                            <span>ME</span>
                        </div>

                        <div className={styles['spinner-container']}>
                            <motion.div
                                className={styles['circular-indicator']}
                                animate={{
                                    rotate: gameState.winnerId ? (gameState.winnerId === userId ? 1800 : 1980) : 0
                                }}
                                transition={{
                                    duration: 3.5,
                                    ease: [0.45, 0.05, 0.55, 0.95]
                                }}
                            >
                                <div className={styles['spinner-needle']}></div>
                            </motion.div>
                            <div className={styles['spinner-center']}>
                                <Sparkles size={24} className={styles['text-pink-500']} />
                            </div>
                        </div>

                        <div className={`${styles['player-marker']} ${gameState.winnerId && gameState.winnerId !== userId ? styles.winner : ''}`}>
                            <div className={styles['player-avatar']}>
                                <User size={40} />
                            </div>
                            <span>OPPONENT</span>
                        </div>
                    </div>
                </div>

                {isHost && !gameState.winnerId && (
                    <button className={styles['launch-btn']} onClick={onSpin}>
                        SPIN DESTINY
                    </button>
                )}

                {gameState.winnerId && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 3.8 }}
                        className={styles['winner-announcement']}
                    >
                        <h3 className={styles['gradient-text']}>{winnerName} CHOOSE FIRST!</h3>
                    </motion.div>
                )}
            </div>
        );
    }

    if (stage === 'picking') {
        return (
            <div className={styles['td-container']}>
                <div className={styles['td-header']}>
                    <h2 className={`${styles['td-title']} ${styles['td-title-large']}`}>
                        {isAsker ? "YOUR FATE! 🔥" : "DESTINY AWAITS..."}
                    </h2>
                    <p className={styles['td-subtitle']}>
                        {isAsker ? "Choose your weapon" : "Partner is deciding your path"}
                    </p>
                </div>

                {isAsker ? (
                    <div className={styles['td-choices']}>
                        <button
                            onClick={() => onPick('truth')}
                            className={`${styles['td-btn']} ${styles.truth}`}
                        >
                            TRUTH
                        </button>

                        <button
                            onClick={() => onPick('dare')}
                            className={`${styles['td-btn']} ${styles.dare}`}
                        >
                            DARE
                        </button>
                    </div>
                ) : (
                    <div className={styles['td-waiting']}>
                        <div className={styles['loading-dots']}>
                            <div className={styles.dot}></div>
                            <div className={styles.dot}></div>
                            <div className={styles.dot}></div>
                        </div>
                        <p className={styles['td-subtitle']}>Waiting for the choice of legends...</p>
                    </div>
                )}
            </div>
        );
    }

    if (stage === 'writing') {
        return (
            <div className={styles['td-container']}>
                <div className={styles['td-header']}>
                    <h2 className={`${styles['td-title']} ${styles['td-title-large']}`}>
                        {isAsker ? `SET THE ${gameState.type.toUpperCase()}` : `CHALLENGE CREATION`}
                    </h2>
                    <p className={styles['td-subtitle']}>
                        {isAsker ? "Make it juicy" : "Partner is crafting your fate"}
                    </p>
                </div>

                {isAsker ? (
                    <div className={styles['td-writing-field']}>
                        <div className={styles['td-input-card']}>
                            <textarea
                                value={challengeText}
                                onChange={(e) => setChallengeText(e.target.value)}
                                placeholder={gameState.type === 'truth' ? "Ask a risky question..." : "Give them a wild task..."}
                                className={styles['td-textarea']}
                            />
                        </div>

                        <button
                            onClick={handleSendChallenge}
                            disabled={!challengeText.trim()}
                            className={styles['launch-btn']}
                        >
                            <Send size={18} />
                            LAUNCH CHALLENGE
                        </button>
                    </div>
                ) : (
                    <div className={styles['td-loading']}>
                        <div className={styles['td-spinner-large']} />
                        <p className={styles['td-subtitle']}>Thinking of something wild...</p>
                    </div>
                )}
            </div>
        );
    }

    if (stage === 'performing') {
        return (
            <div className={styles['td-container']}>
                <div className={styles['td-header']}>
                    <h2 className={`${styles['td-title']} ${styles['td-title-large']}`}>
                        {isPerformer ? 'ACTION TIME! 🎯' : "IN PROGRESS"}
                    </h2>
                    <p className={styles['td-subtitle']}>
                        {isPerformer ? "Show them what you're made of" : "They are executing the task"}
                    </p>
                </div>

                <div className={styles['td-challenge-display']}>
                    <p>{gameState.content}</p>
                </div>

                {isPerformer ? (
                    <button
                        onClick={onComplete}
                        className={`${styles['launch-btn']} ${styles['mission-complete-btn']}`}
                    >
                        <Check size={20} />
                        MISSION COMPLETE
                    </button>
                ) : (
                    <div className={styles['td-status-badge']}>
                        <div className={styles['status-dot']} />
                        <span>Live Performance</span>
                    </div>
                )
                }
            </div >
        );
    }

    return null;
};

export default TruthDareGame;
