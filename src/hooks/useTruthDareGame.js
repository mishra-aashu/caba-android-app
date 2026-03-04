import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { prepareDataForDB } from '../utils/dbSchemaCompatibility';
import { useWebRTC } from '../services/game-webrtc/useWebRTC';

export const useTruthDareGame = (roomId, userId, { enabled = true } = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [gameState, setGameState] = useState({
    turn: null,
    stage: 'idle', // 'idle' | 'inviting' | 'accepted' | 'deciding_turn' | 'picking' | 'writing' | 'performing'
    type: null,
    content: '',
    winnerId: null, // To store who the spinner picked
  });
  const [isHost, setIsHost] = useState(false);
  const isHostRef = useRef(isHost);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // 1. Initialize WebRTC
  const handleDataReceived = useCallback((from, data) => {
    if (data.type === 'GAME_UPDATE') {
      // Clients receive authoritative state from Host
      setGameState(data.gameState);
      setGameId(data.gameId);
      if (data.gameState.stage !== 'idle') {
        setIsOpen(true);
      }
    } else if (data.type === 'GAME_EVENT' && isHostRef.current) {
      handleClientEvent(from, data.event);
    } else if (data.type === 'SPIN_RESULT') {
      // Both receive the result, but wait for animation
      setGameState(prev => ({ ...prev, winnerId: data.winnerId }));
      stateRef.current = { ...stateRef.current, winnerId: data.winnerId };

      // Auto transition to picking after animation delay (handled in UI or here)
      setTimeout(() => {
        const nextState = {
          ...stateRef.current,
          stage: 'picking',
          turn: data.winnerId,
          type: null,
          content: ''
        };
        setGameState(nextState);
        stateRef.current = nextState;
      }, 4000); // 4s for spin animation
    }
  }, []); // Stable callback

  const { connectToPeer, sendData } = useWebRTC(roomId, userId, handleDataReceived);

  const handleClientEvent = (from, event) => {
    if (!isHostRef.current) return;
    let newState = { ...stateRef.current };

    switch (event.type) {
      case 'PICK_TYPE':
        newState = { ...newState, type: event.payload, stage: 'writing' };
        break;
      case 'SEND_CHALLENGE':
        newState = { ...newState, content: event.payload, stage: 'performing' };
        break;
      case 'COMPLETE_TURN':
        newState = {
          ...newState,
          turn: from,
          stage: 'picking',
          type: null,
          content: ''
        };
        break;
      case 'JOIN_BATTLE':
        newState = { ...newState, stage: 'deciding_turn' };
        break;
      case 'TRIGGER_SPIN':
        const players = [userId, newState.partnerId];
        const winner = players[Math.floor(Math.random() * players.length)];
        newState = { ...newState, stage: 'deciding_turn', winnerId: winner };
        // Broadcast spin result specifically
        sendData({ type: 'SPIN_RESULT', winnerId: winner });
        break;
      default:
        break;
    }

    // Host updates local state and broadcasts
    setGameState(newState);
    sendData({ type: 'GAME_UPDATE', gameId: gameIdRef.current, gameState: newState });
  };

  // Keep track of the current turn and gameId in refs for logic
  const stateRef = useRef(gameState);
  const gameIdRef = useRef(gameId);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  const fetchActiveGame = useCallback(async () => {
    if (!roomId || !userId) return;
    try {
      const { data, error } = await supabase
        .from('game_invitations')
        .select('*')
        .eq('chat_id', roomId)
        .in('status', ['pending', 'accepted'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        setGameId(data.id);
        gameIdRef.current = data.id;

        if (data.invitation_data) {
          let updatedState = { ...data.invitation_data };

          if (data.status === 'accepted' && updatedState.stage === 'inviting') {
            updatedState.stage = 'picking';
          }

          setGameState(updatedState);
          stateRef.current = updatedState;

          const amIHost = data.sender_id === userId;
          setIsHost(amIHost);
          isHostRef.current = amIHost;

          if (data.status === 'accepted') {
            setIsOpen(true);
          }

          const partnerId = amIHost ? data.receiver_id : data.sender_id;
          connectToPeer(partnerId);
        }
      }
    } catch (err) {
      console.error('Error fetching active game:', err);
    }
  }, [roomId, userId, connectToPeer]);

  useEffect(() => {
    if (enabled) {
      fetchActiveGame();
    }
  }, [enabled, fetchActiveGame]);

  useEffect(() => {
    if (!roomId) return;

    // We still listen for DB changes for NEW games (Initial Handshake)
    const channel = supabase
      .channel(`game_init_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_invitations',
        filter: `chat_id=eq.${roomId}`
      }, (payload) => {
        const { new: newGame } = payload;
        if (newGame.invitation_data) {
          const amISender = newGame.sender_id === userId;

          setGameId(newGame.id);
          gameIdRef.current = newGame.id;
          setGameState(newGame.invitation_data);
          stateRef.current = newGame.invitation_data;
          setIsHost(amISender);
          isHostRef.current = amISender;

          // Auto-open only for Host/Sender (they are in the 'inviting' screen)
          // Or if it's already accepted (e.g., re-joining)
          if (amISender || newGame.status === 'accepted') {
            setIsOpen(true);
          }

          // Connect to peer for WebRTC
          const partnerId = amISender ? newGame.receiver_id : newGame.sender_id;
          connectToPeer(partnerId);
        }
      })
      .subscribe();

    // Listen for UPDATES (Acceptance)
    const updateChannel = supabase
      .channel(`game_update_${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_invitations',
        filter: `chat_id=eq.${roomId}`
      }, (payload) => {
        const { new: updatedGame } = payload;
        if (updatedGame.status === 'accepted' && updatedGame.id === gameIdRef.current) {
          if (isHostRef.current) {
            // Host sees confirmation screen
            const newState = { ...stateRef.current, stage: 'accepted' };
            setGameState(newState);
            stateRef.current = newState;
          } else {
            // Receiver goes straight to spinner/waiting
            const newState = { ...stateRef.current, stage: 'deciding_turn' };
            setGameState(newState);
            stateRef.current = newState;
          }
          setIsOpen(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(updateChannel);
    };
  }, [roomId, userId, connectToPeer]);

  const syncGame = useCallback((newId, newState) => {
    // 1. Host updates context
    setGameId(newId);
    gameIdRef.current = newId;
    setGameState(newState);
    stateRef.current = newState;

    // 2. Broadcast authoritative state via WebRTC
    sendData({ type: 'GAME_UPDATE', gameId: newId, gameState: newState });

    // NO DATABASE UPDATES FOR GAMEPLAY EVENTS (User Rule)
  }, [sendData]);

  // --- ACTIONS WITH TURN VALIDATION ---

  const startGame = useCallback(async (partnerId) => {
    setIsOpen(true);
    setIsHost(true);
    const initialState = {
      turn: userId,
      stage: 'inviting', // Start in inviting mode
      type: null,
      content: '',
      partnerId: partnerId || userId
    };

    // We only use DB to INITIATE the game session (Initial signaling/handshake)
    const invitation = prepareDataForDB({
      chat_id: roomId,
      sender_id: userId,
      receiver_id: partnerId || userId,
      game_type: 'truth_or_dare',
      invitation_data: initialState,
      status: 'pending'
    }, 'game_invitations');

    const { data, error } = await supabase
      .from('game_invitations')
      .insert(invitation)
      .select()
      .single();

    if (!error && data) {
      setGameId(data.id);
      gameIdRef.current = data.id;
      setGameState(initialState);
      stateRef.current = initialState;
      connectToPeer(partnerId);

      // Send a specialized chat message for the invitation
      await supabase.from('messages').insert({
        chat_id: roomId,
        sender_id: userId,
        receiver_id: partnerId,
        content: `I invited you to play Truth or Dare!`,
        message_type: 'game_invite',
        metadata: {
          invitationId: data.id,
          gameType: 'truth_or_dare',
          status: 'pending'
        }
      });
    }
  }, [userId, roomId, connectToPeer]);

  const pickType = useCallback((type) => {
    // SECURITY: Ensure it's your turn
    if (stateRef.current.turn !== userId) return;

    if (isHost) {
      const newState = { ...stateRef.current, type, stage: 'writing' };
      syncGame(gameIdRef.current, newState);
    } else {
      // Client sends event to Host
      sendData({ type: 'GAME_EVENT', event: { type: 'PICK_TYPE', payload: type } });
    }
  }, [isHost, userId, sendData, syncGame]);

  const sendChallenge = useCallback((text) => {
    // SECURITY: Ensure it's your turn
    if (stateRef.current.turn !== userId) return;

    if (isHost) {
      const newState = { ...stateRef.current, content: text, stage: 'performing' };
      syncGame(gameIdRef.current, newState);
    } else {
      // Client sends event to Host
      sendData({ type: 'GAME_EVENT', event: { type: 'SEND_CHALLENGE', payload: text } });
    }
  }, [isHost, userId, sendData, syncGame]);

  const completeTurn = useCallback(() => {
    if (stateRef.current.stage !== 'performing') return;
    if (stateRef.current.turn === userId) return; // Challenger cannot complete their own set task

    if (isHost) {
      const newState = {
        ...stateRef.current,
        turn: userId, // Host completed it
        stage: 'picking',
        type: null,
        content: ''
      };
      syncGame(gameIdRef.current, newState);
    } else {
      // Client sends event to Host
      sendData({ type: 'GAME_EVENT', event: { type: 'COMPLETE_TURN' } });
    }
  }, [isHost, userId, sendData, syncGame]);

  const closeGame = useCallback(async () => {
    setIsOpen(false);
    const idleState = { turn: null, stage: 'idle', type: null, content: '' };

    if (gameId) {
      await supabase
        .from('game_invitations')
        .update({ status: 'completed' })
        .eq('id', gameId);

      // Also try to update the chat message if we can find it
      try {
        await supabase
          .from('messages')
          .update({
            content: 'Battle Finished. 🏁',
            metadata: {
              status: 'completed',
              invitationId: gameId,
              gameType: 'truth_or_dare'
            },
            updated_at: new Date().toISOString()
          })
          .contains('metadata', { invitationId: gameId });
      } catch (e) {
        console.warn('Could not update message on close:', e);
      }
    }

    syncGame(null, idleState);
  }, [gameId, syncGame]);

  const acceptGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const { error: invError } = await supabase
        .from('game_invitations')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', gameId);

      if (invError) throw invError;

      // Receiver goes straight to waiting for spin
      const newState = { ...stateRef.current, stage: 'deciding_turn' };
      setGameState(newState);
      stateRef.current = newState;
      setIsOpen(true);

      // Try to update the chat message as well
      try {
        await supabase
          .from('messages')
          .update({
            content: 'Battle Accepted! Prepare for combat. 🔥',
            metadata: {
              status: 'accepted',
              invitationId: gameId,
              gameType: 'truth_or_dare'
            },
            updated_at: new Date().toISOString()
          })
          .contains('metadata', { invitationId: gameId });
      } catch (e) {
        console.warn('Could not update message on accept:', e);
      }
    } catch (error) {
      console.error('Error accepting game in hook:', error);
    }
  }, [gameId]);

  const rejectGame = useCallback(async () => {
    if (!gameId) return;
    try {
      await supabase
        .from('game_invitations')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', gameId);

      const idleState = { turn: null, stage: 'idle', type: null, content: '' };
      setGameState(idleState);
      stateRef.current = idleState;
      setIsOpen(false);
      setGameId(null);
      gameIdRef.current = null;

      // Try to update the chat message
      try {
        await supabase
          .from('messages')
          .update({
            content: 'Battle Declined. ❌',
            metadata: {
              status: 'rejected',
              invitationId: gameId,
              gameType: 'truth_or_dare'
            },
            updated_at: new Date().toISOString()
          })
          .filter('metadata->>invitationId', 'eq', gameId);
      } catch (e) {
        console.warn('Could not update message on reject:', e);
      }
    } catch (error) {
      console.error('Error rejecting game in hook:', error);
    }
  }, [gameId]);

  const joinBattle = useCallback(() => {
    if (!isHost) return;
    const newState = { ...stateRef.current, stage: 'deciding_turn' };
    syncGame(gameId, newState);
  }, [isHost, gameId, syncGame]);

  const startSpin = useCallback(() => {
    if (!isHost) return;
    handleClientEvent(userId, { type: 'TRIGGER_SPIN' });
  }, [isHost, userId]);

  return {
    isOpen,
    gameState,
    gameId,
    isHost,
    startGame,
    pickType,
    sendChallenge,
    completeTurn,
    closeGame,
    acceptGame,
    rejectGame,
    joinBattle,
    startSpin,
    setIsOpen,
  };
};