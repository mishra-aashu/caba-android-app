import React, { useState } from 'react';
import { Check, Send, Gamepad2, Flame, Sparkles, Zap, ShieldAlert, User, Swords } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
            <div className="td-container">
                <div className="logo-icon" style={{ width: '80px', height: '80px', borderRadius: '2rem', marginBottom: '2rem' }}>
                    <Flame size={48} className="text-white" />
                </div>

                <div className="td-header">
                    <h2 className="td-title">TRUTH OR DARE</h2>
                    <p className="td-subtitle">Reveal your deepest secrets or face the ultimate challenge.</p>
                </div>

                <button
                    onClick={onStart}
                    className="launch-btn"
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
                <div className="td-container inviting-view">
                    <div className="inviting-status">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="pulse-icon"
                        >
                            <Gamepad2 size={48} className="text-pink-500" />
                        </motion.div>
                        <h2 className="td-title gradient-text">Waiting for Opponent...</h2>
                        <p className="td-subtitle">They've been challenged. Are they brave enough?</p>
                        <div className="loading-dots">
                            <span>.</span><span>.</span><span>.</span>
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="td-container inviting-view">
                    <div className="inviting-status">
                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="pulse-icon glow-pink"
                        >
                            <Swords size={64} className="text-pink-500" />
                        </motion.div>
                        <h2 className="td-title gradient-text">Challenge Received!</h2>
                        <p className="td-subtitle">You've been invited to a Battle of Truth and Dare</p>

                        <div className="arena-invitation-actions">
                            <button className="game-accept-btn arena-btn" onClick={onAccept}>
                                ACCEPT BATTLE
                            </button>
                            <button className="game-reject-btn arena-btn" onClick={onReject}>
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
            <div className="td-container inviting-view">
                <div className="inviting-status">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="pulse-icon glow-pink"
                    >
                        <Zap size={64} className="text-yellow-400 fill-yellow-400" />
                    </motion.div>
                    <h2 className="td-title gradient-text">Accepted! 🔥</h2>
                    <p className="td-subtitle">Your opponent is ready. Ready to enter the arena?</p>

                    <div className="arena-invitation-actions">
                        <button className="game-accept-btn arena-btn" onClick={onJoin}>
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
            <div className="td-container">
                <div className="td-header">
                    <h2 className="td-title gradient-text">WHO GOES FIRST?</h2>
                    <p className="td-subtitle">Destiny is choosing...</p>
                </div>

                <div className="spinner-arena">
                    <div className="players-row">
                        <div className={`player-marker ${gameState.winnerId === userId ? 'winner' : ''}`}>
                            <div className="player-avatar">
                                <User size={40} />
                            </div>
                            <span>ME</span>
                        </div>

                        <div className="spinner-container">
                            <motion.div
                                className="circular-indicator"
                                animate={{
                                    rotate: gameState.winnerId ? (gameState.winnerId === userId ? 1800 : 1980) : 0
                                }}
                                transition={{
                                    duration: 3.5,
                                    ease: [0.45, 0.05, 0.55, 0.95]
                                }}
                            >
                                <div className="spinner-needle"></div>
                            </motion.div>
                            <div className="spinner-center">
                                <Sparkles size={24} className="text-pink-500" />
                            </div>
                        </div>

                        <div className={`player-marker ${gameState.winnerId && gameState.winnerId !== userId ? 'winner' : ''}`}>
                            <div className="player-avatar">
                                <User size={40} />
                            </div>
                            <span>OPPONENT</span>
                        </div>
                    </div>
                </div>

                {isHost && !gameState.winnerId && (
                    <button className="launch-btn" onClick={onSpin}>
                        SPIN DESTINY
                    </button>
                )}

                {gameState.winnerId && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 3.8 }}
                        className="winner-announcement"
                    >
                        <h3 className="gradient-text">{winnerName} CHOOSE FIRST!</h3>
                    </motion.div>
                )}
            </div>
        );
    }

    if (stage === 'picking') {
        return (
            <div className="td-container">
                <div className="td-header">
                    <h2 className="td-title" style={{ fontSize: '2rem' }}>
                        {isAsker ? "YOUR FATE! 🔥" : "DESTINY AWAITS..."}
                    </h2>
                    <p className="td-subtitle">
                        {isAsker ? "Choose your weapon" : "Partner is deciding your path"}
                    </p>
                </div>

                {isAsker ? (
                    <div className="td-choices">
                        <button
                            onClick={() => onPick('truth')}
                            className="td-btn truth"
                        >
                            TRUTH
                        </button>

                        <button
                            onClick={() => onPick('dare')}
                            className="td-btn dare"
                        >
                            DARE
                        </button>
                    </div>
                ) : (
                    <div className="td-waiting">
                        <div className="loading-dots" style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                            <div className="dot" style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ec4899' }}></div>
                            <div className="dot" style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#8b5cf6' }}></div>
                            <div className="dot" style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#06b6d4' }}></div>
                        </div>
                        <p className="td-subtitle">Waiting for the choice of legends...</p>
                    </div>
                )}
            </div>
        );
    }

    if (stage === 'writing') {
        return (
            <div className="td-container">
                <div className="td-header">
                    <h2 className="td-title" style={{ fontSize: '2rem' }}>
                        {isAsker ? `SET THE ${gameState.type.toUpperCase()}` : `CHALLENGE CREATION`}
                    </h2>
                    <p className="td-subtitle">
                        {isAsker ? "Make it juicy" : "Partner is crafting your fate"}
                    </p>
                </div>

                {isAsker ? (
                    <div className="td-writing-field" style={{ width: '100%', maxWidth: '450px' }}>
                        <div className="td-input-card">
                            <textarea
                                value={challengeText}
                                onChange={(e) => setChallengeText(e.target.value)}
                                placeholder={gameState.type === 'truth' ? "Ask a risky question..." : "Give them a wild task..."}
                                className="td-textarea"
                            />
                        </div>

                        <button
                            onClick={handleSendChallenge}
                            disabled={!challengeText.trim()}
                            className="launch-btn"
                        >
                            <Send size={18} />
                            LAUNCH CHALLENGE
                        </button>
                    </div>
                ) : (
                    <div className="td-loading">
                        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#ec4899', borderRadius: '50%', marginBottom: '1rem', animation: 'activeTurnPulse 1s linear infinite' }} />
                        <p className="td-subtitle">Thinking of something wild...</p>
                    </div>
                )}
            </div>
        );
    }

    if (stage === 'performing') {
        return (
            <div className="td-container">
                <div className="td-header">
                    <h2 className="td-title" style={{ fontSize: '2rem' }}>
                        {isPerformer ? 'ACTION TIME! 🎯' : "IN PROGRESS"}
                    </h2>
                    <p className="td-subtitle">
                        {isPerformer ? "Show them what you're made of" : "They are executing the task"}
                    </p>
                </div>

                <div className="td-challenge-display">
                    <p>{gameState.content}</p>
                </div>

                {isPerformer ? (
                    <button
                        onClick={onComplete}
                        className="launch-btn"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)' }}
                    >
                        <Check size={20} />
                        MISSION COMPLETE
                    </button>
                ) : (
                    <div className="td-status-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="status-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ec4899', animation: 'activeTurnPulse 1s infinite' }} />
                        <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Performance</span>
                    </div>
                )
                }
            </div >
        );
    }

    return null;
};

export default TruthDareGame;
