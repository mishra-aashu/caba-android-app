import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useMusicStore from '../../store/useMusicStore';
import MusicSearch from './MusicSearch';
import useChatStore from '../../store/useChatStore';
import useAuthStore from '../../store/authStore';
import { db } from '../../db/db';
import { queueAction, QUEUE_ACTIONS } from '../../services/offlineQueue';
import { frontendToDb } from '../../utils/dbFieldMapping';
import { toast } from 'react-hot-toast';
import { X, Share2, Users, Radio, ChevronRight, Music, Play, Pause, Maximize2, UserPlus } from 'lucide-react';
import './MusicPage.css';

/**
 * MusicPage Component
 * A full-screen page for music discovery and session management.
 * Replaces the old sliding MusicPanel to improve performance.
 */
const MusicPage = () => {
  const navigate = useNavigate();
  const [sessionMode, setSessionMode] = React.useState(null);
  const { 
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
    setPlayerExpanded,
    backgroundImages
  } = useMusicStore();

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
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
    <div className="music-page-container">
      <div className="music-page-inner">
        {/* Root Background Layer */}
        <div className="parallax-bg-layer">
          <div className="bg-slider-wrapper">
            {currentSong ? (
              <img 
                src={currentSong.image} 
                alt="" 
                className="bg-parallax-img active-song-bg"
                loading="lazy"
              />
            ) : (backgroundImages || []).length > 0 ? (
              backgroundImages.slice(0, 3).map((song, i) => (
                <img 
                  key={`bg-root-${song.id}-${i}`} 
                  src={song.image || (song.images?.['500x500'])} 
                  alt="" 
                  className="bg-parallax-img"
                  style={{ animationDelay: `${i * -15}s` }}
                  loading="lazy"
                />
              ))
            ) : (
              <div className="bg-placeholder" />
            )}
          </div>
          <div className="bg-overlay-gradient" />
          <div className="vignette-overlay" />
        </div>
        
        {/* Content Layers */}
        <div className="music-page-content-wrapper">
          {/* Header */}
          <div className="panel-header-glass">
            <div className="header-top">
              <div className="brand-badge">
                <div className="brand-dot" />
                <span>ELEVENGRAM MUSIC</span>
              </div>
              <button className="panel-close-btn" onClick={() => navigate(-1)}>
                <X size={24} />
              </button>
            </div>
            
            <h2 className="panel-title">
              <Music size={24} className="title-icon" />
              Discover Your Sound
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
                  <button 
                    className="action-pill spotify-pill"
                    onClick={() => {
                      useMusicStore.getState().setActiveTab('Spotify');
                    }}
                  >
                    <Music size={18} style={{ color: '#1DB954' }} />
                    <span>SPOTIFY</span>
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
        </div>
      </div>
    </div>
  );
};

export default MusicPage;
