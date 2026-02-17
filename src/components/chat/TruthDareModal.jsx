// components/TruthDareModal.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Flame, MessageCircle, Send, SendToBack, Gamepad2 } from 'lucide-react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';

const TruthDareModal = ({ isOpen, onClose, gameState, userId, partnerId, onPick, onSend, onComplete, onCloseModal, chatId, onStart }) => {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const [challengeText, setChallengeText] = useState('');


  // Use props if provided, otherwise use hook state
  const actualUserId = userId || user?.id;
  const actualPartnerId = partnerId || (gameState?.partnerId);
  const actualChatId = chatId || (gameState?.chatId);

  const handleSendChallenge = () => {
    if (!challengeText.trim()) return;
    onSend(challengeText);
    setChallengeText('');
  };

  const isMyTurn = gameState?.turn === actualUserId;

  // Animation variants
  const modalVariants = {
    hidden: { y: "100%", opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 25, stiffness: 500 } },
    exit: { y: "100%", opacity: 0 }
  };

  if (!isOpen) return null;
  
  const renderGameContent = () => {
    if (!gameState || gameState.stage === 'idle') {
      return (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">🎮 Play Truth or Dare</h2>
          <p className="text-lg mb-6">Challenge your friend!</p>
          
          <button
            onClick={() => onStart && onStart()}
            className="w-full py-4 bg-gradient-to-r from-pink-600 to-violet-600 rounded-lg font-bold flex items-center justify-center gap-2"
          >
            <Gamepad2 size={20} />
            Start Game
          </button>
        </div>
      );
    }

    if (gameState.stage === 'picking') {
      return (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">
            {isMyTurn ? 'Your Turn!' : "Partner's Turn"}
          </h2>
          {isMyTurn ? (
            <>
              <p className="mb-6">Choose your challenge:</p>
              <div className="flex justify-center gap-4">
                <button onClick={() => onPick('truth')} className="truth-btn">Truth</button>
                <button onClick={() => onPick('dare')} className="dare-btn">Dare</button>
              </div>
            </>
          ) : (
            <p>Waiting for your partner to pick...</p>
          )}
        </div>
      );
    }

    if (gameState.stage === 'writing') {
        return (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">
              {isMyTurn ? `Write a ${gameState.type}` : `Partner is writing a ${gameState.type}`}
            </h2>
            {isMyTurn ? (
                <>
                    <p className="mb-6">Ask a question for Truth or set a task for Dare.</p>
                    <textarea
                        value={challengeText}
                        onChange={(e) => setChallengeText(e.target.value)}
                        placeholder={`Type your ${gameState.type}...`}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-pink-500 outline-none resize-none h-24"
                    />
                    <button onClick={handleSendChallenge} className="send-challenge-btn">
                        <Send size={18} /> Send
                    </button>
                </>
            ) : (
              <p>Waiting for your partner to send the challenge...</p>
            )}
          </div>
        );
      }
  
      if (gameState.stage === 'performing') {
        return (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">
                {isMyTurn ? 'Complete the Challenge!' : "Partner's Turn"}
            </h2>
            <div className="challenge-box">
                <p className="text-lg">{gameState.content}</p>
            </div>
            {isMyTurn ? (
                <button onClick={() => onComplete(actualPartnerId)} className="complete-btn">
                    <Check size={20} /> Done
                </button>
            ) : (
                <p>Waiting for your partner to complete...</p>
            )}
          </div>
        );
      }

    return null;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="game-overlay">
          <motion.div 
            className="game-card"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <button className="close-game-btn" onClick={onClose}>×</button>
            {renderGameContent()}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TruthDareModal;