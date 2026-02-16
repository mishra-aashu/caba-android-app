// hooks/useTruthDareGame.js
import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

export const useTruthDareGame = (roomId, userId) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Game State: 'idle', 'picking', 'writing', 'performing'
  const [gameState, setGameState] = useState({
    turn: null, // kiska turn hai (userId)
    stage: 'idle', 
    type: null, // 'truth' or 'dare'
    content: '', // The question or dare text
  });

  const channel = supabase.channel(`game_${roomId}`);

  useEffect(() => {
    const sub = channel
      .on('broadcast', { event: 'game_update' }, ({ payload }) => {
        setGameState(payload);
        if (!isOpen && payload.stage !== 'idle') setIsOpen(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, isOpen]);

  // Update Game State & Broadcast to Partner
  const updateGame = async (newState) => {
    setGameState(newState);
    await channel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: newState,
    });
  };

  // Actions
  const startGame = () => {
    setIsOpen(true);
    updateGame({ turn: userId, stage: 'picking', type: null, content: '' });
  };

  const pickType = (type) => {
    // Partner ki bari hai likhne ki
    // Note: In a real app, you'd swap the turn ID here or keep current ID and let other user write
    updateGame({ ...gameState, type, stage: 'writing' }); 
  };

  const sendChallenge = (text) => {
    updateGame({ ...gameState, content: text, stage: 'performing' });
  };

  const completeTurn = (partnerId) => {
    // Turn swap kar do
    updateGame({ turn: partnerId, stage: 'picking', type: null, content: '' });
  };

  const closeGame = () => {
    setIsOpen(false);
    updateGame({ turn: null, stage: 'idle', type: null, content: '' });
  };

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