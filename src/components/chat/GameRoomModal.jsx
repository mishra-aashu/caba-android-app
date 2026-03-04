// components/GameRoomModal.jsx
import React, { useState } from 'react';
import { Flame, Grid3X3, X } from 'lucide-react';
import TruthDareGame from './TruthDareGame';

const GameRoomModal = ({
  isOpen,
  onClose,
  roomId,
  gameState,
  userId,
  partnerId,
  onPick,
  onSend,
  onComplete,
  onStart
}) => {
  const [activeGame, setActiveGame] = useState(null);

  if (!isOpen) return null;

  return (
    <div className="game-overlay fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="game-card w-full max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl">

        {/* --- ROOM HEADER --- */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            <h2 className="font-bold text-white">Game Room #{roomId?.slice(0, 4)}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="flex-1 overflow-y-auto">

          {/* LOBBY */}
          {!activeGame && (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setActiveGame('truth-dare')}
                className="group relative p-8 bg-gradient-to-br from-pink-900/40 to-violet-900/40 rounded-3xl border border-pink-500/20 hover:border-pink-500/50 transition-all hover:scale-[1.02] text-left overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Flame size={120} />
                </div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-pink-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-pink-600/20">
                    <Flame size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Truth or Dare</h3>
                  <p className="text-gray-400 text-sm mt-2">Reveal secrets or demonstrate courage!</p>
                </div>
              </button>

              <button
                disabled
                className="group relative p-8 bg-gray-800/50 rounded-3xl border border-gray-700 opacity-50 cursor-not-allowed text-left"
              >
                <div className="w-12 h-12 bg-gray-700 rounded-2xl flex items-center justify-center mb-6">
                  <Grid3X3 size={24} className="text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-400">Tic Tac Toe</h3>
                <p className="text-gray-500 text-sm mt-2">Coming Soon...</p>
              </button>
            </div>
          )}

          {/* ACTIVE GAME */}
          {activeGame === 'truth-dare' && (
            <div className="h-full flex flex-col">
              <div className="px-6 pt-6">
                <button
                  onClick={() => setActiveGame(null)}
                  className="self-start text-sm text-gray-400 hover:text-white py-2 px-4 bg-gray-800 rounded-full flex items-center gap-2 transition-colors"
                >
                  ← Back to Lobby
                </button>
              </div>

              <TruthDareGame
                gameState={gameState}
                userId={userId}
                partnerId={partnerId}
                onPick={onPick}
                onSend={onSend}
                onComplete={onComplete}
                onStart={onStart}
                isEmbedded={true}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default GameRoomModal;