import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Swords, RotateCcw, AlertCircle, X, ChevronLeft } from 'lucide-react';
import PlayerAvatar from '../common/PlayerAvatar';
import styles from './ChessGame.module.css';

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
    return result;
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

      <div className={styles.boardWrapper}>
        <Chessboard 
            position={fen} 
            onPieceDrop={onDrop} 
            boardOrientation={mySide === 'w' ? 'white' : 'black'}
            customDarkSquareStyle={{ backgroundColor: '#2a2a2a' }}
            customLightSquareStyle={{ backgroundColor: '#4a4a4a' }}
            animationDuration={200}
        />
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
    </div>
  );
};

export default ChessGame;
