import React, { useState, useEffect } from 'react';
import { 
  Check, Send, Gamepad2, Flame, Sparkles, Zap, 
  ShieldAlert, User, Swords, Timer, Trophy, 
  RotateCcw, X, ChevronRight, Award, Hash,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PlayerAvatar from '../common/PlayerAvatar';
import styles from './GameLobby.module.css';
import { TRUTHS, DARES, GAME_MODES } from '../../constants/gameData';
import { GAME_STATES } from '../../hooks/useTruthDareGame';

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
    onSkip,
    onSwitch,
    onConfirmSettings,
    isHost,
    isEmbedded = false
}) => {
    const [challengeText, setChallengeText] = useState('');
    const [selectedMode, setSelectedMode] = useState(GAME_MODES.CLASSIC);
    const [rounds, setRounds] = useState(5);
    
    // Determine roles
    const currentStage = gameState?.stage || GAME_STATES.IDLE;
    const isMyTurn = gameState?.turn === userId;
    const isPerformer = !isMyTurn && (currentStage === GAME_STATES.TURN_RESPONDING || currentStage === GAME_STATES.TURN_CHALLENGE);

    const handleSendChallenge = () => {
        if (!challengeText.trim()) return;
        onSend(challengeText);
        setChallengeText('');
    };

    // --- Sub-renders for each stage ---

    const renderIdle = () => (
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className={styles['td-container']}
        >
            <div className={styles['logo-icon-large']}>
                <Flame size={48} className={styles['text-white']} />
            </div>
            <div className={styles['td-header']}>
                <h2 className={styles['td-title']}>TRUTH OR DARE</h2>
                <p className={styles['td-subtitle']}>The ultimate battle of secrets and courage.</p>
            </div>
            <button onClick={onStart} className={styles['launch-btn']}>
                <Gamepad2 size={20} />
                START BATTLE
            </button>
        </motion.div>
    );

    const renderInviting = () => (
        <div className={`${styles['td-container']} ${styles['inviting-view']}`}>
            <div className={styles['inviting-status']}>
                {isHost ? (
                    <>
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className={styles['pulse-icon']}
                        >
                            <Swords size={64} className={styles['text-pink-500']} />
                        </motion.div>
                        <h2 className={`${styles['td-title']} ${styles['gradient-text']}`}>Waiting for Opponent...</h2>
                        <p className={styles['td-subtitle']}>They've been challenged. Will they accept?</p>
                    </>
                ) : (
                    <>
                        <motion.div 
                            initial={{ y: -20, opacity: 0 }} 
                            animate={{ y: 0, opacity: 1 }}
                            className={styles['pulse-icon']}
                        >
                            <Sparkles size={64} className={styles['text-pink-500']} />
                        </motion.div>
                        <h2 className={`${styles['td-title']} ${styles['gradient-text']}`}>Battle Invitation!</h2>
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

    const renderAccepted = () => (
        <div className={styles['td-container']}>
            <div className={styles['inviting-status']}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className={styles['pulse-icon']}>
                    <Zap size={64} className="text-yellow-400 fill-yellow-400" />
                </motion.div>
                <h2 className={`${styles['td-title']} ${styles['gradient-text']}`}>Battle Accepted!</h2>
                <p className={styles['td-subtitle']}>Enter the arena to begin.</p>
                <button className={styles['accept-btn']} onClick={onJoin}>ENTER ARENA</button>
            </div>
        </div>
    );

    const renderSetup = () => (
        <div className={styles['td-container']}>
            <div className={styles['td-header']}>
                <h2 className={styles['td-title']}>GAME SETTINGS</h2>
                <p className={styles['td-subtitle']}>Customize your battle arena</p>
            </div>
            
            <div className="w-full space-y-6">
                <div>
                   <label className="text-[10px] uppercase tracking-widest text-[#ec4899] font-bold mb-3 block">Game Mode</label>
                   <div className={styles['setup-options']}>
                       {Object.values(GAME_MODES).map(mode => (
                           <button 
                                key={mode}
                                onClick={() => setSelectedMode(mode)}
                                className={`${styles['setup-btn']} ${selectedMode === mode ? styles['active'] : ''}`}
                           >
                               {mode}
                           </button>
                       ))}
                   </div>
                </div>

                <div>
                   <label className="text-[10px] uppercase tracking-widest text-[#ec4899] font-bold mb-3 block">Rounds</label>
                   <div className={styles['setup-options']}>
                       {[3, 5, 10].map(r => (
                           <button 
                                key={r}
                                onClick={() => setRounds(r)}
                                className={`${styles['setup-btn']} ${rounds === r ? styles['active'] : ''}`}
                           >
                               {r}
                           </button>
                       ))}
                   </div>
                </div>
            </div>

            <button 
                onClick={() => onConfirmSettings({ mode: selectedMode, maxRounds: rounds })}
                className={`${styles['launch-btn']} mt-8`}
                disabled={!isHost}
            >
                {isHost ? 'CONFIRM & START' : 'WAITING FOR HOST...'}
            </button>
        </div>
    );

    const renderAnnounce = () => (
        <div className={styles['td-container']}>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
            >
                <h3 className="text-[#ec4899] font-black text-sm uppercase tracking-widest mb-2">Round {gameState.round} of {gameState.maxRounds}</h3>
                <h2 className="text-white font-black text-4xl uppercase mb-6 italic">
                    {isMyTurn ? "IT'S YOUR TURN!" : "THEIR TURN!"}
                </h2>
                <div className="flex justify-center">
                    <PlayerAvatar 
                        avatar={isMyTurn ? gameState.localPlayer?.avatar : gameState.partnerPlayer?.avatar}
                        name={isMyTurn ? "You" : "Opponent"}
                        size={100}
                        className="p-1"
                        style={{ border: '4px solid #ec4899', borderRadius: '50%' }}
                    />
                </div>
            </motion.div>
        </div>
    );

    const renderChoosing = () => (
        <div className={styles['td-container']}>
            <div className={styles['td-header']}>
                <h2 className={`${styles['td-title']} ${styles['td-title-large']}`}>
                    {isMyTurn ? "PICK YOUR POISON" : "WAITING FOR CHOICE..."}
                </h2>
                <p className={styles['td-subtitle']}>
                    {isMyTurn ? "Which fate do you choose?" : "Partner is deciding..."}
                </p>
            </div>

            {isMyTurn ? (
                <div className={styles['choice-grid']}>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onPick('truth')}
                        className={`${styles['choice-card']} ${styles['truth']}`}
                    >
                        <AlertCircle size={40} className="text-[#3b82f6]" />
                        <span className={styles['choice-label']}>TRUTH</span>
                        <span className={styles['points-badge']} style={{ color: '#3b82f6' }}>+10 PTS</span>
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onPick('dare')}
                        className={`${styles['choice-card']} ${styles['dare']}`}
                    >
                        <Flame size={40} className="text-[#ec4899]" />
                        <span className={styles['choice-label']}>DARE</span>
                        <span className={styles['points-badge']} style={{ color: '#ec4899' }}>+15 PTS</span>
                    </motion.button>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4">
                    <div className={styles['loading-dots']}>
                        <span>.</span><span>.</span><span>.</span>
                    </div>
                </div>
            )}
        </div>
    );

    const renderChallenge = () => (
        <div className={styles['td-container']}>
            <div className={styles['td-header']}>
                <h2 className={`${styles['td-title']} italic`}>SET THE {gameState.type?.toUpperCase()}</h2>
                <p className={styles['td-subtitle']}>{isMyTurn ? "Type your request or use a suggestion" : "Opponent is typing..."}</p>
            </div>

            {isMyTurn ? (
                <div className="w-full space-y-4">
                    <div className={styles['td-input-card']}>
                        <textarea
                            value={challengeText}
                            onChange={(e) => setChallengeText(e.target.value)}
                            placeholder={`Ask something juicy for ${gameState.type}...`}
                            className={styles['td-textarea']}
                        />
                    </div>
                    <div className="flex justify-between items-center w-full max-w-[450px]">
                        <button 
                            onClick={() => {
                                const mode = gameState.mode || GAME_MODES.CLASSIC;
                                const pool = gameState.type === 'truth' ? TRUTHS[mode] : DARES[mode];
                                setChallengeText(pool[Math.floor(Math.random() * pool.length)]);
                            }}
                            className="bg-white/5 hover:bg-white/10 text-white/60 px-4 py-2 rounded-xl text-[10px] font-bold border border-white/10 flex items-center gap-2 uppercase transition-all"
                        >
                            <Sparkles size={14} /> Suggestion
                        </button>
                        <button 
                            onClick={handleSendChallenge}
                            disabled={!challengeText.trim()}
                            className={styles['launch-btn']}
                            style={{ height: '48px', width: 'auto', padding: '0 2rem' }}
                        >
                            SEND <Send size={16} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className={styles['td-waiting']}>
                   <Flame size={48} className="text-[#ec4899] animate-pulse mb-4" />
                   <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Crafting your fate...</p>
                </div>
            )}
        </div>
    );

    const renderResponding = () => {
        const typeColor = gameState.type === 'truth' ? '#3b82f6' : '#ec4899';
        return (
            <div className={styles['td-container']}>
                <div className="flex items-center gap-2 mb-8 bg-black/20 px-4 py-2 rounded-full border border-white/5">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: typeColor }} />
                    <span className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: typeColor }}>
                        {gameState.type} IN PROGRESS
                    </span>
                </div>

                <div className={styles['challenge-box']}>
                    <div className={styles['challenge-accent']} style={{ backgroundColor: typeColor }} />
                    <p className={styles['challenge-text']}>{gameState.content}</p>
                </div>

                {isMyTurn ? (
                   <div className="flex flex-col items-center gap-4">
                       <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Wait for them to complete</p>
                       <div className="animate-bounce">
                           <Flame size={24} className="text-pink-500/50" />
                       </div>
                   </div>
                ) : (
                    <div className="w-full max-w-[450px] grid grid-cols-3 gap-2">
                        <button 
                            onClick={onComplete}
                            className={`${styles['launch-btn']} ${styles['mission-complete-btn']}`}
                            style={{ height: '70px', borderRadius: '1.5rem' }}
                        >
                            <Check size={20} /> DONE
                        </button>
                        <button 
                            onClick={onSwitch}
                            className={styles['setup-btn']}
                            style={{ height: '70px', borderRadius: '1.5rem', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.2)' }}
                        >
                            <RotateCcw size={20} /> SWITCH
                        </button>
                        <button 
                            onClick={onSkip}
                            className={styles['setup-btn']}
                            style={{ height: '70px', borderRadius: '1.5rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        >
                            <X size={20} /> SKIP
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderResult = () => (
        <div className={styles['td-container']}>
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
            >
                <div className={styles['result-circle']}>
                    <Check size={40} className="text-white" />
                </div>
                <h2 className="text-3xl font-black text-white italic mb-2">TASK COMPLETED!</h2>
                <p className="text-[#ec4899] font-bold text-sm uppercase tracking-widest">Earned some points 🔥</p>
                
                <div className={styles['score-stats']}>
                   <div className={styles['stat-item']}>
                       <p className={styles['stat-label']}>ME</p>
                       <p className={styles['stat-value']}>{gameState.players[userId]?.points || 0}</p>
                   </div>
                   <div className={styles['stat-divider']} />
                   <div className={styles['stat-item']}>
                       <p className={styles['stat-label']}>OPPONENT</p>
                       <p className={styles['stat-value']}>{gameState.players[partnerId]?.points || 0}</p>
                   </div>
                </div>
            </motion.div>
        </div>
    );

    const renderGameOver = () => {
        const isWinner = gameState.winnerId === userId;
        const sortedPlayers = Object.entries(gameState.players).sort((a, b) => b[1].points - a[1].points);
        
        return (
            <div className={styles['td-container']}>
                <div className="text-center mb-8">
                    <Trophy size={64} className="text-[#fbbf24] mx-auto mb-4" />
                    <h2 className="text-white text-4xl font-black italic uppercase">BATTLE OVER</h2>
                    <p className="text-[#ec4899] font-bold text-xs uppercase tracking-[0.2em]">{isWinner ? "YOU ARE THE CHAMPION!" : "BETTER LUCK NEXT TIME!"}</p>
                </div>

                <div className={styles['leaderboard']}>
                    {sortedPlayers.map(([id, stats], index) => (
                        <div key={id} className={styles['leaderboard-item']}>
                            <div className="flex items-center gap-3">
                                <span className={`${styles['rank-text']} ${index === 0 ? styles['rank-first'] : styles['rank-other']}`}>#{index + 1}</span>
                                <PlayerAvatar avatar={id === userId ? gameState.localPlayer?.avatar : gameState.partnerPlayer?.avatar} name={stats.name} size={32} />
                                <span className="text-white font-bold text-sm">{id === userId ? 'YOU' : 'OPPONENT'}</span>
                            </div>
                            <span className={styles['score-text']}>{stats.points} <span className={styles['score-unit']}>PTS</span></span>
                        </div>
                    ))}
                </div>

                <button onClick={onStart} className={styles['launch-btn']}>
                    REMATCH
                </button>
            </div>
        );
    };

    // --- Main render switch ---

    return (
        <AnimatePresence mode="wait">
            <motion.div 
                key={currentStage}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full h-full min-h-[500px] flex flex-col justify-center items-center"
            >
                {currentStage === GAME_STATES.IDLE && renderIdle()}
                {currentStage === GAME_STATES.INVITING && renderInviting()}
                {currentStage === GAME_STATES.ACCEPTED && renderAccepted()}
                {currentStage === GAME_STATES.SETUP && renderSetup()}
                {currentStage === GAME_STATES.TURN_ANNOUNCE && renderAnnounce()}
                {currentStage === GAME_STATES.TURN_CHOOSING && renderChoosing()}
                {currentStage === GAME_STATES.TURN_CHALLENGE && renderChallenge()}
                {currentStage === GAME_STATES.TURN_RESPONDING && renderResponding()}
                {currentStage === GAME_STATES.TURN_RESULT && renderResult()}
                {currentStage === GAME_STATES.GAME_OVER && renderGameOver()}
            </motion.div>
        </AnimatePresence>
    );
};

export default TruthDareGame;
