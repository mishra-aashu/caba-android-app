import { useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import { TRUTHS, DARES, DB_TABLES, SCORING, GAME_MODES } from '../constants/gameData';
import useWebRTCRoom from './useWebRTCRoom';

export const GAME_STATES = {
  IDLE: 'idle',
  INVITING: 'inviting',
  JOINING: 'joining',
  ACCEPTED: 'accepted',
  SETUP: 'setup',
  TURN_ANNOUNCE: 'turn-announce',
  TURN_CHOOSING: 'turn-choosing',
  TURN_CHALLENGE: 'turn-challenge',
  TURN_RESPONDING: 'turn-responding',
  TURN_VOTING: 'turn-voting',
  TURN_RESULT: 'turn-result',
  GAME_OVER: 'game-over'
};

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
  players: {},
  winnerId: null,
  partnerId: null,
  votes: {},
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'SYNC_STATE':
      // ROOT FIX: Never overwrite local isHost with network data
      const { isHost, ...rest } = action.payload;
      return { ...state, ...rest };
    
    case 'SET_HOST':
      return { ...state, isHost: action.payload };

    case 'UPDATE_GAME_ID':
      return { ...state, gameId: action.payload };

    case 'TRANSITION':
      return { 
        ...state, 
        ...(action.payload || {}),
        stage: action.stage,
        // Reset turn-specific data on new turn announce
        ...(action.stage === GAME_STATES.TURN_ANNOUNCE ? {
          type: null,
          content: '',
          votes: {}
        } : {})
      };

    case 'RESET':
      return INITIAL_GAME_STATE;

    default:
      return state;
  }
}

