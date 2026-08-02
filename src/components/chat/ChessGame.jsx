import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Swords, RotateCcw, AlertCircle, X, ChevronLeft, Palette } from 'lucide-react';
import PlayerAvatar from '../common/PlayerAvatar';
import styles from './ChessGame.module.css';

const BOARD_THEMES = {
  green: { name: 'Emerald', light: '#eeeed2', dark: '#769656' },
  wood: { name: 'Woodland', light: '#f0d9b5', dark: '#b58863' },
  ice: { name: 'Ice Blue', light: '#e2e8f0', dark: '#3b82f6' },
  midnight: { name: 'Midnight', light: '#4a4a4a', dark: '#2a2a2a' },
  cyberpunk: { name: 'Cyberpunk', light: '#251a2e', dark: '#0c0517' }
};

const PIECE_THEMES = {
  classic: { name: 'Classic' },
  neon: { name: 'Neon Glow' },
  goldsilver: { name: 'Gold/Silver' },
  cyberpunk: { name: 'Cyberpunk' }
};

const ChessGame = ({
  stage,
  fen,
  turn,
  players,
  winner,
  isHost,
  userId,
  partnerId,
  makeMove,
  onStart,
  onAccept,
  onReject,
  onExit,
  isEmbedded = false
}) => {
  const [game, setGame] = useState(new Chess(fen === 'start' ? undefined : fen));
  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState({});
  const [boardTheme, setBoardTheme] = useState(() => localStorage.getItem('chess_board_theme') || 'green');
  const [pieceTheme, setPieceTheme] = useState(() => localStorage.getItem('chess_piece_theme') || 'classic');
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  useEffect(() => {
    const newGame = new Chess();
    if (fen && fen !== 'start') {
        try {
            newGame.load(fen);
        } catch(e) {}
    }
    setGame(newGame);
  }, [fen]);

  const onDrop = (sourceSquare, targetSquare) => {
    const move = {
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q', // always promote to queen for simplicity
    };

    const result = makeMove(move);
    
    // Clear selection on drag drop
    setMoveFrom('');
    setOptionSquares({});
    
    // If move was successful and we are guest, optimistically update local game 
    // to prevent piece snap-back before the sync event arrives.
    if (result && !isHost) {
        try {
            const newGame = new Chess(game.fen());
            newGame.move(move);
            setGame(newGame);
        } catch (e) {
            console.error('[ChessGame] Optimistic update failed:', e);
        }
    }
    
    return result;
  };

  const onSquareClick = (square) => {
    if (!isMyTurn) return;

    const piece = game.get(square);

    // If clicking own piece, select/change selection
    if (piece && piece.color === mySide) {
      setMoveFrom(square);
      setOptionSquares({
        [square]: { backgroundColor: 'rgba(0, 168, 132, 0.4)' }
      });
      return;
    }

    // If a piece was already selected and clicking somewhere else, try to move
    if (moveFrom) {
      const move = {
        from: moveFrom,
        to: square,
        promotion: 'q'
      };

      const result = makeMove(move);

      if (result && !isHost) {
        try {
          const newGame = new Chess(game.fen());
          newGame.move(move);
          setGame(newGame);
        } catch (e) {
          console.error('[ChessGame] Click optimistic update failed:', e);
        }
      }

      setMoveFrom('');
      setOptionSquares({});
    }
  };

  const mySide = players[userId]?.side || (isHost ? 'w' : 'b');
  const opponentSide = mySide === 'w' ? 'b' : 'w';
  const opponent = players[partnerId] || { name: 'Opponent' };
  const me = players[userId] || { name: 'You' };

  const isMyTurn = turn === mySide;

  const renderIdle = () => (
    <div className={styles.container}>
      <div className={styles.heroIcon}><Swords size={48} /></div>
      <h2 className={styles.title}>GRAND CHESS</h2>
      <p className={styles.subtitle}>Test your strategy in a classic battle of wits.</p>
      <button className={styles.primaryBtn} onClick={onStart}>START NEW GAME</button>
    </div>
  );

  const renderInviting = () => (
    <div className={styles.container}>
      <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity }} className={styles.heroIcon}>
        <Swords size={48} />
      </motion.div>
      <h2 className={styles.title}>WAITING...</h2>
      <p className={styles.subtitle}>Inviting {opponent.name} to a match.</p>
    </div>
  );

  const renderJoining = () => (
    <div className={styles.container}>
       <div className={styles.heroIcon}><RotateCcw size={48} className={styles.spinning} /></div>
       <h2 className={styles.title}>JOINING...</h2>
       <p className={styles.subtitle}>Connecting to the game board.</p>
    </div>
  );

  const renderGameOver = () => (
    <div className={styles.container}>
      <div className={styles.heroIcon}><Trophy size={64} style={{ color: '#fbbf24' }} /></div>
      <h2 className={styles.title}>GAME OVER</h2>
      <p className={styles.subtitle}>
        {winner === 'draw' ? "It's a Draw!" : winner === mySide ? "You Won!" : "Opponent Won!"}
      </p>
      <button className={styles.primaryBtn} onClick={onStart}>REMATCH</button>
    </div>
  );

  if (stage === 'idle') return renderIdle();
  if (stage === 'inviting' && isHost) return renderInviting();
  if (stage === 'inviting' && !isHost) return (
    <div className={styles.container}>
        <Swords size={48} style={{ marginBottom: '16px' }} />
        <h2 className={styles.title}>CHESS CHALLENGE!</h2>
        <p className={styles.subtitle}>{opponent.name} wants to play Chess.</p>
        <div className={styles.actions}>
            <button className={styles.acceptBtn} onClick={onAccept}>ACCEPT</button>
            <button className={styles.rejectBtn} onClick={onReject}>DECLINE</button>
        </div>
    </div>
  );
  if (stage === 'joining') return renderJoining();
  if (stage === 'game-over') return renderGameOver();

  return (
    <div className={styles.gameArea}>
      <div className={styles.playerBar}>
        <PlayerAvatar avatar={opponent.avatar} name={opponent.name} size={32} />
        <div className={styles.playerInfo}>
            <span className={styles.playerName}>{opponent.name}</span>
            <span className={styles.playerSide}>{opponentSide === 'w' ? 'White' : 'Black'}</span>
        </div>
        {turn === opponentSide && <div className={styles.turnIndicator}>Thinking...</div>}
      </div>

      <button className={styles.themeToggleBtn} onClick={() => setShowThemeMenu(true)}>
        <Palette size={14} /> Customize Theme
      </button>

      <div className={`${styles.boardWrapper} ${styles['pieceTheme_' + pieceTheme]}`}>
        <div className={styles.boardContainer}>
          <Chessboard 
              position={fen} 
              onPieceDrop={onDrop} 
              onSquareClick={onSquareClick}
              customSquareStyles={optionSquares}
              boardOrientation={mySide === 'w' ? 'white' : 'black'}
              customDarkSquareStyle={{ backgroundColor: BOARD_THEMES[boardTheme].dark }}
              customLightSquareStyle={{ backgroundColor: BOARD_THEMES[boardTheme].light }}
              animationDuration={200}
          />
        </div>
      </div>

      <div className={styles.playerBar}>
        <PlayerAvatar avatar={me.avatar} name={me.name} size={32} />
        <div className={styles.playerInfo}>
            <span className={styles.playerName}>You</span>
            <span className={styles.playerSide}>{mySide === 'w' ? 'White' : 'Black'}</span>
        </div>
        {isMyTurn && <div className={`${styles.turnIndicator} ${styles.myTurn}`}>Your Turn</div>}
      </div>

      <div className={styles.statusFooter}>
         {game.isCheck() && <div className={styles.checkAlert}><AlertCircle size={14} /> CHECK!</div>}
      </div>

      <AnimatePresence>
        {showThemeMenu && (
          <motion.div 
            initial={{ translateY: '100%' }}
            animate={{ translateY: 0 }}
            exit={{ translateY: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className={styles.themeMenuContainer}
          >
            <div className={styles.themeMenuHeader}>
              <span>BOARD THEME</span>
              <button className={styles.closeMenuBtn} onClick={() => setShowThemeMenu(false)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.themeOptionsGrid}>
              {Object.entries(BOARD_THEMES).map(([key, themeOpt]) => (
                <button 
                  key={key} 
                  className={`${styles.themeOption} ${boardTheme === key ? styles.activeOption : ''}`}
                  onClick={() => {
                    setBoardTheme(key);
                    localStorage.setItem('chess_board_theme', key);
                  }}
                >
                  <div className={styles.themeColorPreview}>
                    <div style={{ backgroundColor: themeOpt.light }} />
                    <div style={{ backgroundColor: themeOpt.dark }} />
                  </div>
                  <span className={styles.themeOptionName}>{themeOpt.name}</span>
                </button>
              ))}
            </div>

            <div className={styles.themeMenuDivider} />

            <div className={styles.themeMenuHeader}>
              <span>PIECE COLORS</span>
            </div>
            <div className={styles.themeOptionsGrid}>
              {Object.entries(PIECE_THEMES).map(([key, themeOpt]) => (
                <button 
                  key={key} 
                  className={`${styles.themeOption} ${pieceTheme === key ? styles.activeOption : ''}`}
                  onClick={() => {
                    setPieceTheme(key);
                    localStorage.setItem('chess_piece_theme', key);
                  }}
                >
                  <div className={`${styles.piecePreview} ${styles['piecePreview_' + key]}`}>
                    <span>♔</span>
                    <span>♚</span>
                  </div>
                  <span className={styles.themeOptionName}>{themeOpt.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChessGame;
