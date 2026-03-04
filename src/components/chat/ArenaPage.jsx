import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTruthDareGame } from '../../hooks/useTruthDareGame';
import GameRoom from './GameRoom';
import TruthDareGame from './TruthDareGame';
import { ArrowLeft, Gamepad2 } from 'lucide-react';
import './GameRoom.css';

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
        <div className="arena-page-container">
            {/* Premium Navbar */}
            <nav className="arena-navbar">
                <button
                    onClick={handleBack}
                    className="back-btn"
                >
                    <ArrowLeft size={20} />
                    <span>Back</span>
                </button>

                <div className="arena-logo">
                    <div className="logo-icon">
                        <Gamepad2 size={24} className="text-white" />
                    </div>
                    <div className="logo-text">
                        <h1>BATTLE ARENA</h1>
                        <span>Live Battle</span>
                    </div>
                </div>

                <div className="spacer" style={{ width: '40px' }} />
            </nav>

            <main className="arena-main custom-scrollbar">
                {view === 'lobby' ? (
                    <div className="game-container-wide">
                        <GameRoom
                            chatId={chatId}
                            otherUserId={otherUserId}
                            onStartTruthDare={() => startGame(otherUserId)}
                            onResumeGame={() => setView('game')}
                        />
                    </div>
                ) : (
                    <div className="game-container-wide">
                        <div className="game-actions-row" style={{ marginBottom: '1.5rem', display: 'flex' }}>
                            <button
                                onClick={() => closeGame()}
                                className="abandon-btn"
                            >
                                Abandon Battle ×
                            </button>
                        </div>

                        <div className="game-content-area">
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
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-pink-500/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />
        </div>
    );
};

export default ArenaPage;
