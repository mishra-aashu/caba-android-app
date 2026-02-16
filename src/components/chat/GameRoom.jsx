import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import { useTruthDareGame } from '../../hooks/useTruthDareGame';
import { 
  Gamepad2, 
  Users, 
  Trophy, 
  Clock, 
  Plus, 
  Play, 
  Sparkles,
  Shield,
  Zap,
  MessageCircle,
  CheckCircle,
  XCircle,
  Flame
} from 'lucide-react';
import { dpOptions } from '../../utils/dpOptions';
import { toast } from 'react-hot-toast';
import TruthDareModal from './TruthDareModal';
import './GameRoom.css';

const GameRoom = ({ isOpen, onClose, chatId, otherUserId }) => {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const { startGame } = useTruthDareGame(chatId, user?.id);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [showTruthDareModal, setShowTruthDareModal] = useState(false);

  useEffect(() => {
    if (isOpen && chatId) {
      loadGames();
    }
  }, [isOpen, chatId]);

  const loadGames = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_invitations')
        .select(`
          *,
          sender:sender_id (
            id,
            name,
            avatar
          ),
          receiver:receiver_id (
            id,
            name,
            avatar
          )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error loading games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = (game) => {
    setSelectedGame(game);
  };

  const handleBackToGames = () => {
    setSelectedGame(null);
    loadGames();
  };

  const handleStartTruthDare = () => {
    setShowTruthDareModal(true);
  };

  const handleAcceptGame = async (game) => {
    try {
      // Update invitation status to accepted
      const { error: inviteError } = await supabase
        .from('game_invitations')
        .update({ status: 'accepted' })
        .eq('id', game.id);

      if (inviteError) throw inviteError;

      toast.success('Game invitation accepted!');
      setSelectedGame({ ...game, status: 'accepted' }); // Go to game detail view
    } catch (error) {
      console.error('Error accepting game:', error);
      toast.error('Failed to accept game');
    }
  };

  const handleRejectGame = async (game) => {
    try {
      // Update invitation status to rejected
      const { error: inviteError } = await supabase
        .from('game_invitations')
        .update({ status: 'rejected' })
        .eq('id', game.id);

      if (inviteError) throw inviteError;

      toast.success('Game invitation rejected');
      loadGames(); // Refresh the game list
    } catch (error) {
      console.error('Error rejecting game:', error);
      toast.error('Failed to reject game');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="game-room-overlay">
        <div className="game-room-container">
          <div className="game-room-header">
            <div className="room-title-section">
              <div className="room-icon-container">
                <Gamepad2 size={36} className="room-icon" />
                <Sparkles size={20} className="sparkle-effect" />
              </div>
              <div className="room-title-text">
                <h2>Game Room</h2>
                <p className="room-subtitle">All games in this chat</p>
              </div>
            </div>
            <button className="close-room-btn" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="game-room-content">
            {!selectedGame ? (
              // Game List View
              <div className="game-list">
                {loading ? (
                  <div className="loading-games">
                    <div className="loading-spinner"></div>
                    <p>Loading games...</p>
                  </div>
                ) : games.length === 0 ? (
                  <div className="games-grid">
                    {/* Truth or Dare Game Card */}
                    <div className="game-card game-card-interactive">
                      <div className="game-card-header">
                        <div className="game-type-badge truth-dare-badge">
                          <Flame size={16} />
                          <span>TRUTH OR DARE</span>
                        </div>
                        <div className="game-status available">
                          <Zap size={16} />
                          <span>AVAILABLE</span>
                        </div>
                      </div>
                      
                      <div className="game-card-content">
                        <div className="game-icon-large">
                          <Flame size={64} className="flame-icon" />
                        </div>
                        <div className="game-message">
                          Raaz kholo ya himmat dikhao! 🔥
                        </div>
                        <div className="game-description">
                          Challenge your friend with questions or dares. 
                          Perfect for breaking the ice or spicing up the conversation!
                        </div>
                      </div>

                      <div className="game-card-actions">
                        <button className="start-game-btn truth-dare-btn" onClick={handleStartTruthDare}>
                          <Play size={16} />
                          Start Truth or Dare
                        </button>
                      </div>
                    </div>

                    {/* Coming Soon Placeholder */}
                    <div className="game-card coming-soon-card">
                      <div className="game-card-header">
                        <div className="game-type-badge coming-soon-badge">
                          <Zap size={16} />
                          <span>COMING SOON</span>
                        </div>
                        <div className="game-status coming-soon">
                          <Clock size={16} />
                          <span>SOON</span>
                        </div>
                      </div>
                      
                      <div className="game-card-content">
                        <div className="game-icon-large">
                          <Gamepad2 size={64} className="gamepad-icon" />
                        </div>
                        <div className="game-message">
                          More Games Coming!
                        </div>
                        <div className="game-description">
                          Stay tuned for Tic Tac Toe, 
                          Word Chain, and more exciting games!
                        </div>
                      </div>

                      <div className="game-card-actions">
                        <button className="coming-soon-btn" disabled>
                          <Plus size={16} />
                          Coming Soon
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="games-grid">
                    {games.map((game) => (
                      <div key={game.id} className="game-card">
                        <div className="game-card-header">
                          <div className="game-type-badge">
                            <Shield size={16} />
                            <span>{game.game_type.replace('_', ' ').toUpperCase()}</span>
                          </div>
                          <div className={`game-status ${game.status}`}>
                            {game.status === 'pending' && <Clock size={16} />}
                            {game.status === 'accepted' && <CheckCircle size={16} />}
                            {game.status === 'rejected' && <XCircle size={16} />}
                            <span>{game.status.toUpperCase()}</span>
                          </div>
                        </div>
                        
                        <div className="game-card-content">
                          <div className="game-message">
                            {game.invitation_message}
                          </div>
                          
                          <div className="game-participants">
                            <div className="participant">
                              <div className="avatar">
                                {game.sender?.avatar ? (
                                  parseInt(game.sender.avatar) ? (
                                    <img src={dpOptions.find(dp => dp.id === parseInt(game.sender.avatar))?.path || game.sender.avatar} alt={game.sender.name} />
                                  ) : (
                                    <img src={game.sender.avatar} alt={game.sender.name} />
                                  )
                                ) : (
                                  game.sender?.name?.charAt(0)?.toUpperCase() || 'U'
                                )}
                              </div>
                              <span>{game.sender?.name || 'Unknown'}</span>
                            </div>
                            <div className="vs-separator">vs</div>
                            <div className="participant">
                              <div className="avatar">
                                {game.receiver?.avatar ? (
                                  parseInt(game.receiver.avatar) ? (
                                    <img src={dpOptions.find(dp => dp.id === parseInt(game.receiver.avatar))?.path || game.receiver.avatar} alt={game.receiver.name} />
                                  ) : (
                                    <img src={game.receiver.avatar} alt={game.receiver.name} />
                                  )
                                ) : (
                                  game.receiver?.name?.charAt(0)?.toUpperCase() || 'U'
                                )}
                              </div>
                              <span>{game.receiver?.name || 'Unknown'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="game-card-actions">
                          {game.status === 'pending' ? (
                            user?.id === game.receiver_id ? (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleAcceptGame(game)}
                                  className="accept-btn"
                                >
                                  <CheckCircle size={20} />
                                  Accept Game
                                </button>
                                <button 
                                  onClick={() => handleRejectGame(game)}
                                  className="reject-btn"
                                >
                                  <XCircle size={20} />
                                  Reject Game
                                </button>
                              </div>
                            ) : (
                              <div className="text-yellow-500 text-sm">Waiting for response...</div>
                            )
                          ) : game.status === 'accepted' ? (
                            <button className="join-game-btn" onClick={() => handleStartGame(game)}>
                              <Play size={16} />
                              Start Truth or Dare
                            </button>
                          ) : (
                            <button className="game-ended-btn" disabled>
                              <XCircle size={16} />
                              Game Ended
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Game Detail View
              <div className="game-detail">
                <div className="game-detail-header">
                  <button className="back-btn" onClick={handleBackToGames}>
                    ← Back to Games
                  </button>
                  <div className="game-detail-title">
                    <h3>{selectedGame.game_type.replace('_', ' ').toUpperCase()}</h3>
                    <span className={`status-badge ${selectedGame.status}`}>
                      {selectedGame.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="game-detail-content">
                  <div className="game-info">
                    <div className="game-message-detail">
                      <h4>Invitation Message</h4>
                      <p>{selectedGame.invitation_message}</p>
                    </div>
                    
                    <div className="game-timestamp">
                      <Clock size={16} />
                      <span>Created: {new Date(selectedGame.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="game-actions">
                    {selectedGame.status === 'pending' ? (
                      <div className="pending-actions">
                        <button className="accept-btn">
                          <CheckCircle size={20} />
                          Accept Game
                        </button>
                        <button className="reject-btn">
                          <XCircle size={20} />
                          Reject Game
                        </button>
                      </div>
                    ) : selectedGame.status === 'accepted' ? (
                      <div className="accepted-actions">
                        <button className="play-btn" onClick={handleStartTruthDare}>
                          <Play size={24} />
                          <span>Start Playing</span>
                        </button>
                      </div>
                    ) : (
                      <div className="ended-actions">
                        <button className="new-game-btn">
                          <Plus size={20} />
                          Start New Game
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Truth or Dare Modal */}
      {showTruthDareModal && (
        <TruthDareModal
          isOpen={showTruthDareModal}
          onClose={() => setShowTruthDareModal(false)}
          gameState={null}
          userId={user?.id}
          partnerId={otherUserId}
          onPick={() => {}}
          onSend={() => {}}
          onComplete={() => {}}
          onCloseModal={() => setShowTruthDareModal(false)}
          chatId={chatId}
        />
      )}
    </>
  );
};

export default GameRoom;