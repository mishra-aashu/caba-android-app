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
                        <Sparkles size={64} className="text-pink-500 mb-6" />
                        <h2 className={styles['td-title']}>BATTLE INVITATION!</h2>
                        <p className={styles['td-subtitle']}>Join for a session of truth and dares.</p>
                        <div className={styles['arena-invitation-actions']}>
                            <button className={styles['accept-btn']} onClick={() => {
                                console.log("✅ ACCEPT clicked");
                                onAccept();
                            }}>ACCEPT</button>
                            <button className={styles['skip-btn']} onClick={() => {
                                console.log("❌ DECLINE clicked");
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
                    <Swords size={64} style={{ color: '#ec4899' }} />
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
            <div className="w-full space-y-4">
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
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
                <h3 className="text-[#ec4899] font-black text-sm uppercase mb-2">Round {round} of {maxRounds}</h3>
                <h2 className="text-white font-black text-4xl uppercase mb-6 italic">{isMyTurn ? "IT'S YOUR TURN!" : "THEIR TURN!"}</h2>
                <PlayerAvatar avatar={players[isMyTurn ? userId : partnerId]?.avatar} name={isMyTurn ? "You" : "Opponent"} size={100} />
            </motion.div>
        </div>
    );

    const renderChoosing = () => (
        <div className={styles['td-container']}>
            <h2 className={styles['td-title']}>{isMyTurn ? "PICK YOUR POISON" : "WAITING FOR CHOICE..."}</h2>
            {isMyTurn ? (
                <div className={styles['choice-grid']}>
                    <button onClick={() => onPick('truth')} className={`${styles['choice-card']} ${styles['truth']}`}><AlertCircle size={40} /><span>TRUTH</span></button>
                    <button onClick={() => onPick('dare')} className={`${styles['choice-card']} ${styles['dare']}`}><Flame size={40} /><span>DARE</span></button>
                </div>
            ) : <div className="animate-pulse">Opponent is deciding...</div>}
        </div>
    );

    const renderChallenge = () => (
        <div className={styles['td-container']}>
            <h2 className={styles['td-title']}>SET THE {type?.toUpperCase()}</h2>
            {isMyTurn ? (
                <div className="w-full space-y-4">
                    <textarea value={challengeText} onChange={(e) => setChallengeText(e.target.value)} className={styles['td-textarea']} placeholder="Type your challenge..." />
                    <div className="flex justify-between w-full">
                        <button onClick={() => setChallengeText((type === 'truth' ? TRUTHS : DARES)[localMode][Math.floor(Math.random() * 10)])} className="text-xs text-white/40"><Sparkles size={12} /> Suggestion</button>
                        <button onClick={handleSendChallenge} className={styles['launch-btn']} disabled={!challengeText.trim()}>SEND CHALLENGE</button>
                    </div>
                </div>
            ) : <div className="animate-pulse">Crafting your fate...</div>}
        </div>
    );

    const renderResponding = () => (
        <div className={styles['td-container']}>
            <div className={styles['challenge-box']}><p className={styles['challenge-text']}>{content}</p></div>
            {!isMyTurn ? (
                <div className="grid grid-cols-3 gap-2 w-full">
                    <button onClick={onComplete} className={styles['launch-btn']}><Check /> DONE</button>
                    <button onClick={onSwitch} className={styles['setup-btn']}><RotateCcw /> SWITCH</button>
                    <button onClick={onSkip} className={styles['setup-btn']}><X /> SKIP</button>
                </div>
            ) : <div className="text-white/40">Waiting for completion...</div>}
        </div>
    );

    const renderResult = () => (
        <div className={styles['td-container']}>
            <Zap size={64} className="text-yellow-400 mb-4" />
            <h2 className="text-3xl font-black mb-4 uppercase">POINT EARNED!</h2>
            <div className={styles['score-stats']}>
                <div><p>YOU</p><p>{players[userId]?.points || 0}</p></div>
                <div><p>THEM</p><p>{players[partnerId]?.points || 0}</p></div>
            </div>
        </div>
    );

    const renderGameOver = () => (
        <div className={styles['td-container']}>
            <Trophy size={64} className="text-[#fbbf24] mb-4" />
            <h2 className="text-4xl font-black italic">BATTLE OVER</h2>
            <button onClick={onStart} className={styles['launch-btn']}>REMATCH</button>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col justify-center items-center">
            <AnimatePresence mode="wait">
                <motion.div 
                    key={stage} 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full flex flex-col justify-center items-center"
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
