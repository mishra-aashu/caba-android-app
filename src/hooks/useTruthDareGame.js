/**
 * useTruthDareGame.jsx
 * 
 * Manages Truth or Dare multiplayer game state with WebRTC synchronization.
 * 
 * Architecture:
 * - Host: Authoritative game state, broadcasts updates to clients
 * - Client: Sends actions to host, receives state updates
 * - Database: Persistent invitation/session tracking
 * - WebRTC: Real-time P2P communication
 */

import { useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import { TRUTHS, DARES, DB_TABLES, SCORING, GAME_MODES } from '../constants/gameData';
import useWebRTCRoom from './useWebRTCRoom';
import toast from 'react-hot-toast';

// ─── Game States ───────────────────────────────────────────
export const GAME_STATES = {
  IDLE: 'idle',
  INVITING: 'inviting',
  JOINING: 'joining',
  ACCEPTED: 'accepted',
  SETUP: 'setup',
  INITIAL_SPIN: 'initial-spin',
  TURN_ANNOUNCE: 'turn-announce',
  TURN_ASKS: 'turn-asks',
  TURN_CHOOSES: 'turn-chooses',
  TURN_CHALLENGE: 'turn-challenge',
  TURN_RESPONDING: 'turn-responding',
  TURN_RESULT: 'turn-result',
  GAME_OVER: 'game-over'
};

// ─── Constants ─────────────────────────────────────────────
const INITIAL_GAME_STATE = {
  stage: GAME_STATES.IDLE,
  gameId: null,
  isHost: false,
  turn: null,
  type: null,
  content: '',
  round: 1,
  maxRounds: 5,
  mode: GAME_MODES.CLASSIC,
  players: {}, // { [id]: { points: 0, streak: 0, lastType: null, name: '', avatar: '' } }
  winnerId: null,
  partnerId: null,
  targetId: null, // The person who is currently being challenged
  askerId: null, // The person who is currently asking
  votes: {},
  spinData: null, // { rotation: number, whoStarts: string }
};

const TURN_ANNOUNCE_DELAY = 2500;
const TURN_ASKS_DELAY = 3000;
const TURN_RESULT_DELAY = 3000;
const SYNC_REQUEST_INTERVAL = 2000;
const SYNC_TIMEOUT = 15000;

// ─── Helpers ───────────────────────────────────────────────
const shallowEqual = (obj1, obj2) => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  
  return true;
};

const isStateEqual = (state1, state2) => {
  if (!state1 || !state2) return false;
  
  // Compare primitive fields
  const primitives1 = { ...state1 };
  const primitives2 = { ...state2 };
  delete primitives1.players;
  delete primitives2.players;
  delete primitives1.votes;
  delete primitives2.votes;
  
  if (!shallowEqual(primitives1, primitives2)) return false;
  
  // Compare complex fields
  return (
    JSON.stringify(state1.players) === JSON.stringify(state2.players) &&
    JSON.stringify(state1.votes) === JSON.stringify(state2.votes)
  );
};

// ─── Reducer ───────────────────────────────────────────────
function gameReducer(state, action) {
  switch (action.type) {
    case 'SYNC_STATE': {
      // Extract properties
      const { isHost: payloadIsHost, players: networkPlayers, ...rest } = action.payload;
      
      const newState = { ...state, ...rest };
      
      // Only update isHost if it was explicitly provided in the payload 
      // AND we are not in a network sync (handled by caller or via specific flag)
      // Actually, simplest is to check if payloadIsHost is undefined
      if (payloadIsHost !== undefined) {
        newState.isHost = payloadIsHost;
      }
      
      if (networkPlayers) {
        const mergedPlayers = { ...state.players };
        Object.entries(networkPlayers).forEach(([id, data]) => {
          mergedPlayers[id] = {
            ...(mergedPlayers[id] || {}),
            ...data,
            // Keep existing name/avatar if new one is generic or missing
            name: (data.name && data.name !== 'Opponent' && data.name !== 'You') 
              ? data.name 
              : (mergedPlayers[id]?.name || data.name),
            avatar: data.avatar || mergedPlayers[id]?.avatar
          };
        });
        newState.players = mergedPlayers;
      }
      
      return newState;
    }
    
    case 'SET_HOST':
      return { ...state, isHost: action.payload };

    case 'UPDATE_GAME_ID':
      return { ...state, gameId: action.payload };

    case 'TRANSITION': {
      const nextState = { 
        ...state, 
        ...(action.payload || {}),
        stage: action.stage,
      };
      
      // Reset turn-specific data on new turn announce
      if (action.stage === GAME_STATES.TURN_ANNOUNCE) {
        nextState.type = null;
        nextState.content = '';
        nextState.votes = {};
      }
      
      return nextState;
    }

    case 'RESET':
      return { ...INITIAL_GAME_STATE };

    default:
      return state;
  }
}

