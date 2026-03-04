import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import {
  Gamepad2,
  Play,
  Shield,
  CheckCircle,
  XCircle,
  Flame,
  Plus,
  Clock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import './GameRoom.css';

const GameRoom = ({ chatId, otherUserId, onStartTruthDare, onResumeGame }) => {
  const { supabase } = useSupabase();
  const { user } = useAuth();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);

  useEffect(() => {
    if (chatId) {
      loadGames();
    }
  }, [chatId]);

  const loadGames = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_invitations')
        .select(`
          *,
          sender:sender_id (id, name, avatar),
          receiver:receiver_id (id, name, avatar)
        `)
        .eq('chat_id', chatId)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error loading games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptGame = async (game) => {
    try {
      const { error } = await supabase
        .from('game_invitations')
        .update({ status: 'accepted' })
        .eq('id', game.id);

      if (error) throw error;
      toast.success('Accepted!');

      // Notify partner immediately via broadcast for instant UI response
      const channelName = `game_room_${chatId}`;
      const channel = supabase.channel(channelName);
      await channel.send({
        type: 'broadcast',
        event: 'game_update',
        payload: {
          gameId: game.id,
          gameState: { ...game.invitation_data, stage: 'picking' } // Start the game move
        },
      });

      loadGames();
      if (onResumeGame) onResumeGame();
    } catch (error) {
      toast.error('Failed to accept');
    }
  };

  const handleRejectGame = async (game) => {
    try {
      const { error } = await supabase
        .from('game_invitations')
        .update({ status: 'rejected' })
        .eq('id', game.id);

      if (error) throw error;
      loadGames();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  return (
    <div className="game-room-content-wrapper h-full flex flex-col p-4 rounded-3xl bg-slate-900 shadow-2xl overflow-hidden">
      <div className="game-room-header-simple border-b border-slate-800 pb-4 mb-4">
        <div className="room-title-section flex items-center gap-4">
          <div className="room-icon-container-small w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-900/20">
            <Gamepad2 size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Game Room</h3>
            <p className="text-xs text-slate-400">Play, challenge, and connect</p>
          </div>
        </div>
      </div>

      <div className="game-room-content flex-1 overflow-y-auto space-y-8 pr-1 custom-scrollbar">
        {!selectedGame ? (
          <>
            {/* 1. AVAILABLE GAMES (TEMPLATES) */}
            <div className="game-section">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Plus size={12} strokeWidth={3} /> Available Games
              </h4>
              <div className="games-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="game-card bg-slate-800/50 border border-slate-700/50 hover:border-pink-500/50 transition-all rounded-3xl p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="truth-dare-badge bg-pink-500/10 text-pink-500 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-2">
                      <Flame size={12} /> Truth or Dare
                    </div>
                    <div className="text-[10px] font-bold text-green-500 flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded">
                      <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> FREE
                    </div>
                  </div>

                  <div className="game-message bg-slate-900/50 border border-slate-700/30 p-4 rounded-2xl text-center">
                    <p className="text-sm font-medium italic text-slate-300">"Raaz kholo ya himmat dikhao!" 🔥</p>
                  </div>

                  <button className="start-game-btn bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white py-3 rounded-2xl font-bold text-sm shadow-lg shadow-pink-900/20 flex items-center justify-center gap-3 transition-all active:scale-95" onClick={onStartTruthDare}>
                    <Play size={16} fill="white" /> NEW GAME
                  </button>
                </div>

                <div className="game-card bg-slate-800/20 border border-dashed border-slate-700/50 rounded-3xl p-5 flex flex-col items-center justify-center gap-2 grayscale">
                  <Shield size={32} className="text-slate-700" />
                  <span className="text-[10px] font-black text-slate-600 tracking-[0.3em]">COMING SOON</span>
                </div>
              </div>
            </div>

            {/* 2. ACTIVE GAMES / INVITATIONS */}
            {(loading || games.length > 0) && (
              <div className="game-section">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Clock size={12} strokeWidth={3} /> Active Sessions
                </h4>

                {loading && games.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-4 text-slate-500">
                    <div className="w-6 h-6 border-2 border-slate-700 border-t-green-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-bold tracking-widest uppercase">Checking activity...</p>
                  </div>
                ) : (
                  <div className="games-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                    {games.map((game) => (
                      <div key={game.id} className="game-card bg-slate-800/40 border border-slate-700/40 rounded-3xl p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{game.game_type.replace('_', ' ')}</span>
                          <span className={`text-[9px] font-black px-2 py-1 rounded-full ${game.status === 'accepted' ? 'text-green-500 bg-green-500/10' : 'text-amber-500 bg-amber-500/10'}`}>{game.status.toUpperCase()}</span>
                        </div>

                        <div className="flex items-center justify-between bg-slate-900/30 p-4 rounded-2xl border border-slate-700/20">
                          <div className="flex flex-col items-center gap-2 flex-1">
                            <div className="w-10 h-10 rounded-2xl bg-slate-700 flex items-center justify-center text-sm font-black text-white shadow-inner">{game.sender?.name?.charAt(0)}</div>
                            <span className="text-[10px] font-bold text-slate-400 truncate w-16 text-center">{game.sender?.name}</span>
                          </div>
                          <div className="text-[10px] font-black text-slate-700 tracking-tighter">VS</div>
                          <div className="flex flex-col items-center gap-2 flex-1">
                            <div className="w-10 h-10 rounded-2xl bg-slate-700 flex items-center justify-center text-sm font-black text-white shadow-inner">{game.receiver?.name?.charAt(0)}</div>
                            <span className="text-[10px] font-bold text-slate-400 truncate w-16 text-center">{game.receiver?.name}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {game.status === 'pending' && user?.id === game.receiver_id ? (
                            <>
                              <button onClick={() => handleAcceptGame(game)} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white text-xs font-black rounded-xl transition-colors shadow-lg shadow-green-900/10 flex items-center justify-center gap-2">
                                <CheckCircle size={14} /> ACCEPT
                              </button>
                              <button onClick={() => handleRejectGame(game)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-black rounded-xl transition-colors">SKIP</button>
                            </>
                          ) : (
                            <button className="w-full py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2" onClick={() => setSelectedGame(game)}>
                              OPEN SESSION <Play size={12} fill="currentColor" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-6 animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-green-500/10 rounded-[2.5rem] flex items-center justify-center border border-green-500/20 relative">
              <Play size={48} className="text-green-500" fill="currentColor" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-ping" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight mb-2 uppercase italic">Battle Ready!</h3>
              <p className="text-sm text-slate-400 font-medium">Invitation accepted. Time to play!</p>
            </div>
            <div className="w-full max-w-xs flex flex-col gap-3">
              <button className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 text-white font-black rounded-2xl hover:from-green-500 hover:to-green-400 shadow-xl shadow-green-900/20 flex items-center justify-center gap-3 transition-all active:scale-95" onClick={onResumeGame}>
                <Play size={20} fill="white" /> RESUME GAME
              </button>
              <button className="w-full py-2 text-slate-500 font-bold text-xs" onClick={() => setSelectedGame(null)}>
                CLOSE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameRoom;