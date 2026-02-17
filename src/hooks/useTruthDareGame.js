// hooks/useTruthDareGame.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';

export const useTruthDareGame = (roomId, userId) => {
  const [isOpen, setIsOpen] = useState(false);
  const [gameState, setGameState] = useState({
    turn: null,
    stage: 'idle', 
    type: null,
    content: '',
  });

  const channelRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;

    // Create channel inside useEffect
    const channel = supabase.channel(`game_room_${roomId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'game_update' }, ({ payload }) => {
        console.log('Received game update:', payload);
        setGameState(payload);
        if (payload.stage !== 'idle') {
          setIsOpen(true);
        }
      })
      .subscribe((status) => {
        console.log('Game channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId]);

  // Update Game State & Broadcast to Partner
  const updateGame = useCallback(async (newState) => {
    setGameState(newState);
    
    // Create a fresh channel for sending (like typing indicator)
    const channel = supabase.channel(`game_room_${roomId}`);
    await channel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: newState,
    });
    // Don't wait for subscribe - send directly
    // Clean up after a delay
    setTimeout(() => supabase.removeChannel(channel), 5000);
  }, [roomId]);

  // Actions
  const startGame = useCallback(() => {
    console.log('Starting game with userId:', userId);
    setIsOpen(true);
    const initialState = { turn: userId, stage: 'picking', type: null, content: '' };
    setGameState(initialState);
    
    // Send update after a short delay
    setTimeout(() => {
      updateGame(initialState);
    }, 100);
  }, [userId, updateGame]);

  const pickType = useCallback((type) => {
    const newState = { ...gameState, type, stage: 'writing' };
    setGameState(newState);
    updateGame(newState);
  }, [gameState, updateGame]);

  const sendChallenge = useCallback((text) => {
    const newState = { ...gameState, content: text, stage: 'performing' };
    setGameState(newState);
    updateGame(newState);
  }, [gameState, updateGame]);

  const completeTurn = useCallback((partnerId) => {
    const newState = { turn: partnerId, stage: 'picking', type: null, content: '' };
    setGameState(newState);
    updateGame(newState);
  }, [updateGame]);

  const closeGame = useCallback(() => {
    setIsOpen(false);
    const idleState = { turn: null, stage: 'idle', type: null, content: '' };
    setGameState(idleState);
    updateGame(idleState);
  }, [updateGame]);

  return {
    isOpen,
    gameState,
    startGame,
    pickType,
    sendChallenge,
    completeTurn,
    closeGame,
  };
};