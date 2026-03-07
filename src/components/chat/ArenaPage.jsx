import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTruthDareGame } from '../../hooks/useTruthDareGame';
import GameRoom from './GameRoom';
import TruthDareGame from './TruthDareGame';
import { ArrowLeft, Gamepad2 } from 'lucide-react';
import styles from './GameRoom.module.css';

const ArenaPage = () => {
    const { chatId, otherUserId } = useParams();
    const navigate = useNavigate();
    const { dbUser } = useAuth();

    const [view, setView] = React.useState('lobby'); // 'lobby' or 'game'

    const {
        gameState,
        startGame,
        pickType,
        sendChallenge,
        completeTurn,
        closeGame,
        acceptGame,
        rejectGame,
        joinBattle,
        startSpin,
        isHost
    } = useTruthDareGame(chatId, dbUser?.id);

    // Sync view with game state - only auto-switch to 'game' when a game starts
    const prevStageRef = React.useRef(gameState?.stage);
    React.useEffect(() => {
        const currentStage = gameState?.stage || 'idle';

        // Auto-switch to 'game' view only when transitioning from idle to active
        if (prevStageRef.current === 'idle' && currentStage !== 'idle') {
            setView('game');
        }

        // Auto-switch to 'lobby' only when game truly ends
        if (currentStage === 'idle') {
            setView('lobby');
        }

        prevStageRef.current = currentStage;
    }, [gameState?.stage]);

    const handleBack = () => {
        if (view === 'game') {
            setView('lobby');
        } else {
            navigate(-1);
        }
    };

    const isGameActive = gameState && gameState.stage !== 'idle';

    return (
        <div className={styles['arena-page-container']}>
            {/* Premium Navbar */}
            <nav className={styles['arena-navbar']}>
                <button
                    onClick={handleBack}
                    className={styles['back-btn']}
                >
                    <ArrowLeft size={20} />
                    <span>Back</span>
                </button>

                <div className={styles['arena-logo']}>
                    <div className={styles['logo-icon']}>
                        <Gamepad2 size={24} className={styles['text-white']} />
                    </div>
                    <div className={styles['logo-text']}>
                        <h1>BATTLE ARENA</h1>
                        <span>Live Battle</span>
                    </div>
                </div>

                <div className={styles['navbar-spacer']} />
            </nav>

            <main className={`${styles['arena-main']} ${styles['custom-scrollbar']}`}>
                {view === 'lobby' ? (
                    <div className={styles['game-container-wide']}>
                        <GameRoom
                            chatId={chatId}
                            otherUserId={otherUserId}
                            onStartTruthDare={() => startGame(otherUserId)}
                            onResumeGame={() => setView('game')}
                        />
                    </div>
                ) : (
                    <div className={styles['game-container-wide']}>
                        <div className={styles['game-actions-row']}>
                            <button
                                onClick={() => closeGame()}
                                className={styles['abandon-btn']}
                            >
                                Abandon Battle ×
                            </button>
                        </div>

                        <div className={styles['game-content-area']}>
                            <TruthDareGame
                                gameState={gameState}
                                userId={dbUser?.id}
                                partnerId={otherUserId}
                                onPick={pickType}
                                onSend={sendChallenge}
                                onComplete={completeTurn}
                                onAccept={acceptGame}
                                onReject={rejectGame}
                                onJoin={joinBattle}
                                onSpin={startSpin}
                                isHost={isHost}
                                onStart={() => startGame(otherUserId)}
                                isEmbedded={false}
                            />
                        </div>
                    </div>
                )}
            </main>

            {/* Decorative Background Glows */}
            <div className={styles['deco-glow-top']} />
            <div className={styles['deco-glow-bottom']} />
        </div>
    );
};

export default ArenaPage;
