// components/TruthDareModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TruthDareGame from './TruthDareGame';

const TruthDareModal = ({
  isOpen,
  onClose,
  gameState,
  userId,
  partnerId,
  onPick,
  onSend,
  onComplete,
  onStart
}) => {
  // Animation variants
  const modalVariants = {
    hidden: { y: "100%", opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 25, stiffness: 500 } },
    exit: { y: "100%", opacity: 0 }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="game-overlay flex items-end sm:items-center justify-center z-50">
          <motion.div
            className="game-card w-full max-w-lg bg-gray-900 sm:rounded-3xl rounded-t-3xl border-t sm:border border-gray-800 shadow-2xl relative overflow-hidden"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header / Backdrop Glow */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-pink-600/10 to-transparent pointer-events-none"></div>

            <button
              className="absolute top-4 right-4 z-10 p-2 bg-gray-800/50 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
              onClick={onClose}
            >
              <span className="text-2xl leading-none">×</span>
            </button>

            <div className="relative z-10 pt-8 pb-4">
              <TruthDareGame
                gameState={gameState}
                userId={userId}
                partnerId={partnerId}
                onPick={onPick}
                onSend={onSend}
                onComplete={onComplete}
                onStart={onStart}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TruthDareModal;