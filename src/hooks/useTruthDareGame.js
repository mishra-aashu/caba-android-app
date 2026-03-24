import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { TRUTHS, DARES, DB_TABLES, SCORING, GAME_MODES } from '../constants/gameData';
import { prepareDataForDB } from '../utils/dbSchemaCompatibility';
import useWebRTCRoom from './useWebRTCRoom';

export const GAME_STATES = {
  IDLE: 'idle',
  INVITING: 'inviting',
  ACCEPTED: 'accepted',
  SETUP: 'setup',
  TURN_SPINNING: 'turn-spinning',
  TURN_ANNOUNCE: 'turn-announce',
  TURN_CHOOSING: 'turn-choosing',
  TURN_CHALLENGE: 'turn-challenge',
  TURN_RESPONDING: 'turn-responding',
  TURN_VOTING: 'turn-voting',
  TURN_RESULT: 'turn-result',
  GAME_OVER: 'game-over'
};

export const useTruthDareGame = (roomId, userId, { enabled = true } = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [gameState, setGameState] = useState({
    stage: GAME_STATES.IDLE,
    turn: null,
    type: null, // 'truth' | 'dare'
    content: '',
    round: 1,
    maxRounds: 5,
    mode: GAME_MODES.CLASSIC,
    timer: 0,
    players: {}, // { userId: { points: 0, streak: 0, lastType: null } }
    winnerId: null,
    localPlayer: null,
    partnerPlayer: null,
    partnerId: null,
    votes: {}, // { voterId: 'yes' | 'no' }
  });
  const [isHost, setIsHost] = useState(false);
  const isHostRef = useRef(isHost);
  const stateRef = useRef(gameState);
  const gameIdRef = useRef(gameId);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  // --- WebRTC Sync Core ---

  const handleGameEvent = useCallback((event) => {
    if (isHostRef.current) {
      handleClientEvent(event.senderId, event);
    }
  }, []);

  const webrtc = useWebRTCRoom({ 
    roomId, 
    userId, 
    userName: stateRef.current.localPlayer?.name || 'Player',
    supabase 
  });

  const { sendGameEvent, peers, connectionState, chatMessages, gameEvents, mediaProgress, sendChat, sendMedia } = webrtc;

  // Authoritative Host: Sync state to new peers
  useEffect(() => {
    if (isHost && peers.length > 0) {
      // Broadcast current state to ensure new peers are in sync
      syncGame(gameIdRef.current, stateRef.current);
    }
  }, [peers.length, isHost]); // Trigger when peer count changes

  // Handle incoming data from WebRTCRoomManager
  useEffect(() => {
    const lastEvent = gameEvents[gameEvents.length - 1];
    if (!lastEvent) return;

    if (lastEvent.type === 'GAME_UPDATE') {
      const newState = {
        ...lastEvent.gameState,
        localPlayer: stateRef.current.localPlayer,
        partnerPlayer: stateRef.current.partnerPlayer
      };
      setGameState(newState);
      setGameId(lastEvent.gameId);
      if (newState.stage !== GAME_STATES.IDLE) {
        setIsOpen(true);
      }
    } else if (lastEvent.type === 'GAME_EVENT' && isHostRef.current) {
      handleClientEvent(lastEvent.senderId, lastEvent.event);
    }
  }, [gameEvents]);

  const syncGame = useCallback((newId, newState) => {
    setGameId(newId);
    setGameState(newState);
    
    // Authoritative broadcast via the unified manager
    sendGameEvent({ type: 'GAME_UPDATE', gameId: newId, gameState: newState });
  }, [sendGameEvent, roomId]);

  // --- Host Logic: Transitions and Scoring ---

  const processTransition = useCallback((nextStage) => {
    if (!isHostRef.current) return;
    const current = stateRef.current;
    let nextState = { ...current, stage: nextStage };

    switch (nextStage) {
      case GAME_STATES.TURN_ANNOUNCE:
        // Set up next turn logic
        nextState.type = null;
        nextState.content = '';
        nextState.votes = {};
        break;
      
      case GAME_STATES.TURN_CHOOSING:
        // Start turn timer if configured
        break;

      case GAME_STATES.TURN_RESULT:
        // Delay and then next turn or game over
        setTimeout(() => {
          if (current.round >= current.maxRounds && current.turn === current.partnerId) {
            // End of last round (both players moved)
            const finalScores = current.players;
            let winner = null;
            let maxPoints = -Infinity;
            Object.entries(finalScores).forEach(([id, stats]) => {
              if (stats.points > maxPoints) {
                maxPoints = stats.points;
                winner = id;
              }
            });
            processTransition(GAME_STATES.GAME_OVER);
          } else {
            // Next turn
            const nextRound = current.turn === current.partnerId ? current.round + 1 : current.round;
            const nextTurn = current.turn === userId ? current.partnerId : userId;
            const newState = { 
              ...stateRef.current, 
              round: nextRound, 
              turn: nextTurn,
              stage: GAME_STATES.TURN_ANNOUNCE 
            };
            syncGame(gameIdRef.current, newState);
          }
        }, 2500);
        break;

      case GAME_STATES.GAME_OVER:
        // Determine winner
        let winningPlayerId = null;
        let topScore = -1;
        Object.entries(current.players).forEach(([id, stats]) => {
          if (stats.points > topScore) {
            topScore = stats.points;
            winningPlayerId = id;
          }
        });
        nextState.winnerId = winningPlayerId;
        break;
    }

    syncGame(gameIdRef.current, nextState);
  }, [userId, syncGame]);

  const updateScore = (targetId, actionType, bonus = 0) => {
    if (!isHostRef.current) return;
    const current = stateRef.current;
    const players = { ...current.players };
    const p = players[targetId] || { points: 0, streak: 0, lastType: null };
    
    let basePoints = SCORING[actionType.toUpperCase()] || 0;
    p.points += (basePoints + bonus);
    
    // Streaks
    if (actionType === 'truth' || actionType === 'dare') {
      if (p.lastType === actionType) {
        p.streak += 1;
        if (p.streak === 3) {
          p.points += (actionType === 'dare' ? SCORING.STREAK_BONUS_DARE : SCORING.STREAK_BONUS_TRUTH);
        }
      } else {
        p.streak = 1;
      }
      p.lastType = actionType;
    } else {
      p.streak = 0;
      p.lastType = null;
    }

    players[targetId] = p;
    return players;
  };

  const handleClientEvent = (from, event) => {
    if (!isHostRef.current) return;
    let newState = { ...stateRef.current };

    switch (event.type) {
      case 'START_SESSION':
        newState.stage = GAME_STATES.TURN_ANNOUNCE;
        break;
      case 'TRIGGER_SPIN': {
          const newState = {
              ...stateRef.current,
              stage: GAME_STATES.TURN_SPINNING,
              winnerId: null // Reset visual winner for spin
          };
          syncGame(gameId, newState);
          break;
      }
      case 'START_SESSION_INVITE':
        // Receiver receives invitation via WebRTC
        newState = { ...event.payload };
        setIsOpen(true);
        setIsHost(false);
        break;
      case 'ACCEPT_GAME':
        // Host receives acceptance
        newState.stage = GAME_STATES.TURN_ANNOUNCE;
        newState.round = 1;
        newState.maxRounds = 5;
        newState.mode = GAME_MODES.CLASSIC;
        break;
      case 'JOIN_BATTLE':
        if (stateRef.current.stage === GAME_STATES.INVITING || stateRef.current.stage === GAME_STATES.ACCEPTED) {
            newState.stage = GAME_STATES.TURN_ANNOUNCE;
            newState.round = 1;
        }
        break;
      case 'PICK_TYPE':
        newState = { ...newState, type: event.payload, stage: GAME_STATES.TURN_CHALLENGE };
        break;
      case 'SEND_CHALLENGE':
        newState = { ...newState, content: event.payload, stage: GAME_STATES.TURN_RESPONDING };
        break;
      case 'COMPLETE_TURN':
        // Move to voting or result
        newState.players = updateScore(from, newState.type);
        newState.stage = GAME_STATES.TURN_RESULT;
        break;
      case 'SKIP_TURN':
        newState.players = updateScore(from, 'SKIP');
        newState.stage = GAME_STATES.TURN_RESULT;
        break;
      case 'SWITCH_TYPE':
        // Switching reduces points
        newState.type = newState.type === 'truth' ? 'dare' : 'truth';
        newState.stage = GAME_STATES.TURN_CHALLENGE;
        // Optionally penalize for switching if desired, blueprint says "Switch then complete = half points"
        // We'll handle this by giving the switch penalty now and full points later
        newState.players = updateScore(from, 'SWITCH');
        break;
      case 'CAST_VOTE':
        newState.votes[from] = event.payload;
        // If everyone voted... (simplified for 2 players: other player votes)
        if (Object.keys(newState.votes).length >= 1) { // In 1v1, 1 vote is enough
           // ... logic for voting results ...
        }
        break;
      case 'TRIGGER_SPIN':
        const contestants = [userId, newState.partnerId];
        const winner = contestants[Math.floor(Math.random() * contestants.length)];
        newState = { ...newState, winnerId: winner, turn: winner };
        // Spin result broadcast handled via the general sync
        setTimeout(() => {
          processTransition(GAME_STATES.TURN_ANNOUNCE);
        }, 4000); // 4s animation
        break;
    }
    
    syncGame(gameIdRef.current, newState);
  };

  // --- Public Handlers ---

  const startGame = useCallback(async (targetPartnerId) => {
    try {
      console.log("DEBUG: P2P startGame called", { targetPartnerId, roomId, userId });
      
      // Zero DB writes - we just open the UI and broadcast intent
      setIsOpen(true);
      setIsHost(true);

      const initialPlayers = {
        [userId]: { points: 0, streak: 0, lastType: null },
        [targetPartnerId]: { points: 0, streak: 0, lastType: null }
      };
      
      const initialState = {
        ...stateRef.current,
        stage: GAME_STATES.INVITING,
        turn: userId,
        partnerId: targetPartnerId,
        players: initialPlayers
      };

      setGameState(initialState);

      // Broadcast the new game session to the partner
      sendGameEvent({ 
        type: 'GAME_EVENT', 
        event: { 
          type: 'START_SESSION_INVITE', 
          payload: initialState 
        } 
      });

      return { success: true };
    } catch (err) {
      console.error("DEBUG: Fatal error in P2P startGame", err);
      return { success: false, error: err.message };
    }
  }, [userId, roomId, sendGameEvent]);

  const acceptGame = useCallback(() => {
    // Zero DB writes - just signal acceptance
    const newState = { 
      ...stateRef.current, 
      stage: GAME_STATES.TURN_ANNOUNCE,
      round: 1 
    };
    setGameState(newState);
    setIsOpen(true);

    // Notify host to also jump to game
    sendGameEvent({ type: 'GAME_EVENT', event: { type: 'ACCEPT_GAME' } });
  }, [sendGameEvent]);

  const joinBattle = useCallback(() => {
    if (isHost) {
      // Host jumps straight to announce
      processTransition(GAME_STATES.TURN_ANNOUNCE);
    } else {
      sendGameEvent({ type: 'GAME_EVENT', event: { type: 'JOIN_BATTLE' } });
    }
  }, [isHost, processTransition, sendGameEvent]);

  const confirmSettings = useCallback((settings) => {
    if (!isHost) return;
    const newState = { 
      ...stateRef.current, 
      ...settings, 
      stage: GAME_STATES.TURN_ANNOUNCE,
      round: 1 
    };
    syncGame(gameId, newState);
  }, [isHost, gameId, syncGame]);

  const pickType = useCallback((type) => {
    if (stateRef.current.turn !== userId) return;
    if (isHost) {
      handleClientEvent(userId, { type: 'PICK_TYPE', payload: type });
    } else {
      sendGameEvent({ type: 'GAME_EVENT', event: { type: 'PICK_TYPE', payload: type } });
    }
  }, [isHost, userId, sendGameEvent]);

  const sendChallenge = useCallback((text) => {
    if (stateRef.current.turn !== userId) return;
    if (isHost) {
      handleClientEvent(userId, { type: 'SEND_CHALLENGE', payload: text });
    } else {
      sendGameEvent({ type: 'GAME_EVENT', event: { type: 'SEND_CHALLENGE', payload: text } });
    }
  }, [isHost, userId, sendGameEvent]);

  const completeTurn = useCallback(() => {
    if (stateRef.current.turn === userId) return; // Cannot complete your own
    if (isHost) {
      handleClientEvent(userId, { type: 'COMPLETE_TURN' });
    } else {
      sendGameEvent({ type: 'GAME_EVENT', event: { type: 'COMPLETE_TURN' } });
    }
  }, [isHost, userId, sendGameEvent]);

  const skipTurn = useCallback(() => {
    if (stateRef.current.turn !== userId) return;
    if (isHost) {
      handleClientEvent(userId, { type: 'SKIP_TURN' });
    } else {
      sendGameEvent({ type: 'GAME_EVENT', event: { type: 'SKIP_TURN' } });
    }
  }, [isHost, userId, sendGameEvent]);

  const switchType = useCallback(() => {
    if (stateRef.current.turn !== userId) return;
    if (isHost) {
      handleClientEvent(userId, { type: 'SWITCH_TYPE' });
    } else {
      sendGameEvent({ type: 'GAME_EVENT', event: { type: 'SWITCH_TYPE' } });
    }
  }, [isHost, userId, sendGameEvent]);

  const startSpin = useCallback(() => {
    if (!isHost) return;
    handleClientEvent(userId, { type: 'TRIGGER_SPIN' });
  }, [isHost, userId]);

  const closeGame = useCallback(async () => {
    setIsOpen(false);
    if (gameId) {
      await supabase.from(DB_TABLES.GAME_INVITATIONS).update({ status: 'completed' }).eq('id', gameId);
    }
    setGameState({ stage: GAME_STATES.IDLE });
    syncGame(null, { stage: GAME_STATES.IDLE });
  }, [gameId, syncGame]);

  // --- Effects ---

  // Auto-transitions for UI announcement phases
  useEffect(() => {
    if (!isHost) return;
    
    if (gameState.stage === GAME_STATES.TURN_SPINNING) {
      const timer = setTimeout(() => {
        // After spin animation (3.5s), pick a random turn and announce
        processTransition(GAME_STATES.TURN_ANNOUNCE);
      }, 4000);
      return () => clearTimeout(timer);
    }
    
    if (gameState.stage === GAME_STATES.TURN_ANNOUNCE) {
      const timer = setTimeout(() => {
        processTransition(GAME_STATES.TURN_CHOOSING);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState.stage, isHost, processTransition]);

  return {
    isOpen,
    gameState,
    gameId,
    isHost,
    startGame,
    acceptGame,
    rejectGame: () => closeGame(), // simplified
    joinBattle,
    confirmSettings,
    pickType,
    sendChallenge,
    completeTurn,
    skipTurn,
    switchType,
    startSpin,
    closeGame,
    setIsOpen,
    // WebRTC P2P Data
    webrtc: {
      peers,
      connectionState,
      chatMessages,
      mediaProgress,
      sendChat,
      sendMedia
    }
  };
};