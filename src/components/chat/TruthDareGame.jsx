import React, { useState } from 'react';
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
    isHost,
    userId
}) => {
    const [challengeText, setChallengeText] = useState('');
    const [localMode, setLocalMode] = useState(mode);
    const [localRounds, setLocalRounds] = useState(maxRounds);
    
    const isMyTurn = turn === userId;
    
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

    const renderInviting = () => (
        <div className={styles['td-container']}>
            <div className={styles['inviting-status']}>
                {isHost ? (
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
                            <button className={styles['accept-btn']} onClick={() => {
                                console.log('✅ ACCEPT clicked');
                                onAccept();
                            }}>ACCEPT</button>
                            <button className={styles['skip-btn']} onClick={() => {
                                console.log('❌ DECLINE clicked');
                                onReject();
                            }}>DECLINE</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    const renderJoining = () => (
        <div className={styles['td-container']}>
            <div className={styles['inviting-status']}>
                <motion.div 
                    animate={{ 
                        rotate: [0, -10, 10, -10, 10, 0],
                        scale: [1, 1.1, 1]
                    }} 
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

    const renderSetup = () => (
        <div className={styles['td-container']}>
            <div className={styles['td-header']}>
                <h2 className={styles['td-title']}>GAME SETTINGS</h2>
                <p className={styles['td-subtitle']}>Customize your battle arena</p>
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className={styles['setup-options']}>
                    {Object.values(GAME_MODES).map(m => (
                        <button key={m} onClick={() => setLocalMode(m)} className={`${styles['setup-btn']} ${localMode === m ? styles['active'] : ''}`}>{m}</button>
                    ))}
                </div>
                <div className={styles['setup-options']}>
                    {[3, 5, 10].map(r => (
                        <button key={r} onClick={() => setLocalRounds(r)} className={`${styles['setup-btn']} ${localRounds === r ? styles['active'] : ''}`}>{r} Rounds</button>
                    ))}
                </div>
            </div>
            <button 
                onClick={() => onConfirmSettings({ mode: localMode, maxRounds: localRounds })}
                className={styles['launch-btn']}
                disabled={!isHost}
            >
                {isHost ? 'CONFIRM & START' : 'WAITING FOR HOST...'}
            </button>
        </div>
    );

    const renderAnnounce = () => (
        <div className={styles['td-container']}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ textAlign: 'center' }}>
                <h3 style={{ color: '#00a884', fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Round {round} of {maxRounds}
                </h3>
                <h2 style={{ color: 'white', fontWeight: '900', fontSize: '36px', textTransform: 'uppercase', marginBottom: '24px', fontStyle: 'italic' }}>
                    {isMyTurn ? "IT'S YOUR TURN!" : "THEIR TURN!"}
                </h2>
                <PlayerAvatar avatar={null} name={isMyTurn ? 'You' : 'Opponent'} size={80} />
            </motion.div>
        </div>
    );

    const renderChoosing = () => (
        <div className={styles['td-container']}>
            <h2 className={styles['td-title']}>{isMyTurn ? 'PICK YOUR POISON' : 'WAITING FOR CHOICE...'}</h2>
            {isMyTurn ? (
                <div className={styles['choice-grid']}>
                    <button onClick={() => onPick('truth')} className={`${styles['choice-card']} ${styles['truth']}`}><AlertCircle size={40} /><span>TRUTH</span></button>
                    <button onClick={() => onPick('dare')} className={`${styles['choice-card']} ${styles['dare']}`}><Flame size={40} /><span>DARE</span></button>
                </div>
            ) : (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', animation: 'pulse 2s infinite' }}>
                    Opponent is deciding...
                </p>
            )}
        </div>
    );

    const renderChallenge = () => (
        <div className={styles['td-container']}>
            <h2 className={styles['td-title']}>SET THE {type?.toUpperCase()}</h2>
            {isMyTurn ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <textarea 
                        value={challengeText} 
                        onChange={(e) => setChallengeText(e.target.value)} 
                        className={styles['td-textarea']} 
                        placeholder="Type your challenge..." 
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <button 
                            onClick={() => setChallengeText((type === 'truth' ? TRUTHS : DARES)[localMode][Math.floor(Math.random() * 10)])} 
                            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <Sparkles size={12} /> Suggestion
                        </button>
                        <button 
                            onClick={handleSendChallenge} 
                            className={styles['launch-btn']} 
                            disabled={!challengeText.trim()}
                        >
                            SEND CHALLENGE
                        </button>
                    </div>
                </div>
            ) : (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Crafting your fate...</p>
            )}
        </div>
    );

    const renderResponding = () => (
        <div className={styles['td-container']}>
            <div className={styles['challenge-box']}><p className={styles['challenge-text']}>{content}</p></div>
            {!isMyTurn ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', width: '100%' }}>
                    <button onClick={onComplete} className={styles['launch-btn']}>
                        <Check size={16} /> DONE
                    </button>
                    <button onClick={onSwitch} className={styles['setup-btn']}>
                        <RotateCcw size={16} /> SWITCH
                    </button>
                    <button onClick={onSkip} className={styles['setup-btn']}>
                        <X size={16} /> SKIP
                    </button>
                </div>
            ) : (
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Waiting for completion...</p>
            )}
        </div>
    );

    const renderResult = () => (
        <div className={styles['td-container']}>
            <Zap size={64} style={{ color: '#fbbf24', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '16px', textTransform: 'uppercase' }}>POINT EARNED!</h2>
            <div className={styles['score-stats']}>
                <div><p>YOU</p><p>{players[userId]?.points || 0}</p></div>
                <div><p>THEM</p><p>{players[partnerId]?.points || 0}</p></div>
            </div>
        </div>
    );

    const renderGameOver = () => (
        <div className={styles['td-container']}>
            <Trophy size={64} style={{ color: '#fbbf24', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '36px', fontWeight: '900', fontStyle: 'italic' }}>BATTLE OVER</h2>
            <button onClick={onStart} className={styles['launch-btn']}>REMATCH</button>
        </div>
    );

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <AnimatePresence mode="wait">
                <motion.div 
                    key={stage} 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
                >
                    {stage === GAME_STATES.INVITING && renderInviting()}
                    {stage === GAME_STATES.JOINING && renderJoining()}
                    {stage === GAME_STATES.SETUP && renderSetup()}
                    {stage === GAME_STATES.TURN_ANNOUNCE && renderAnnounce()}
                    {stage === GAME_STATES.TURN_CHOOSING && renderChoosing()}
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
