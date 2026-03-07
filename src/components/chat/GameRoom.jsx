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
import styles from './GameRoom.module.css';

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
    <div className={styles['lobby-container']}>
      {/* Lobby Title */}
      <div className={styles['lobby-header']}>
        <div className={styles['header-info']}>
          <h3 className={styles['lobby-title']}>Lobby</h3>
          <div className={styles['status-row']}>
            <span className={styles['online-dot']} />
            <p className={styles['status-text']}>Select your battle</p>
          </div>
        </div>
      </div>

      <div className={`${styles['lobby-content']} ${styles['custom-scrollbar']}`}>
        {!selectedGame ? (
          <div className={styles['lobby-sections']}>
            {/* 1. DISCOVER SECTION */}
            <div className={styles['lobby-section']}>
              <div className={styles['section-header']}>
                <h4 className={styles['section-title']}>Featured Games</h4>
                <TrendingUp size={14} className={styles['accent-color']} />
              </div>

              <div className={styles['games-grid']}>
                <div className={`${styles['game-card']} ${styles.featured}`}>
                  <div className={styles['card-top']}>
                    <div className={styles['game-info']}>
                      <div className={`${styles.badge} ${styles.trending}`}>
                        <Flame size={14} /> Hot & Trending
                      </div>
                      <h2 className={styles['game-title']}>TRUTH OR DARE</h2>
                    </div>
                    <div className={styles['price-tag']}>
                      <span>Free Play</span>
                    </div>
                  </div>

                  <div className={styles['game-quote']}>
                    <p>"Break the ice, reveal secrets, and take wild risks!"</p>
                  </div>

                  <button
                    className={styles['start-game-btn']}
                    onClick={onStartTruthDare}
                  >
                    <span>START BATTLE</span>
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div className={`${styles['game-card']} ${styles.placeholder}`}>
                  <div className={styles['placeholder-content']}>
                    <Shield size={32} />
                    <span>MYSTERY GAME</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. SESSIONS SECTION */}
            {(loading || games.length > 0) && (
              <div className={styles['lobby-section']}>
                <div className={styles['section-header']}>
                  <h4 className={styles['section-title']}>Active Sessions</h4>
                  <Clock size={14} className={styles['accent-color-alt']} />
                </div>

                {loading && games.length === 0 ? (
                  <div className={styles['loading-area']}>
                    <div className={styles.spinner} />
                    <p>Checking Arena...</p>
                  </div>
                ) : (
                  <div className={styles['sessions-list']}>
                    {games.map((game) => (
                      <div key={game.id} className={styles['session-card']}>
                        <div className={styles['session-top']}>
                          <span className={styles['game-type']}>
                            {game.game_type?.replaceAll('_', ' ') || 'UNNAMED BATTLE'}
                          </span>
                          <span className={`${styles['status-badge']} ${styles[game.status]}`}>
                            {game.status}
                          </span>
                        </div>

                        <div className={styles['versus-display']}>
                          <div className={styles.participant}>
                            <div className={styles.avatar}>
                              {game.sender?.avatar ? (
                                <img src={getAvatarPath(game.sender.avatar)} alt="" className={styles['avatar-img']} />
                              ) : (
                                <span className={styles.initials}>{getInitials(game.sender?.name)}</span>
                              )}
                            </div>
                            <span className={styles.name}>{game.sender?.name}</span>
                          </div>

                          <div className={styles['vs-divider']}>
                            <span>VS</span>
                          </div>

                          <div className={styles.participant}>
                            <div className={styles.avatar}>
                              {game.receiver?.avatar ? (
                                <img src={getAvatarPath(game.receiver.avatar)} alt="" className={styles['avatar-img']} />
                              ) : (
                                <span className={styles.initials}>{getInitials(game.receiver?.name)}</span>
                              )}
                            </div>
                            <span className={styles.name}>{game.receiver?.name}</span>
                          </div>
                        </div>

                        <div className={styles['session-actions']}>
                          {game.status === 'pending' && user?.id === game.receiver_id ? (
                            <>
                              <button onClick={() => handleAcceptGame(game)} className={styles['accept-btn']}>
                                ACCEPT
                              </button>
                              <button onClick={() => handleRejectGame(game)} className={styles['skip-btn']}>
                                SKIP
                              </button>
                            </>
                          ) : (
                            <button className={styles['resume-session-btn']} onClick={() => setSelectedGame(game)}>
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
          <div className={styles['entry-view']}>
            <div className={styles['entry-icon-wrapper']}>
              <div className={styles['icon-bg']}>
                <Gamepad2 size={64} />
              </div>
              <div className={styles['play-overlay']}>
                <Play size={20} fill="white" />
              </div>
            </div>

            <div className={styles['entry-text']}>
              <h3 className={styles['entry-title']}>BATTLE READY</h3>
              <p className={styles['entry-subtitle']}>Prepare for impact</p>
            </div>

            <div className={styles['entry-actions']}>
              <button
                className={styles['enter-arena-btn']}
                onClick={onResumeGame}
              >
                <span>ENTER ARENA</span>
                <ChevronRight size={20} />
              </button>
              <button className={styles['cancel-entry-btn']} onClick={() => setSelectedGame(null)}>
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