export const useTruthDareGame = (roomId, userId, supabase) => {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_GAME_STATE);
  const stateRef = useRef(state);
  const timerRef = useRef(null);

  // Sync ref to current state
  useEffect(() => { stateRef.current = state; }, [state]);
  
  // WebRTC Core
  const webrtc = useWebRTCRoom({ 
    roomId, 
    userId, 
    userName: 'Player',
    supabase 
  });

  const { sendGameEvent, lastGameEvent, lastPeerId } = webrtc;

  // --- Helpers ---
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const broadcastState = useCallback((newState) => {
    // console.log("📡 [Host] Broadcasting game update:", newState.stage);
    sendGameEvent({ 
      type: 'GAME_UPDATE', 
      gameId: newState.gameId, 
      gameState: newState 
    });
  }, [sendGameEvent]);

  // --- Scoring Engine (Pure Function) ---
  const calculateScores = (players, targetId, actionType, bonus = 0) => {
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
  };

  // --- Central Transition Logic (Host Only) ---
  const hostTransition = useCallback((nextStage, extra = {}) => {
    const current = stateRef.current;
    if (!current.isHost) return;
    clearTimer();

    let nextState = { ...current, ...extra, stage: nextStage };

    if (nextStage === GAME_STATES.TURN_ANNOUNCE) {
      nextState.type = null;
      nextState.content = '';
      timerRef.current = setTimeout(() => hostTransition(GAME_STATES.TURN_CHOOSING), 2500);
    }

    if (nextStage === GAME_STATES.TURN_RESULT) {
      timerRef.current = setTimeout(() => {
        const isFinalTurn = current.turn === current.partnerId;
        const isLastRound = current.round >= current.maxRounds;

        if (isFinalTurn && isLastRound) {
          hostTransition(GAME_STATES.GAME_OVER);
        } else {
          hostTransition(GAME_STATES.TURN_ANNOUNCE, {
            round: isFinalTurn ? current.round + 1 : current.round,
            turn: current.turn === userId ? current.partnerId : userId
          });
        }
      }, 3000);
    }

    if (nextStage === GAME_STATES.GAME_OVER) {
      const winner = Object.entries(current.players).reduce((prev, [id, p]) => 
        (p.points > (prev?.points || -1)) ? { id, ...p } : prev, null);
      nextState.winnerId = winner?.id;
    }

    dispatch({ type: 'SYNC_STATE', payload: nextState });
    broadcastState(nextState);
  }, [userId, clearTimer, broadcastState]);

  // --- Client Event Handler ---
  const handleAction = useCallback((action) => {
    const current = stateRef.current;
    if (current.isHost) {
      // Host processes immediately
      let nextState = { ...current };
      
      switch (action.type) {
        case 'PICK_TYPE':
          nextState.type = action.payload;
          nextState.stage = GAME_STATES.TURN_CHALLENGE;
          break;
        case 'SEND_CHALLENGE':
          nextState.content = action.payload;
          nextState.stage = GAME_STATES.TURN_RESPONDING;
          break;
        case 'COMPLETE_TURN':
          nextState.players = calculateScores(current.players, action.from, current.type);
          dispatch({ type: 'SYNC_STATE', payload: nextState });
          hostTransition(GAME_STATES.TURN_RESULT, { players: nextState.players });
          return;
        case 'SKIP_TURN':
          nextState.players = calculateScores(current.players, action.from, 'SKIP');
          dispatch({ type: 'SYNC_STATE', payload: nextState });
          hostTransition(GAME_STATES.TURN_RESULT, { players: nextState.players });
          return;
        case 'SWITCH_TYPE':
          nextState.type = current.type === 'truth' ? 'dare' : 'truth';
          nextState.players = calculateScores(current.players, action.from, 'SWITCH');
          nextState.stage = GAME_STATES.TURN_CHALLENGE;
          break;
        case 'CONFIRM_SETTINGS':
          nextState = { ...nextState, ...action.payload };
          dispatch({ type: 'SYNC_STATE', payload: nextState });
          hostTransition(GAME_STATES.TURN_ANNOUNCE, action.payload);
          return;
        case 'ACCEPT_GAME':
          // Host should transition to SETUP if game is fresh, otherwise just broadcast current state
          if (current.stage === GAME_STATES.INVITING || current.stage === GAME_STATES.IDLE) {
            hostTransition(GAME_STATES.TURN_ANNOUNCE, { round: 1 });
          } else {
            broadcastState(current);
          }
          return;
      }

      dispatch({ type: 'SYNC_STATE', payload: nextState });
      broadcastState(nextState);
    } else {
      // Client sends to host
      // console.log("📲 [Client] Sending action to host:", action.type);
      sendGameEvent({ type: 'GAME_ACTION', action: { ...action, from: userId } });
    }
  }, [userId, hostTransition, broadcastState, sendGameEvent]);

  // --- Realtime Sync Effects ---
  useEffect(() => {
    if (!lastGameEvent) return;

    if (lastGameEvent.type === 'GAME_UPDATE') {
      // Deep comparison to prevent redundant state updates
      const isSameState = JSON.stringify(lastGameEvent.gameState) === JSON.stringify(stateRef.current);
      if (!isSameState) {
        // console.log("📥 [Client] Received game update:", lastGameEvent.gameState.stage);
        dispatch({ type: 'SYNC_STATE', payload: lastGameEvent.gameState });
      }
    } else if (lastGameEvent.type === 'GAME_ACTION' && stateRef.current.isHost) {
      // console.log("📥 [Host] Received client action:", lastGameEvent.action.type);
      handleAction(lastGameEvent.action);
    } else if (lastGameEvent.type === 'SYNC_REQUEST' && stateRef.current.isHost) {
      broadcastState(stateRef.current);
    }
  }, [lastGameEvent, handleAction, broadcastState]);

  // Request sync if stuck in joining
  useEffect(() => {
    if (state.stage === GAME_STATES.JOINING && !state.isHost) {
      // console.log("🔄 [Client] Stuck in JOINING, requesting sync...");
      sendGameEvent({ type: 'SYNC_REQUEST' }); // Send immediately
      
      const interval = setInterval(() => {
        sendGameEvent({ type: 'SYNC_REQUEST' });
      }, 2000); // Faster interval for joining
      return () => clearInterval(interval);
    }
  }, [state.stage, state.isHost, sendGameEvent]);

  // Broadcast state updates (Host only)
  useEffect(() => {
    if (state.isHost) {
      broadcastState(state);
    }
  }, [state.isHost, broadcastState]); // Only broadcast on manual actions or role change

  // --- Public DB Actions (Centralized) ---
  const startGame = async (targetPartnerId) => {
    dispatch({ type: 'SET_HOST', payload: true });
    
    const { data, error } = await supabase
      .from(DB_TABLES.GAME_INVITATIONS)
      .insert({
        chat_id: roomId,
        sender_id: userId,
        receiver_id: targetPartnerId,
        game_type: 'truth_or_dare',
        status: 'pending'
      })
      .select().single();

    if (error) return { success: false, error };

    const startState = {
      ...INITIAL_GAME_STATE,
      gameId: data.id,
      isHost: true,
      stage: GAME_STATES.INVITING,
      turn: userId,
      partnerId: targetPartnerId,
      players: {
        [userId]: { points: 0, streak: 0 },
        [targetPartnerId]: { points: 0, streak: 0 }
      }
    };

    dispatch({ type: 'SYNC_STATE', payload: startState });
    broadcastState(startState);
    return { success: true, gameId: data.id };
  };

  const acceptGame = async (gameInvitation) => {
    if (!gameInvitation?.id) return;

    dispatch({ type: 'SET_HOST', payload: false });
    dispatch({ type: 'SYNC_STATE', payload: { gameId: gameInvitation.id, stage: GAME_STATES.JOINING } });
    
    try {
      const { error } = await supabase.from(DB_TABLES.GAME_INVITATIONS)
        .update({ status: 'accepted' })
        .eq('id', gameInvitation.id);

      if (error) {
        // Log the full PostgREST error to diagnose RLS / schema issues
        console.error("❌ Failed to accept game in DB:", error.message, error.details, error.hint, error);
        return;
      }

      sendGameEvent({ type: 'GAME_ACTION', action: { type: 'ACCEPT_GAME', from: userId } });
    } catch (err) {
      console.error("❌ Error in acceptGame logic:", err);
    }
  };

  const closeGame = async () => {
    const currentId = stateRef.current.gameId;
    if (currentId) {
      try {
        const { error } = await supabase.from(DB_TABLES.GAME_INVITATIONS)
          .update({ status: 'rejected' })
          .eq('id', currentId);
        if (error) console.error("❌ Error closing game in DB:", error.message, error.details, error);
      } catch (err) {
        console.error("❌ Error closing game in DB:", err);
      }
    }
    dispatch({ type: 'RESET' });
    sendGameEvent({ type: 'GAME_UPDATE', gameId: null, gameState: INITIAL_GAME_STATE });
  };

  const rejectGame = async (gameInvitation) => {
    if (!gameInvitation?.id) return;
    
    try {
      const { error } = await supabase.from(DB_TABLES.GAME_INVITATIONS)
        .update({ status: 'rejected' })
        .eq('id', gameInvitation.id);
      
      if (error) console.error("❌ Failed to reject game in DB:", error.message, error.details, error);
    } catch (err) {
      console.error("❌ Error in rejectGame logic:", err);
    }
    // ROOT FIX: Reset local state so the UI clears immediately
    dispatch({ type: 'RESET' });
  };

  // --- Derived State ---
  const derived = useMemo(() => ({
    isMyTurn: state.turn === userId,
    isActive: state.stage !== GAME_STATES.IDLE,
    opponentId: state.partnerId === userId ? Object.keys(state.players).find(id => id !== userId) : state.partnerId
  }), [state.stage, state.turn, state.partnerId, state.players, userId]);

  return {
    gameState: state,
    isHost: state.isHost,
    ...derived,
    startGame,
    acceptGame,
    closeGame,
    rejectGame,
    joinBattle: (id, isHost = false) => {
      dispatch({ type: 'SYNC_STATE', payload: { 
        gameId: id, 
        isHost, 
        stage: isHost ? GAME_STATES.INVITING : GAME_STATES.JOINING 
      }});
    },
    pickType: (val) => handleAction({ type: 'PICK_TYPE', payload: val }),
    sendChallenge: (val) => handleAction({ type: 'SEND_CHALLENGE', payload: val }),
    completeTurn: () => handleAction({ type: 'COMPLETE_TURN' }),
    skipTurn: () => handleAction({ type: 'SKIP_TURN' }),
    switchType: () => handleAction({ type: 'SWITCH_TYPE' }),
    confirmSettings: (s) => handleAction({ type: 'CONFIRM_SETTINGS', payload: s }),
    webrtc
  };
};
