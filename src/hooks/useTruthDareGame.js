// hooks/useTruthDareGame.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { realtimeManager } from '../utils/realtimeManager';
import { prepareDataForDB } from '../utils/dbSchemaCompatibility';

export const useTruthDareGame = (roomId, userId) => {
  const [isOpen, setIsOpen] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [gameState, setGameState] = useState({
    turn: null,
    stage: 'idle',
    type: null,
    content: '',
  });

  // 1. Initial Load: Fetch active/pending game for this room
  useEffect(() => {
    if (!roomId || !userId) return;

    const fetchActiveGame = async () => {
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
          if (data.invitation_data) {
            setGameState(data.invitation_data);
            if (data.status === 'accepted' || data.invitation_data.stage !== 'idle') {
              // Only auto-open if it's already in progress
              // setIsOpen(true); 
            }
          }
        }
      } catch (err) {
        console.error('Error fetching active game:', err);
      }
    };

    fetchActiveGame();
  }, [roomId, userId]);

  // 2. Real-time Subscription
  useEffect(() => {
    if (!roomId) return;

    const channelName = `game_room_${roomId}`;

    realtimeManager.subscribe(
      channelName,
      {},
      {
        broadcast: {
          event: 'game_update',
          callback: ({ payload }) => {
            setGameState(payload.gameState);
            setGameId(payload.gameId);
            if (payload.gameState.stage !== 'idle') {
              setIsOpen(true);
            }
          }
        },
        postgres_changes: [
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'game_invitations',
            filter: `chat_id=eq.${roomId}`,
            handler: (payload) => {
              if (payload.new.invitation_data) {
                setGameState(payload.new.invitation_data);
                setGameId(payload.new.id);
              }
            }
          }
        ]
      }
    );

    return () => {
      realtimeManager.unsubscribe(channelName);
    };
  }, [roomId]);

  // Helper: Persist and Broadcast
  const syncGame = useCallback(async (newId, newState) => {
    setGameId(newId);
    setGameState(newState);

    // 1. Broadcast for instant UI (Transient)
    const channel = supabase.channel(`game_room_${roomId}`);
    await channel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: { gameId: newId, gameState: newState },
    });

    // 2. Update DB (Persistent)
    if (newId) {
      await supabase
        .from('game_invitations')
        .update({
          invitation_data: newState,
          updated_at: new Date().toISOString()
        })
        .eq('id', newId);
    }
  }, [roomId]);

  // Actions
  const startGame = useCallback(async (partnerId) => {
    setIsOpen(true);
    const initialState = { turn: userId, stage: 'picking', type: null, content: '' };

    // Create new invitation in DB
    const invitation = prepareDataForDB({
      chat_id: roomId,
      sender_id: userId,
      receiver_id: partnerId || userId, // Fallback to self for group/testing
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
      syncGame(data.id, initialState);
    } else {
      console.error('Failed to persist game start:', error);
      // Fallback to transient only if DB fails
      syncGame(null, initialState);
    }
  }, [userId, roomId, syncGame]);

  const pickType = useCallback((type) => {
    const newState = { ...gameState, type, stage: 'writing' };
    syncGame(gameId, newState);
  }, [gameState, gameId, syncGame]);

  const sendChallenge = useCallback((text) => {
    const newState = { ...gameState, content: text, stage: 'performing' };
    syncGame(gameId, newState);
  }, [gameState, gameId, syncGame]);

  const completeTurn = useCallback((partnerId) => {
    const newState = { turn: partnerId, stage: 'picking', type: null, content: '' };
    syncGame(gameId, newState);
  }, [gameId, syncGame]);

  const closeGame = useCallback(async () => {
    setIsOpen(false);
    const idleState = { turn: null, stage: 'idle', type: null, content: '' };

    // Mark as completed in DB if it was active
    if (gameId) {
      await supabase
        .from('game_invitations')
        .update({ status: 'completed' })
        .eq('id', gameId);
    }

    syncGame(null, idleState);
  }, [gameId, syncGame]);

  return {
    isOpen,
    gameState,
    gameId,
    startGame,
    pickType,
    sendChallenge,
    completeTurn,
    closeGame,
    setIsOpen,
  };
};