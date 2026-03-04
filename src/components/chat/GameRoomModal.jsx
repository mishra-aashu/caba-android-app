import React, { useState } from 'react';
import { Flame, Grid3X3, X, ChevronLeft, Gamepad2 } from 'lucide-react';
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
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-0 sm:p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-4xl h-full sm:h-[85vh] flex flex-col overflow-hidden bg-[#05070a] sm:rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative">

        {/* Decorative Glows */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

        {/* --- ROOM HEADER --- */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02] backdrop-blur-md relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Gamepad2 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-black text-white italic tracking-tight text-xl uppercase">ARENA LOBBY</h2>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Room #{roomId?.slice(0, 6)}</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">

          {/* LOBBY VIEW */}
          {!activeGame && (
            <div className="p-8 space-y-8">
              <div className="px-1 text-center sm:text-left">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6">Select Battle Type</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={() => setActiveGame('truth-dare')}
                  className="group relative p-10 bg-white/[0.03] rounded-[2.5rem] border border-white/5 hover:border-pink-500/30 transition-all hover:scale-[1.02] text-left overflow-hidden shadow-2xl"
                >
                  <div className="absolute -top-10 -right-10 p-6 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all text-pink-500">
                    <Flame size={200} />
                  </div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-pink-600/20 rounded-2xl flex items-center justify-center mb-8 border border-pink-500/20 shadow-inner">
                      <Flame size={32} className="text-pink-500 animate-pulse" />
                    </div>
                    <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Truth or Dare</h3>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-[200px]">Reveal the unknown or face the heat of the challenge.</p>
                  </div>
                </button>

                <div
                  className="group relative p-10 bg-white/[0.01] rounded-[2.5rem] border border-dashed border-white/5 opacity-40 grayscale flex flex-col items-center justify-center text-center gap-4 py-20"
                >
                  <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center border border-white/5">
                    <Grid3X3 size={32} className="text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-600 italic uppercase">Coming Soon</h3>
                    <p className="text-slate-700 text-[10px] font-bold tracking-[0.3em] mt-1">Tic Tac Toe & More</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE GAME VIEW */}
          {activeGame === 'truth-dare' && (
            <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="px-8 pt-6">
                <button
                  onClick={() => setActiveGame(null)}
                  className="group self-start text-[10px] font-black text-slate-400 hover:text-white py-3 px-6 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center gap-2 transition-all tracking-widest uppercase border border-white/5"
                >
                  <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Lobby
                </button>
              </div>

              <div className="flex-1 flex flex-col">
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
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default GameRoomModal;