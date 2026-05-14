import { useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import useWebRTCRoom from './useWebRTCRoom';
import toast from 'react-hot-toast';
import { DB_TABLES } from '../constants/gameData';

export const CHESS_STATES = {
  IDLE: 'idle',
  INVITING: 'inviting',
  JOINING: 'joining',
  PLAYING: 'playing',
  GAME_OVER: 'game-over'
};

const INITIAL_CHESS_STATE = {
  stage: CHESS_STATES.IDLE,
  gameId: null,
  fen: 'start',
  turn: 'w', // 'w' or 'b'
  players: {}, // { [id]: { side: 'w' | 'b', name: '', avatar: '' } }
  history: [],
  winner: null,
  isHost: false,
  partnerId: null,
};

function chessReducer(state, action) {
  switch (action.type) {
    case 'SYNC_STATE':
      return { ...state, ...action.payload };
    case 'SET_HOST':
      return { ...state, isHost: action.payload };
    case 'UPDATE_FEN':
      return { ...state, fen: action.fen, turn: action.turn, history: [...state.history, action.move] };
    case 'GAME_OVER':
      return { ...state, stage: CHESS_STATES.GAME_OVER, winner: action.winner };
    case 'RESET':
      return { ...INITIAL_CHESS_STATE };
    default:
      return state;
  }
}

export const useChessGame = (roomId, dbUser, supabase) => {
  const userId = dbUser?.id;
  const [state, dispatch] = useReducer(chessReducer, INITIAL_CHESS_STATE);
  const stateRef = useRef(state);
  const chessRef = useRef(new Chess());

  useEffect(() => {
    stateRef.current = state;
    if (state.fen && state.fen !== 'start') {
        try {
            chessRef.current.load(state.fen);
        } catch (e) {
            console.error('Invalid FEN:', state.fen);
        }
    } else if (state.fen === 'start') {
        chessRef.current.reset();
    }
  }, [state.fen]);

  const webrtc = useWebRTCRoom({ roomId, userId, userName: dbUser?.name, supabase });
  const { sendGameEvent, lastGameEvent } = webrtc;

  const broadcastState = useCallback((newState) => {
    const { isHost, ...payload } = newState;
    sendGameEvent({ type: 'CHESS_UPDATE', gameState: payload });
  }, [sendGameEvent]);

  useEffect(() => {
    if (!lastGameEvent) return;
    if (lastGameEvent.type === 'CHESS_UPDATE' && !stateRef.current.isHost) {
      dispatch({ type: 'SYNC_STATE', payload: lastGameEvent.gameState });
    } else if (lastGameEvent.type === 'CHESS_MOVE' && stateRef.current.isHost) {
      handleMove(lastGameEvent.move);
    } else if (lastGameEvent.type === 'SYNC_REQUEST' && stateRef.current.isHost) {
        broadcastState(stateRef.current);
    }
  }, [lastGameEvent]);

  const handleMove = useCallback((move) => {
    const game = chessRef.current;
    try {
      const result = game.move(move);
      if (result) {
        const newState = {
          ...stateRef.current,
          fen: game.fen(),
          turn: game.turn(),
          history: [...stateRef.current.history, move]
        };
        
        if (game.isGameOver()) {
          newState.stage = CHESS_STATES.GAME_OVER;
          newState.winner = game.isCheckmate() ? (game.turn() === 'w' ? 'b' : 'w') : 'draw';
        }

        dispatch({ type: 'SYNC_STATE', payload: newState });
        if (stateRef.current.isHost) {
          broadcastState(newState);
        }
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }, [broadcastState]);

  const makeMove = useCallback((move) => {
    if (state.stage !== CHESS_STATES.PLAYING) return false;
    
    // Check if it's my turn
    const mySide = state.players[userId]?.side;
    if (state.turn !== mySide) {
        toast.error("It's not your turn!");
        return false;
    }

    if (state.isHost) {
      return handleMove(move);
    } else {
      // Validate locally before sending to host
      try {
        const testGame = new Chess();
        if (state.fen && state.fen !== 'start') {
            testGame.load(state.fen);
        }
        const result = testGame.move(move);
        if (result) {
          sendGameEvent({ type: 'CHESS_MOVE', move });
          return true;
        }
      } catch (e) {
        return false;
      }
      return false;
    }
  }, [state.stage, state.turn, state.players, userId, state.isHost, handleMove, sendGameEvent, state.fen]);

  const startGame = useCallback(async (targetPartnerId) => {
    dispatch({ type: 'SET_HOST', payload: true });
    try {
      const { data, error } = await supabase
        .from(DB_TABLES.GAME_INVITATIONS)
        .insert({
          chat_id: roomId,
          sender_id: userId,
          receiver_id: targetPartnerId,
          game_type: 'chess',
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const startState = {
        ...INITIAL_CHESS_STATE,
        gameId: data.id,
        isHost: true,
        stage: CHESS_STATES.INVITING,
        partnerId: targetPartnerId,
        players: {
          [userId]: { side: 'w', name: dbUser?.name, avatar: dbUser?.avatar },
          [targetPartnerId]: { side: 'b', name: 'Opponent', avatar: null }
        }
      };

      dispatch({ type: 'SYNC_STATE', payload: startState });
      broadcastState(startState);
      return { success: true };
    } catch (err) {
      toast.error('Failed to start chess game');
      return { success: false };
    }
  }, [userId, roomId, supabase, dbUser, broadcastState]);

  const acceptGame = useCallback(async (invite) => {
    dispatch({ type: 'SET_HOST', payload: false });
    dispatch({
        type: 'SYNC_STATE',
        payload: {
            gameId: invite.id,
            stage: CHESS_STATES.JOINING,
            partnerId: invite.sender_id,
            players: {
                [userId]: { side: 'b', name: dbUser?.name, avatar: dbUser?.avatar },
                [invite.sender_id]: { side: 'w', name: invite.sender?.name, avatar: invite.sender?.avatar }
            }
        }
    });

    await supabase.from(DB_TABLES.GAME_INVITATIONS)
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', invite.id);

    sendGameEvent({ type: 'SYNC_REQUEST' });
  }, [userId, dbUser, supabase, sendGameEvent]);

  const joinBattle = useCallback((id, isHost = false, initialStatus = 'pending', partnerId = null, opponentMetadata = null) => {
    const stage = isHost 
      ? (initialStatus === 'accepted' ? CHESS_STATES.PLAYING : CHESS_STATES.INVITING)
      : CHESS_STATES.JOINING;

    dispatch({
      type: 'SYNC_STATE',
      payload: {
        gameId: id,
        isHost,
        stage,
        partnerId,
        players: {
            [userId]: { side: isHost ? 'w' : 'b', name: dbUser?.name, avatar: dbUser?.avatar },
            [partnerId]: { side: isHost ? 'b' : 'w', name: opponentMetadata?.name || 'Opponent', avatar: opponentMetadata?.avatar }
        }
      }
    });
  }, [userId, dbUser]);

  return {
    gameState: state,
    makeMove,
    startGame,
    acceptGame,
    joinBattle,
    closeGame: () => {
        dispatch({ type: 'RESET' });
        sendGameEvent({ type: 'CHESS_UPDATE', gameState: INITIAL_CHESS_STATE });
    },
    isActive: state.stage !== CHESS_STATES.IDLE,
    webrtc
  };
};
