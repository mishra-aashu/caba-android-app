import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMusicStore from '../../store/useMusicStore';
import MusicSearch from './MusicSearch';
import useChatStore, { selectActiveChatId } from '../../store/useChatStore';
import useAuthStore from '../../store/authStore';
import { db } from '../../db/db';
import { queueAction, QUEUE_ACTIONS } from '../../services/offlineQueue';
import { frontendToDb } from '../../utils/dbFieldMapping';
import { toast } from 'react-hot-toast';
import { X, Share2, Users, Radio, ChevronRight, Music, Play, Pause, Maximize2, UserPlus } from 'lucide-react';
import './MusicPanel.css';

/**
 * MusicPanel Component
 * A full-height sliding panel for music discovery and session management.
 * Uses Framer Motion for high-end cinematic transitions.
 */
const MusicPanel = () => {
  const [sessionMode, setSessionMode] = React.useState(null);
  const { 
    isPanelOpen, 
    togglePanel, 
    currentSong, 
    isPlaying,
    setIsPlaying,
    progress,
    setProgress,
    duration,
    roomId, 
    joinRoom, 
    leaveRoom,
    isHost,
    setPlayerExpanded
  } = useMusicStore();

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
    // The GlobalPlayer audio element will sync because it listens to 'progress' changes
    // in its useEffect for seeking.
  };

  const handleCreateRoom = () => {
    // Generate a simple readable room ID
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    joinRoom(newRoomId, true);
  };

  const handleShareSession = async () => {
    if (!roomId) return;
    
    const { activeChatId, activeChat } = useChatStore.getState();
    const { user } = useAuthStore.getState();
    
    if (!activeChatId || !user) {
      toast.error("Open a chat to share session", { icon: '💬' });
      return;
    }

    const tempId = String(Date.now());
    const taskId = crypto.randomUUID();

    const shareMsg = {
      chatId: activeChatId,
      senderId: user.id,
      receiverId: activeChat.isGroup ? user.id : activeChat.otherUserId,
      content: `Join my Music Session! Room ID: ${roomId}`,
      metadata: {
        type: 'music_session_share',
        roomId: roomId,
        song: currentSong
      },
      isGroupMessage: Boolean(activeChat.isGroup),
      messageType: 'song', 
      createdAt: new Date().toISOString(),
      status: 'sending',
      tempId,
    };

    try {
      await db.transaction('rw', [db.messages, db.chats_list], async () => {
        await db.messages.put({ ...shareMsg, id: `temp_${tempId}` });
      });
      
      const dbData = frontendToDb(shareMsg);
      await queueAction(QUEUE_ACTIONS.INSERT_MESSAGE, 'messages', dbData, { taskId });
      
      toast.success("Room ID shared to chat!");
    } catch (err) {
      console.error("Session share failed:", err);
      toast.error("Failed to share room");
    }
  };

  const handleJoinManual = (e) => {
    e.preventDefault();
    const id = e.target.roomInput.value.trim().toUpperCase();
    if (id) {
      joinRoom(id, false);
    }
  };

  return (
    <AnimatePresence>
      {isPanelOpen && (
        <>
          {/* Backdrop for focus */}
          <motion.div 
            className="music-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => togglePanel(false)}
          />
          
          {/* Main Sliding Content */}
          <motion.div 
            className="music-panel-content"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
          >
            <div className="music-panel-inner">
              
              {/* Header */}
              <div className="panel-header-glass">
                <div className="header-top">
                  <div className="brand-badge">
                    <div className="brand-dot" />
                    <span>ELEVENGRAM MUSIC</span>
                  </div>
                  <button className="panel-close-btn" onClick={() => togglePanel(false)}>
                    <X size={24} />
                  </button>
                </div>
                
                <h2 className="panel-title">
                  <Music size={24} className="title-icon" />
                  Explore Beats
                </h2>
                
                {/* Session Action Bar */}
                <div className="session-status-container">
                  {!roomId ? (
                    <div className="session-quick-actions">
                      <button 
                        className={`action-pill ${sessionMode === 'host' ? 'active' : ''}`}
                        onClick={() => setSessionMode(sessionMode === 'host' ? null : 'host')}
                      >
                        <Users size={18} />
                        <span>HOST</span>
                      </button>
                      <button 
                        className={`action-pill ${sessionMode === 'join' ? 'active' : ''}`}
                        onClick={() => setSessionMode(sessionMode === 'join' ? null : 'join')}
                      >
                        <UserPlus size={18} />
                        <span>JOIN</span>
                      </button>
                    </div>
                  ) : (
                    <div className="session-active-card mini">
                      <div className="active-room-pulse">
                        <div className="pulse-ring" />
                        <Radio size={16} />
                      </div>
                      <div className="room-details">
                        <span>{roomId}</span>
                        <p>{isHost ? 'HOSTING' : 'LISTENING'}</p>
                      </div>
                      <div className="room-actions">
                        <button className="share-session-btn" onClick={handleShareSession} title="Share Room ID">
                          <Share2 size={14} />
                        </button>
                        <button className="leave-session-btn" onClick={leaveRoom}>
                          LEAVE
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dropdown Boxes */}
                  <AnimatePresence mode="wait">
                    {sessionMode === 'host' && !roomId && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="session-reveal-box"
                      >
                        <div className="session-invite-card" onClick={() => {
                          joinRoom(Math.random().toString(36).substring(2, 8).toUpperCase(), true);
                          setSessionMode(null);
                        }}>
                          <div className="invite-icon">
                            <Users size={20} />
                          </div>
                          <div className="invite-text">
                            <h4>Create New Room</h4>
                            <p>Everyone will hear your music</p>
                          </div>
                          <ChevronRight size={18} />
                        </div>
                      </motion.div>
                    )}

                    {sessionMode === 'join' && !roomId && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="session-reveal-box"
                      >
                        <form className="manual-join-form-pro" onSubmit={(e) => {
                          handleJoinManual(e);
                          setSessionMode(null);
                        }}>
                          <div className="pro-input-wrapper">
                            <UserPlus size={18} className="input-icon" />
                            <input name="roomInput" placeholder="Enter 6-digit Room ID" autoComplete="off" autoFocus />
                          </div>
                          <button type="submit">JOIN SESSION</button>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Body: Search & Discovery */}
              <div className="panel-body-scrollable">
                <MusicSearch />
              </div>

              {/* Expanded Player Detail (Footer) */}
              <AnimatePresence>
                {currentSong && (
                  <motion.div 
                    className="panel-player-footer"
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                  >
                    <div className="footer-progress-wrapper">
                      <div className="footer-time-labels">
                        <span>{formatTime(progress)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                      <div className="footer-progress-bar">
                        <div 
                          className="footer-progress-fill" 
                          style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                        />
                        <input 
                          type="range"
                          min="0"
                          max={duration || 0}
                          step="0.1"
                          value={progress || 0}
                          onChange={handleSeek}
                          className="footer-seek-slider"
                        />
                      </div>
                    </div>

                    <div 
                      className="footer-song-card" 
                      onClick={() => setPlayerExpanded(true)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="footer-art">
                        <img src={currentSong.image} alt="" />
                      </div>
                      <div className="footer-info">
                        <h4 dangerouslySetInnerHTML={{ __html: currentSong.title }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <p dangerouslySetInnerHTML={{ __html: currentSong.artist }} style={{ display: 'none' }} />
                          <span style={{ fontSize: '10px', color: 'var(--brand-primary)', fontWeight: 700, opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Maximize2 size={10} /> FULLSCREEN
                          </span>
                        </div>
                      </div>
                      <div className="footer-actions">
                        <button 
                          className="footer-play-btn" 
                          onClick={() => setIsPlaying(!isPlaying)}
                          title={isPlaying ? "Pause" : "Play"}
                        >
                          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                        </button>
                        <button className="footer-share-btn" title="Share Song">
                          <Share2 size={20} />
                        </button>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MusicPanel;
