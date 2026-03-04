import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import {
  Gamepad2,
  Play,
  Shield,
  CheckCircle,
  Flame,
  Plus,
  Clock,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { dpOptions } from '../../utils/dpOptions';
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
      toast.success('Battle Accepted! 🔥');

      const channelName = `game_room_${chatId}`;
      const channel = supabase.channel(channelName);
      await channel.send({
        type: 'broadcast',
        event: 'game_update',
        payload: {
          gameId: game.id,
          gameState: { ...game.invitation_data, stage: 'picking' }
        },
      });

      loadGames();
      if (onResumeGame) onResumeGame();
    } catch (error) {
      toast.error('Failed to join');
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
      toast.error('Failed to ignore');
    }
  };

  const getAvatarPath = (avatar) => {
    if (!avatar) return null;
    if (!isNaN(parseInt(avatar)) && avatar.toString().length < 5) {
      const dp = dpOptions.find(dp => dp.id === parseInt(avatar));
      return dp ? dp.path : null;
    }
    return avatar;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="lobby-container">
      {/* Lobby Title */}
      <div className="lobby-header">
        <div className="header-info">
          <h3 className="lobby-title">Lobby</h3>
          <div className="status-row">
            <span className="online-dot" />
            <p className="status-text">Select your battle</p>
          </div>
        </div>
      </div>

      <div className="lobby-content custom-scrollbar">
        {!selectedGame ? (
          <div className="lobby-sections">
            {/* 1. DISCOVER SECTION */}
            <div className="lobby-section">
              <div className="section-header">
                <h4 className="section-title">Featured Games</h4>
                <TrendingUp size={14} className="accent-color" />
              </div>

              <div className="games-grid">
                <div className="game-card featured">
                  <div className="card-top">
                    <div className="game-info">
                      <div className="badge trending">
                        <Flame size={14} /> Hot & Trending
                      </div>
                      <h2 className="game-title">TRUTH OR DARE</h2>
                    </div>
                    <div className="price-tag">
                      <span>Free Play</span>
                    </div>
                  </div>

                  <div className="game-quote">
                    <p>"Break the ice, reveal secrets, and take wild risks!"</p>
                  </div>

                  <button
                    className="start-game-btn"
                    onClick={onStartTruthDare}
                  >
                    <span>START BATTLE</span>
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div className="game-card placeholder">
                  <div className="placeholder-content">
                    <Shield size={32} />
                    <span>MYSTERY GAME</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. SESSIONS SECTION */}
            {(loading || games.length > 0) && (
              <div className="lobby-section">
                <div className="section-header">
                  <h4 className="section-title">Active Sessions</h4>
                  <Clock size={14} className="accent-color-alt" />
                </div>

                {loading && games.length === 0 ? (
                  <div className="loading-area">
                    <div className="spinner" />
                    <p>Checking Arena...</p>
                  </div>
                ) : (
                  <div className="sessions-list">
                    {games.map((game) => (
                      <div key={game.id} className="session-card">
                        <div className="session-top">
                          <span className="game-type">
                            {game.game_type?.replaceAll('_', ' ') || 'UNNAMED BATTLE'}
                          </span>
                          <span className={`status-badge ${game.status}`}>
                            {game.status}
                          </span>
                        </div>

                        <div className="versus-display">
                          <div className="participant">
                            <div className="avatar">
                              {game.sender?.avatar ? (
                                <img src={getAvatarPath(game.sender.avatar)} alt="" className="avatar-img" />
                              ) : (
                                <span className="initials">{getInitials(game.sender?.name)}</span>
                              )}
                            </div>
                            <span className="name">{game.sender?.name}</span>
                          </div>

                          <div className="vs-divider">
                            <span>VS</span>
                          </div>

                          <div className="participant">
                            <div className="avatar">
                              {game.receiver?.avatar ? (
                                <img src={getAvatarPath(game.receiver.avatar)} alt="" className="avatar-img" />
                              ) : (
                                <span className="initials">{getInitials(game.receiver?.name)}</span>
                              )}
                            </div>
                            <span className="name">{game.receiver?.name}</span>
                          </div>
                        </div>

                        <div className="session-actions">
                          {game.status === 'pending' && user?.id === game.receiver_id ? (
                            <>
                              <button onClick={() => handleAcceptGame(game)} className="accept-btn">
                                ACCEPT
                              </button>
                              <button onClick={() => handleRejectGame(game)} className="skip-btn">
                                SKIP
                              </button>
                            </>
                          ) : (
                            <button className="resume-session-btn" onClick={() => setSelectedGame(game)}>
                              RESUME <Play size={14} fill="currentColor" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="entry-view">
            <div className="entry-icon-wrapper">
              <div className="icon-bg">
                <Gamepad2 size={64} />
              </div>
              <div className="play-overlay">
                <Play size={20} fill="white" />
              </div>
            </div>

            <div className="entry-text">
              <h3 className="entry-title">BATTLE READY</h3>
              <p className="entry-subtitle">Prepare for impact</p>
            </div>

            <div className="entry-actions">
              <button
                className="enter-arena-btn"
                onClick={onResumeGame}
              >
                <span>ENTER ARENA</span>
                <ChevronRight size={20} />
              </button>
              <button className="cancel-entry-btn" onClick={() => setSelectedGame(null)}>
                Back to Lobby
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameRoom;