// components/GameRoomModal.jsx
import React, { useState } from 'react';
import { Flame, Grid3X3, X } from 'lucide-react';
import TruthDareGame from './TruthDareGame';

const GameRoomModal = ({ isOpen, onClose, roomId, onSelectGame }) => {
  const [activeGame, setActiveGame] = useState(null); // 'truth-dare' | 'tic-tac-toe' | null

  if (!isOpen) return null;

  return (
    <div className="game-overlay">
      <div className="game-card w-full max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden bg-gray-900">
        
        {/* --- ROOM HEADER --- */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            <h2 className="font-bold text-white">Game Room #{roomId?.slice(0,4)}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X />
          </button>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="flex-1 p-6 overflow-y-auto">
          
          {/* SCENE 1: AGAR KOI GAME SELECT NAHI HUA HAI (LOBBY) */}
          {!activeGame && (
            <div className="grid grid-cols-2 gap-4">
              {/* Game Option 1: Truth or Dare */}
              <button 
                onClick={() => setActiveGame('truth-dare')}
                className="group relative p-6 bg-gradient-to-br from-purple-900 to-indigo-900 rounded-xl border border-purple-500/30 hover:border-purple-500 transition-all hover:scale-105"
              >
                <div className="absolute top-3 right-3 p-2 bg-purple-600 rounded-full group-hover:bg-purple-500">
                  <Flame size={20} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mt-8">Truth or Dare</h3>
                <p className="text-gray-400 text-sm mt-2">Raaz batao ya himmat dikhao!</p>
              </button>

              {/* Game Option 2: Placeholder for future */}
              <button 
                className="group relative p-6 bg-gray-800 rounded-xl border border-gray-700 opacity-50 cursor-not-allowed"
              >
                <div className="absolute top-3 right-3 p-2 bg-gray-700 rounded-full">
                  <Grid3X3 size={20} className="text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-400 mt-8">Tic Tac Toe</h3>
                <p className="text-gray-500 text-sm mt-2">Coming Soon...</p>
              </button>
            </div>
          )}

          {/* SCENE 2: AGAR GAME START HO GAYA */}
          {activeGame === 'truth-dare' && (
            <div className="h-full flex flex-col">
              <button 
                onClick={() => setActiveGame(null)} 
                className="self-start text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1"
              >
                ← Back to Games
              </button>
              
              {/* YAHAN TUMHARA PURANA GAME COMPONENT RENDER HOGA */}
              <TruthDareGame 
                 isOpen={true} 
                 isEmbedded={true} // Style change karne ke liye prop
                 // ... baaki props
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default GameRoomModal;