import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  Gamepad2,
  Play,
  Shield,
  Flame,
  Clock,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import PlayerAvatar from '../common/PlayerAvatar';
import styles from './GameLobby.module.css';

const GameLobby = ({ 
    chatId, 
    otherUserId, 
    invitations = [], 
    loading = false, 
    onStartTruthDare, 
    onResumeGame,
    onAcceptGame,
    onRejectGame
}) => {
  const { user } = useAuth();
  const [selectedGame, setSelectedGame] = useState(null);

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
                    onClick={async () => {
                      const result = await onStartTruthDare();
                      if (result?.error) {
                          toast.error(result.error);
                      }
                    }}
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
            {(loading || invitations.length > 0) && (
              <div className={styles['lobby-section']}>
                <div className={styles['section-header']}>
                  <h4 className={styles['section-title']}>Active Sessions</h4>
                  <Clock size={14} className={styles['accent-color-alt']} />
                </div>

                {loading && invitations.length === 0 ? (
                  <div className={styles['loading-area']}>
                    <div className={styles.spinner} />
                    <p>Checking Arena...</p>
                  </div>
                ) : (
                  <div className={styles['sessions-list']}>
                    {invitations.map((game) => (
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
                            <PlayerAvatar 
                              avatar={game.sender?.avatar} 
                              name={game.sender?.name || 'Unknown'} 
                              size={36}
                              className={styles.avatar}
                              imgClassName={styles['avatar-img']}
                            />
                            <span className={styles.name}>{game.sender?.name || 'Unknown'}</span>
                          </div>

                          <div className={styles['vs-divider']}>
                            <span>VS</span>
                          </div>

                          <div className={styles.participant}>
                            <PlayerAvatar 
                              avatar={game.receiver?.avatar} 
                              name={game.receiver?.name || 'Unknown'} 
                              size={36}
                              className={styles.avatar}
                              imgClassName={styles['avatar-img']}
                            />
                            <span className={styles.name}>{game.receiver?.name || 'Unknown'}</span>
                          </div>
                        </div>

                        <div className={styles['session-actions']}>
                          {game.status === 'pending' && user?.id === game.receiver_id ? (
                            <>
                              <button onClick={() => onAcceptGame(game)} className={styles['accept-btn']}>
                                ACCEPT
                              </button>
                              <button onClick={() => onRejectGame(game)} className={styles['skip-btn']}>
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
                onClick={() => onResumeGame(selectedGame)}
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

export default GameLobby;
