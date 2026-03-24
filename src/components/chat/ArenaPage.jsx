import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTruthDareGame } from '../../hooks/useTruthDareGame';
import GameLobby from './GameLobby';
import TruthDareGame from './TruthDareGame';
import { ArrowLeft, Gamepad2, Users } from 'lucide-react';
import ArenaRoom from './ArenaRoom';
import styles from './GameLobby.module.css';

const ArenaPage = () => {
    const { chatId, otherUserId } = useParams();
    const navigate = useNavigate();
    const { dbUser } = useAuth();

    console.log("DEBUG: ArenaPage Mounted", { chatId, otherUserId, userId: dbUser?.id });

    const [view, setView] = React.useState('lobby'); // 'lobby' or 'game'

    const game = useTruthDareGame(chatId, dbUser?.id);
    const { gameState, webrtc } = game;

    // Sync view with game state - auto-switch to 'game' when a game starts or is already active
    const prevStageRef = React.useRef(gameState?.stage);
    React.useEffect(() => {
        const currentStage = gameState?.stage || 'idle';

        // Auto-switch to 'game' view if game is active
        if (currentStage !== 'idle') {
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

            <main className={styles['arena-main']}>
                <ArenaRoom 
                    chatId={chatId}
                    userId={dbUser?.id}
                    userName={dbUser?.name}
                    gameProps={{
                        ...game,
                        partnerId: otherUserId
                    }}
                    webrtcProps={webrtc}
                />
            </main>

            {/* Decorative Background Glows */}
            <div className={styles['deco-glow-top']} />
            <div className={styles['deco-glow-bottom']} />
        </div>
    );
};

export default ArenaPage;
