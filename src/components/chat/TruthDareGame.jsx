import React, { useState, useEffect } from 'react';
import { 
  Check, Send, Gamepad2, Flame, Sparkles, Zap, 
  Swords, Trophy, RotateCcw, X, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PlayerAvatar from '../common/PlayerAvatar';
import styles from './TruthDareGame.module.css';
import { TRUTHS, DARES, GAME_MODES } from '../../constants/gameData';
import { GAME_STATES } from '../../hooks/useTruthDareGame';

const TruthDareGame = ({
    // Game State Props
    stage = GAME_STATES.IDLE,
    turn,
    type,
    content,
    round = 1,
    maxRounds = 5,
    mode = GAME_MODES.CLASSIC,
    players = {},
    winnerId,
    partnerId,
    askerId,
    targetId,
    // Action Props
    onPick,
    onSend,
    onComplete,
    onStart,
    onAccept,
    onReject,
    onJoin,
    onSkip,
    onSwitch,
    onConfirmSettings,
    updateSettingsDraft,
    onStartSpin,
    completeSpin,
    askTD,
    isHost,
    userId,
    ...props
}) => {
    const [challengeText, setChallengeText] = useState('');
    
    // Spinner state
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    
    // Sync local rotation with game state spinData
    useEffect(() => {
        if (props.spinData?.rotation && !isSpinning) {
            console.log('[TruthDareGame] Starting spin animation:', props.spinData.rotation);
            setIsSpinning(true);
            setRotation(props.spinData.rotation);
            
            // Auto-complete spin after animation duration
            const timer = setTimeout(() => {
                setIsSpinning(false);
                if (isHost) {
                    const firstAsker = props.spinData.whoStarts === 'me' ? userId : partnerId;
                    console.log('[TruthDareGame] Spin complete, calling completeSpin for:', firstAsker);
                    completeSpin(firstAsker);
                }
            }, 2800); // 2.5s animation + 300ms buffer
            
            return () => clearTimeout(timer);
        }
    }, [props.spinData?.rotation, isHost, userId, partnerId, completeSpin]);
    
    const isAsker = String(askerId) === String(userId);
    const isTarget = String(targetId) === String(userId);
    const isMyTurn = props.isMyTurn ?? (String(turn) === String(userId));
    
    const opponentId = partnerId;
    const me = players[userId] || { name: 'You', points: 0 };
    const opponent = players[opponentId] || { name: 'Opponent', points: 0 };
    
    const handleSendChallenge = () => {
        if (!challengeText.trim()) return;
        onSend(challengeText);
        setChallengeText('');
    };

    // --- Sub-renders for each stage ---

    const renderIdle = () => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles['td-container']}>
            <div className={styles['logo-icon-large']}><Flame size={48} /></div>
            <div className={styles['td-header']}>
                <h2 className={styles['td-title']}>TRUTH OR DARE</h2>
                <p className={styles['td-subtitle']}>The ultimate battle of secrets and courage.</p>
            </div>
            <button onClick={onStart} className={styles['launch-btn']}>
                <Gamepad2 size={20} /> START BATTLE
            </button>
        </motion.div>
    );

    const renderInviting = () => {
        const isActuallyInvited = !isHost && String(userId) === String(partnerId);

        return (
            <div className={styles['td-container']}>
                <div className={styles['inviting-status']}>
                    {!isActuallyInvited ? (
                        <>
                            <motion.div animate={{ scale: [1, 1.1, 1] }} className={styles['pulse-icon']}><Swords size={64} /></motion.div>
                            <h2 className={styles['td-title']}>WAITING FOR OPPONENT...</h2>
                            <p className={styles['td-subtitle']}>They've been challenged. Will they accept?</p>
                        </>
                    ) : (
                        <>
                            <Sparkles size={64} style={{ color: '#00a884', marginBottom: '24px' }} />
                            <h2 className={styles['td-title']}>BATTLE INVITATION!</h2>
                            <p className={styles['td-subtitle']}>Join for a session of truth and dares.</p>
                            <div className={styles['arena-invitation-actions']}>
                                <button className={styles['accept-btn']} onClick={onAccept}>ACCEPT</button>
                                <button className={styles['skip-btn']} onClick={onReject}>DECLINE</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderJoining = () => (
        <div className={styles['td-container']}>
            <div className={styles['inviting-status']}>
                <motion.div 
                    animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1] }} 
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className={styles['pulse-icon']}
                >
                    <Swords size={64} style={{ color: '#00a884' }} />
                </motion.div>
                <h2 className={styles['td-title']}>ENTERING ARENA...</h2>
                <p className={styles['td-subtitle']}>Synchronizing battle state with opponent.</p>
            </div>
        </div>
    );

    const renderSetup = () => {
        const handleUpdateMode = (m) => {
            if (!isHost) return;
            updateSettingsDraft({ mode: m });
        };

        const handleUpdateRounds = (r) => {
            if (!isHost) return;
            updateSettingsDraft({ maxRounds: r });
        };

        return (
            <div className={styles['td-container']}>
                <div className={styles['td-header']}>
                    <h2 className={styles['td-title']}>GAME SETTINGS</h2>
                    <p className={styles['td-subtitle']}>Customize your battle arena</p>
                </div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={styles['setup-options']}>
                        {Object.values(GAME_MODES).map(m => (
                            <button 
                                key={m} 
                                onClick={() => handleUpdateMode(m)} 
                                className={`${styles['setup-btn']} ${mode === m ? styles['active'] : ''}`}
                                disabled={!isHost}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <div className={styles['setup-options']}>
                        {[3, 5, 10].map(r => (
                            <button 
                                key={r} 
                                onClick={() => handleUpdateRounds(r)} 
                                className={`${styles['setup-btn']} ${maxRounds === r ? styles['active'] : ''}`}
                                disabled={!isHost}
                            >
                                {r} Rounds
                            </button>
                        ))}
                    </div>
                </div>
                <button 
                    onClick={() => onConfirmSettings({ mode, maxRounds })}
                    className={styles['launch-btn']}
                    disabled={!isHost}
                >
                    {isHost ? 'CONFIRM & START' : 'WAITING FOR HOST...'}
                </button>
                {!isHost && (
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '12px', fontStyle: 'italic' }}>
                        The host is adjusting the arena settings...
                    </p>
                )}
            </div>
        );
    };

    const renderInitialSpin = () => {
        const handleSpin = () => {
            if (isSpinning || !isHost) return;
            
            // Randomly pick who starts (0 = Me, 180 = Opponent)
            const whoStarts = Math.random() > 0.5 ? 'me' : 'opponent';
            const targetRotation = 360 * 5 + (whoStarts === 'me' ? 0 : 180);
            
            // Broadcast the spin to everyone
            onStartSpin({ 
                rotation: targetRotation, 
                whoStarts 
            });
        };

        const opponentFirstName = opponent.name?.split(' ')[0] || 'THEM';
        const topLabel = isHost ? "YOU" : opponentFirstName.toUpperCase();
        const bottomLabel = isHost ? opponentFirstName.toUpperCase() : "YOU";

        return (
            <div className={styles['td-container']}>
                <h2 className={styles['td-title']}>{isHost ? 'SPIN TO DECIDE WHO STARTS' : `${opponent.name.toUpperCase()} IS SPINNING...`}</h2>
                <div className={styles['spinner-outer']}>
                    <motion.div 
                        className={styles['spinner-ring']}
                        animate={{ rotate: rotation }}
                        transition={{ duration: 2.5, ease: "circOut" }}
                    >
                        <div className={`${styles['spinner-label']} ${styles['label-truth']}`}>{topLabel}</div>
                        <div className={`${styles['spinner-label']} ${styles['label-dare']}`}>{bottomLabel}</div>
                        <div className={styles['spinner-line']} />
                    </motion.div>
                    <div className={styles['spinner-pointer']} />
                    {isHost && !props.spinData && (
                        <button className={styles['spin-btn']} onClick={handleSpin}>
                            SPIN
                        </button>
                    )}
                </div>
                {!isHost && !props.spinData && (
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', animation: 'pulse 2s infinite' }}>
                        Waiting for {opponent.name} to spin...
                    </p>
                )}
            </div>
        );
    };

    const renderAnnounce = () => (
        <div className={styles['td-container']}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ textAlign: 'center' }}>
                <h3 style={{ color: '#00a884', fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Round {round} of {maxRounds}
                </h3>
                <h2 style={{ color: 'white', fontWeight: '900', fontSize: '36px', textTransform: 'uppercase', marginBottom: '24px', fontStyle: 'italic' }}>
                    {isAsker ? "YOUR TURN TO ASK!" : "GET READY..."}
                </h2>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <PlayerAvatar 
                        avatar={isAsker ? me.avatar : opponent.avatar} 
                        name={isAsker ? me.name : opponent.name} 
                        size={100} 
                    />
                    <div className={styles['turn-badge']}>ASKER</div>
                </div>
            </motion.div>
        </div>
    );

    const renderTurnAsks = () => (
        <div className={styles['td-container']}>
            <h2 className={styles['td-title']}>{isAsker ? 'TIME TO ASK' : 'WAITING FOR QUESTION...'}</h2>
            <div className={styles['ask-bubble']}>
                <p>"Truth or Dare?"</p>
            </div>
            {isAsker ? (
                <button onClick={askTD} className={styles['launch-btn']}>
                    ASK {opponent.name.toUpperCase()}
                </button>
            ) : (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>{opponent.name} is asking you...</p>
            )}
        </div>
    );

    const renderTurnChooses = () => (
        <div className={styles['td-container']}>
            <h2 className={styles['td-title']}>{isTarget ? 'CHOOSE YOUR PATH' : 'WAITING FOR CHOICE...'}</h2>
            <div className={styles['choice-grid']}>
                <button 
                    disabled={!isTarget}
                    onClick={() => onPick('truth')} 
                    className={`${styles['choice-card']} ${styles['truth']}`}
                >
                    <Flame size={32} />
                    <span>TRUTH</span>
                </button>
                <button 
                    disabled={!isTarget}
                    onClick={() => onPick('dare')} 
                    className={`${styles['choice-card']} ${styles['dare']}`}
                >
                    <Swords size={32} />
                    <span>DARE</span>
                </button>
            </div>
            {!isTarget && (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>{opponent.name} is choosing...</p>
            )}
        </div>
    );

    const renderChallenge = () => (
        <div className={styles['td-container']}>
            <h2 className={styles['td-title']}>SET THE {type?.toUpperCase()}</h2>
            <p className={styles['td-subtitle']} style={{ marginBottom: '20px' }}>
                {isAsker ? `Assign a ${type} to ${opponent.name}` : `${opponent.name} is assigning your ${type}`}
            </p>
            {isAsker ? (
                <div className={styles['challenge-input-group']}>
                    <textarea 
                        value={challengeText} 
                        onChange={(e) => setChallengeText(e.target.value)} 
                        className={styles['td-textarea']} 
                        placeholder={`Type the ${type} here...`} 
                    />
                    <div className={styles['challenge-actions']}>
                        <button 
                            onClick={() => setChallengeText((type === 'truth' ? TRUTHS : DARES)[mode][Math.floor(Math.random() * (type === 'truth' ? TRUTHS[mode].length : DARES[mode].length))])} 
                            className={styles['suggestion-btn']}
                        >
                            <Sparkles size={12} /> Suggestion
                        </button>
                        <button 
                            onClick={handleSendChallenge} 
                            className={styles['launch-btn']} 
                            disabled={!challengeText.trim()}
                        >
                            SEND
                        </button>
                    </div>
                </div>
            ) : (
                <div className={styles['inviting-status']}>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                        <RotateCcw size={32} style={{ color: '#00a884' }} />
                    </motion.div>
                </div>
            )}
        </div>
    );

    const renderResponding = () => (
        <div className={styles['td-container']}>
            <h2 className={styles['td-title']} style={{ color: type === 'truth' ? '#3b82f6' : '#ef4444' }}>
                {type?.toUpperCase()} TIME!
            </h2>
            <div className={styles['challenge-box']}>
                <p className={styles['challenge-text']}>{content}</p>
            </div>
            {isTarget ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                    <button onClick={onComplete} className={styles['launch-btn']}>
                        <Check size={16} /> I COMPLETED IT
                    </button>
                    <button onClick={onSkip} className={styles['skip-btn']} style={{ width: '100%', padding: '12px' }}>
                        <X size={16} /> I REFUSE (PENALTY)
                    </button>
                </div>
            ) : (
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Waiting for {opponent.name} to complete the {type}...</p>
            )}
        </div>
    );

    const renderResult = () => (
        <div className={styles['td-container']}>
            <Zap size={64} style={{ color: '#fbbf24', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '16px', textTransform: 'uppercase' }}>POINT EARNED!</h2>
            <div className={styles['score-stats']}>
                <div><p>{me.name?.toUpperCase() || 'YOU'}</p><p>{me.points || 0}</p></div>
                <div><p>{opponent.name?.toUpperCase() || 'THEM'}</p><p>{opponent.points || 0}</p></div>
            </div>
        </div>
    );

    const renderGameOver = () => (
        <div className={styles['td-container']}>
            <Trophy size={64} style={{ color: '#fbbf24', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '36px', fontWeight: '900', fontStyle: 'italic' }}>BATTLE OVER</h2>
            <div className={styles['score-stats']} style={{ marginBottom: '30px' }}>
                <div className={winnerId === userId ? styles['winner'] : ''}><p>{me.name}</p><p>{me.points}</p></div>
                <div className={winnerId === opponentId ? styles['winner'] : ''}><p>{opponent.name}</p><p>{opponent.points}</p></div>
            </div>
            <button onClick={onStart} className={styles['launch-btn']}>REMATCH</button>
        </div>
    );

    return (
        <div className={styles['game-root']}>
            <AnimatePresence mode="wait">
                <motion.div 
                    key={stage} 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                    className={styles['stage-wrapper']}
                >
                    {stage === GAME_STATES.INVITING && renderInviting()}
                    {stage === GAME_STATES.JOINING && renderJoining()}
                    {stage === GAME_STATES.SETUP && renderSetup()}
                    {stage === GAME_STATES.INITIAL_SPIN && renderInitialSpin()}
                    {stage === GAME_STATES.TURN_ANNOUNCE && renderAnnounce()}
                    {stage === GAME_STATES.TURN_ASKS && renderTurnAsks()}
                    {stage === GAME_STATES.TURN_CHOOSES && renderTurnChooses()}
                    {stage === GAME_STATES.TURN_CHALLENGE && renderChallenge()}
                    {stage === GAME_STATES.TURN_RESPONDING && renderResponding()}
                    {stage === GAME_STATES.TURN_RESULT && renderResult()}
                    {stage === GAME_STATES.GAME_OVER && renderGameOver()}
                    {stage === GAME_STATES.IDLE && renderIdle()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default TruthDareGame;