// ─── Main Hook ─────────────────────────────────────────────
export const useTruthDareGame = (roomId, dbUser, supabase) => {
  const userId = dbUser?.id;
  const [state, dispatch] = useReducer(gameReducer, INITIAL_GAME_STATE);
  const stateRef = useRef(state);
  const dbUserRef = useRef(dbUser);
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastBroadcastRef = useRef(null);

  // Sync refs
  useEffect(() => { 
    stateRef.current = state; 
  }, [state]);

  useEffect(() => {
    dbUserRef.current = dbUser;
  }, [dbUser]);
  
  // Mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimer();
    };
  }, []);

  // WebRTC Core
  const webrtc = useWebRTCRoom({ 
    roomId, 
    userId, 
    userName: dbUser?.name || 'Player',
    supabase 
  });

  const { sendGameEvent, lastGameEvent } = webrtc;

  // ─── Timer Management ──────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ─── State Broadcasting ────────────────────────────────────
  const broadcastState = useCallback((newState, force = false) => {
    // Deduplicate broadcasts
    if (!force && isStateEqual(newState, lastBroadcastRef.current)) {
      return;
    }
    
    lastBroadcastRef.current = { ...newState };
    
    // Don't include isHost in broadcast to prevent overwriting client's role
    const { isHost, ...broadcastPayload } = newState;
    
    sendGameEvent({ 
      type: 'GAME_UPDATE', 
      gameId: newState.gameId, 
      gameState: broadcastPayload 
    });
  }, [sendGameEvent]);

  // ─── Scoring Engine ────────────────────────────────────────
  const calculateScores = useCallback((players, targetId, actionType, bonus = 0) => {
    const nextPlayers = { ...players };
    const p = { ...(nextPlayers[targetId] || { points: 0, streak: 0, lastType: null }) };
    
    const base = SCORING[actionType.toUpperCase()] || 0;
    p.points += (base + bonus);
    
    if (['truth', 'dare'].includes(actionType)) {
      p.streak = p.lastType === actionType ? p.streak + 1 : 1;
      if (p.streak >= 3) {
        p.points += (actionType === 'dare' ? SCORING.STREAK_BONUS_DARE : SCORING.STREAK_BONUS_TRUTH);
      }
      p.lastType = actionType;
    } else {
      p.streak = 0;
      p.lastType = null;
    }

    nextPlayers[targetId] = p;
    return nextPlayers;
  }, []);

  // ─── Host Transition Logic ─────────────────────────────────
  const hostTransition = useCallback((nextStage, extra = {}) => {
    if (!stateRef.current.isHost || !isMountedRef.current) return;
    
    clearTimer();

    let nextState = { ...stateRef.current, ...extra, stage: nextStage };

    // Turn announcement auto-advance
    if (nextStage === GAME_STATES.TURN_ANNOUNCE) {
      nextState.type = null;
      nextState.content = '';
      
      // Target is always the one who just took a turn (if rotation logic follows)
      // For first round, this is determined by INITIAL_SPIN
      
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          hostTransition(GAME_STATES.TURN_ASKS);
        }
      }, TURN_ANNOUNCE_DELAY);
    }

    // Turn asks auto-advance (no manual ask button needed)
    if (nextStage === GAME_STATES.TURN_ASKS) {
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          hostTransition(GAME_STATES.TURN_CHOOSES);
        }
      }, TURN_ASKS_DELAY);
    }

    // Initial spin auto-advance (after spin animation)
    if (nextStage === GAME_STATES.INITIAL_SPIN) {
       // This will be triggered manually after spin finishes in UI
    }

    // Turn result auto-advance
    if (nextStage === GAME_STATES.TURN_RESULT) {
      timerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        
        const currentState = stateRef.current;
        const isLastRound = currentState.round >= currentState.maxRounds;
        
        // In the new flow, the person who was the Target becomes the Asker
        const nextAskerId = currentState.targetId;
        const nextTargetId = currentState.askerId;

        if (isLastRound && currentState.targetId === currentState.partnerId) {
          hostTransition(GAME_STATES.GAME_OVER);
        } else {
          hostTransition(GAME_STATES.TURN_ANNOUNCE, {
            round: (currentState.targetId === currentState.partnerId) ? currentState.round + 1 : currentState.round,
            askerId: nextAskerId,
            targetId: nextTargetId,
            turn: nextAskerId // turn property is kept for compatibility with isMyTurn logic
          });
        }
      }, TURN_RESULT_DELAY);
    }

    // Game over - calculate winner
    if (nextStage === GAME_STATES.GAME_OVER) {
      const winner = Object.entries(nextState.players).reduce((prev, [id, p]) => 
        (p.points > (prev?.points || -1)) ? { id, ...p } : prev, null);
      nextState.winnerId = winner?.id;
    }

    dispatch({ type: 'SYNC_STATE', payload: nextState });
    broadcastState(nextState);
  }, [userId, clearTimer, broadcastState]);

  // ─── Action Handler ────────────────────────────────────────
  const handleAction = useCallback((action) => {
    const current = stateRef.current;
    
    if (current.isHost) {
      // Host processes actions immediately
      let nextState = { ...current };
      
      switch (action.type) {
        case 'START_SPIN': {
          if (current.stage !== GAME_STATES.INITIAL_SPIN) return;
          nextState.spinData = action.payload; // { rotation, whoStarts }
          break;
        }

        case 'COMPLETE_SPIN': {
          const winnerId = action.payload; 
          hostTransition(GAME_STATES.TURN_ANNOUNCE, {
            askerId: winnerId,
            targetId: winnerId === userId ? current.partnerId : userId,
            turn: winnerId,
            spinData: null
          });
          return;
        }

        case 'ASK_TD': {
           if (current.stage !== GAME_STATES.TURN_ASKS) return;
           nextState.stage = GAME_STATES.TURN_CHOOSES;
           break;
        }

        case 'PICK_TYPE': {
          if (current.stage !== GAME_STATES.TURN_CHOOSES) {
            console.warn('Invalid stage for PICK_TYPE:', current.stage);
            return;
          }
          nextState.type = action.payload;
          nextState.stage = GAME_STATES.TURN_CHALLENGE;
          break;
        }
        
        case 'SEND_CHALLENGE': {
          if (current.stage !== GAME_STATES.TURN_CHALLENGE) {
            console.warn('Invalid stage for SEND_CHALLENGE:', current.stage);
            return;
          }
          nextState.content = action.payload;
          nextState.stage = GAME_STATES.TURN_RESPONDING;
          break;
        }
        
        case 'COMPLETE_TURN': {
          if (current.stage !== GAME_STATES.TURN_RESPONDING) {
            console.warn('Invalid stage for COMPLETE_TURN:', current.stage);
            return;
          }
          // action.from is the target (Player B)
          nextState.players = calculateScores(current.players, action.from, current.type);
          dispatch({ type: 'SYNC_STATE', payload: nextState });
          hostTransition(GAME_STATES.TURN_RESULT, { players: nextState.players });
          return;
        }
        
        case 'SKIP_TURN': {
          if (current.stage !== GAME_STATES.TURN_RESPONDING) {
            console.warn('Invalid stage for SKIP_TURN:', current.stage);
            return;
          }
          // Penalty for refusal
          nextState.players = calculateScores(current.players, action.from, 'SKIP');
          dispatch({ type: 'SYNC_STATE', payload: nextState });
          hostTransition(GAME_STATES.TURN_RESULT, { players: nextState.players });
          return;
        }
        
        case 'UPDATE_SETTINGS_DRAFT': {
          if (current.stage !== GAME_STATES.SETUP) return;
          nextState = { ...nextState, ...action.payload };
          break;
        }

        case 'CONFIRM_SETTINGS': {
          if (current.stage !== GAME_STATES.SETUP) {
            console.warn('Invalid stage for CONFIRM_SETTINGS:', current.stage);
            return;
          }
          nextState = { ...nextState, ...action.payload };
          dispatch({ type: 'SYNC_STATE', payload: nextState });
          hostTransition(GAME_STATES.INITIAL_SPIN, action.payload);
          return;
        }
        
        case 'ACCEPT_GAME': {
          if (current.stage === GAME_STATES.INVITING || current.stage === GAME_STATES.IDLE || current.stage === GAME_STATES.JOINING) {
            hostTransition(GAME_STATES.SETUP);
          } else {
            broadcastState(current);
          }
          return;
        }
        
        default:
          console.warn('Unknown action type:', action.type);
          return;
      }

      dispatch({ type: 'SYNC_STATE', payload: nextState });
      broadcastState(nextState);
      
    } else {
      // Client sends action to host
      sendGameEvent({ 
        type: 'GAME_ACTION', 
        action: { ...action, from: userId } 
      });
    }
  }, [userId, hostTransition, broadcastState, sendGameEvent, calculateScores]);

  // ─── WebRTC Event Processing ───────────────────────────────
  useEffect(() => {
    if (!lastGameEvent || !isMountedRef.current) return;

    const current = stateRef.current;

    if (lastGameEvent.type === 'GAME_UPDATE') {
      // Clients sync to host's state
      if (!current.isHost && !isStateEqual(lastGameEvent.gameState, current)) {
        dispatch({ type: 'SYNC_STATE', payload: lastGameEvent.gameState });
      }
      
    } else if (lastGameEvent.type === 'GAME_ACTION') {
      // Only host processes actions
      if (current.isHost) {
        handleAction(lastGameEvent.action);
      }
      
    } else if (lastGameEvent.type === 'SYNC_REQUEST') {
      // Host responds to sync requests
      if (current.isHost) {
        broadcastState(current, true);
      }
    }
  }, [lastGameEvent, handleAction, broadcastState]);

  // ─── Sync Request Loop (Client in JOINING) ─────────────────
  useEffect(() => {
    if (state.stage !== GAME_STATES.JOINING || state.isHost) return;

    // Send initial sync request
    sendGameEvent({ type: 'SYNC_REQUEST' });
    
    // Periodic sync requests
    const interval = setInterval(() => {
      if (isMountedRef.current && stateRef.current.stage === GAME_STATES.JOINING) {
        sendGameEvent({ type: 'SYNC_REQUEST' });
      }
    }, SYNC_REQUEST_INTERVAL);

    // Timeout fallback
    const timeout = setTimeout(() => {
      if (isMountedRef.current && stateRef.current.stage === GAME_STATES.JOINING) {
        console.warn('⏱️ JOINING timeout — host did not respond');
        toast.error('Could not connect to host. Returning to lobby...', { duration: 4000 });
        dispatch({ type: 'RESET' });
      }
    }, SYNC_TIMEOUT);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [state.stage, state.isHost, sendGameEvent]);

  // Broadcast state when peer connects (for robustness during mid-game reconnection)
  useEffect(() => {
    if (state.isHost && webrtc.peers.length > 0) {
      console.log('[useTruthDareGame] Peer connected, broadcasting state...');
      broadcastState(stateRef.current, true);
    }
  }, [webrtc.peers.length, state.isHost, broadcastState]);

  // ─── Database Operations ───────────────────────────────────
  const startGame = useCallback(async (targetPartnerId) => {
    if (!userId || !targetPartnerId || !roomId) {
      toast.error('Missing required game parameters');
      return { success: false, error: 'Invalid parameters' };
    }

    // Optimistic update
    dispatch({ type: 'SET_HOST', payload: true });
    
    try {
      const { data, error } = await supabase
        .from(DB_TABLES.GAME_INVITATIONS)
        .insert({
          chat_id: roomId,
          sender_id: userId,
          receiver_id: targetPartnerId,
          game_type: 'truth_or_dare',
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create game invitation:', error);
        toast.error('Failed to send game invitation');
        dispatch({ type: 'RESET' });
        return { success: false, error };
      }

      const startState = {
        ...INITIAL_GAME_STATE,
        gameId: data.id,
        isHost: true,
        stage: GAME_STATES.INVITING,
        turn: userId, // Host starts first
        partnerId: targetPartnerId,
        players: {
          [userId]: { 
            points: 0, 
            streak: 0, 
            lastType: null,
            name: dbUserRef.current?.name || 'You',
            avatar: dbUserRef.current?.avatar || null
          },
          [targetPartnerId]: { 
            points: 0, 
            streak: 0, 
            lastType: null,
            name: 'Opponent', // Will be updated by client on join
            avatar: null
          }
        }
      };

      dispatch({ type: 'SYNC_STATE', payload: startState });
      broadcastState(startState);
      
      toast.success('Game invitation sent!');
      return { success: true, gameId: data.id };
      
    } catch (err) {
      console.error('Error starting game:', err);
      toast.error('An error occurred while starting the game');
      dispatch({ type: 'RESET' });
      return { success: false, error: err };
    }
  }, [userId, roomId, supabase, broadcastState]);

  const acceptGame = useCallback(async (gameInvitation) => {
    if (!gameInvitation?.id) {
      toast.error('Invalid game invitation');
      return;
    }

    const opponentId = gameInvitation.sender_id;
    const opponentMetadata = gameInvitation.sender;

    // Optimistic update
    dispatch({ type: 'SET_HOST', payload: false });
    dispatch({ 
      type: 'SYNC_STATE', 
      payload: { 
        gameId: gameInvitation.id, 
        stage: GAME_STATES.JOINING,
        partnerId: opponentId,
        players: {
          [userId]: { 
            points: 0, 
            streak: 0, 
            lastType: null,
            name: dbUserRef.current?.name || 'You',
            avatar: dbUserRef.current?.avatar || null
          },
          [opponentId]: { 
            points: 0, 
            streak: 0, 
            lastType: null,
            name: opponentMetadata?.name || 'Opponent',
            avatar: opponentMetadata?.avatar || null
          }
        }
      } 
    });
    
    try {
      // Update database
      const { error: dbError } = await supabase
        .from(DB_TABLES.GAME_INVITATIONS)
        .update({ 
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', gameInvitation.id);

      if (dbError) {
        console.error('Failed to accept game:', dbError);
        toast.error('Failed to join game');
        dispatch({ type: 'RESET' });
        return;
      }

      // Re-announce presence for WebRTC handshake
      await webrtc.reAnnounce?.();

      // Notify host
      sendGameEvent({ 
        type: 'GAME_ACTION', 
        action: { type: 'ACCEPT_GAME', from: userId } 
      });
      
      toast.success('Joining game...');
      
    } catch (err) {
      console.error('Error accepting game:', err);
      toast.error('An error occurred while joining the game');
      dispatch({ type: 'RESET' });
    }
  }, [supabase, webrtc, sendGameEvent, userId]);

  const rejectGame = useCallback(async (gameInvitation) => {
    if (!gameInvitation?.id) {
      dispatch({ type: 'RESET' });
      return;
    }
    
    try {
      const { error } = await supabase
        .from(DB_TABLES.GAME_INVITATIONS)
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', gameInvitation.id);
      
      if (error) {
        console.error('Failed to reject game:', error);
      }
      
      toast.success('Game invitation declined');
    } catch (err) {
      console.error('Error rejecting game:', err);
    } finally {
      dispatch({ type: 'RESET' });
    }
  }, [supabase]);

  const closeGame = useCallback(async () => {
    const currentId = stateRef.current.gameId;
    
    if (currentId) {
      try {
        const { error } = await supabase
          .from(DB_TABLES.GAME_INVITATIONS)
          .update({ 
            status: 'rejected',
            updated_at: new Date().toISOString()
          })
          .eq('id', currentId);
        
        if (error) {
          console.error('Failed to close game:', error);
        }
      } catch (err) {
        console.error('Error closing game:', err);
      }
    }
    
    // Notify peers
    sendGameEvent({ 
      type: 'GAME_UPDATE', 
      gameId: null, 
      gameState: INITIAL_GAME_STATE 
    });
    
    dispatch({ type: 'RESET' });
    clearTimer();
  }, [supabase, sendGameEvent, clearTimer]);

  const joinBattle = useCallback((id, isHost = false, initialStatus = 'pending', partnerId = null, opponentMetadata = null) => {
    if (!id) {
      toast.error('Invalid game ID');
      return;
    }
    
    const stage = isHost 
      ? (initialStatus === 'accepted' ? GAME_STATES.SETUP : GAME_STATES.INVITING)
      : GAME_STATES.JOINING;

    dispatch({ 
      type: 'SYNC_STATE', 
      payload: { 
        gameId: id, 
        isHost, 
        stage,
        partnerId,
        round: stage === GAME_STATES.TURN_ANNOUNCE ? 1 : stateRef.current.round,
        players: partnerId ? {
          [userId]: { 
            points: 0, 
            streak: 0, 
            lastType: null,
            name: dbUserRef.current?.name || 'You', 
            avatar: dbUserRef.current?.avatar || null,
            ...(stateRef.current.players[userId] || {}) 
          },
          [partnerId]: { 
            points: 0, 
            streak: 0, 
            lastType: null,
            name: opponentMetadata?.name || 'Opponent',
            avatar: opponentMetadata?.avatar || null,
            ...(stateRef.current.players[partnerId] || {})
          }
        } : stateRef.current.players
      }
    });

    if (isHost && (stage === GAME_STATES.TURN_ANNOUNCE || stage === GAME_STATES.SETUP)) {
       // Need to ensure partnerId is set for turn logic
       // The host will eventually get this from the DB or sync
       setTimeout(() => {
         if (isMountedRef.current) broadcastState(stateRef.current);
       }, 500);
    }
  }, [broadcastState]);

  // ─── Derived State ─────────────────────────────────────────
  const derived = useMemo(() => {
    const isMyTurn = String(state.turn) === String(userId);
    const isActive = state.stage !== GAME_STATES.IDLE;
    const opponentId = String(state.partnerId) === String(userId) 
      ? Object.keys(state.players).find(id => String(id) !== String(userId)) 
      : state.partnerId;
    
    return { isMyTurn, isActive, opponentId };
  }, [state.stage, state.turn, state.partnerId, state.players, userId]);

  // Game actions
  const pickType = useCallback((val) => handleAction({ type: 'PICK_TYPE', payload: val }), [handleAction]);
  const sendChallenge = useCallback((val) => handleAction({ type: 'SEND_CHALLENGE', payload: val }), [handleAction]);
  const completeTurn = useCallback(() => handleAction({ type: 'COMPLETE_TURN' }), [handleAction]);
  const skipTurn = useCallback(() => handleAction({ type: 'SKIP_TURN' }), [handleAction]);
  const switchType = useCallback(() => handleAction({ type: 'SWITCH_TYPE' }), [handleAction]);
  const confirmSettings = useCallback((s) => handleAction({ type: 'CONFIRM_SETTINGS', payload: s }), [handleAction]);
  const updateSettingsDraft = useCallback((s) => handleAction({ type: 'UPDATE_SETTINGS_DRAFT', payload: s }), [handleAction]);
  const completeSpin = useCallback((winnerId) => handleAction({ type: 'COMPLETE_SPIN', payload: winnerId }), [handleAction]);
  const startSpin = useCallback((data) => handleAction({ type: 'START_SPIN', payload: data }), [handleAction]);
  const askTD = useCallback(() => handleAction({ type: 'ASK_TD' }), [handleAction]);

  // ─── Public API ────────────────────────────────────────────
  return {
    gameState: state,
    isHost: state.isHost,
    ...derived,
    
    // Database operations
    startGame,
    acceptGame,
    rejectGame,
    closeGame,
    joinBattle,
    
    // Game actions
    pickType,
    sendChallenge,
    completeTurn,
    skipTurn,
    switchType,
    confirmSettings,
    updateSettingsDraft,
    completeSpin,
    startSpin,
    askTD,
    
    // WebRTC
    webrtc
  };
};