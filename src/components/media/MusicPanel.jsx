import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMusicStore from '../../store/useMusicStore';
import MusicSearch from './MusicSearch';
import { X, Share2, Users, Radio, ChevronRight, Music, Play, Pause } from 'lucide-react';
import './MusicPanel.css';

/**
 * MusicPanel Component
 * A full-height sliding panel for music discovery and session management.
 * Uses Framer Motion for high-end cinematic transitions.
 */
const MusicPanel = () => {
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
    isHost
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

  const handleShareSession = () => {
    // TODO: Integrate with chat to share the Room ID
    console.log("Sharing session:", roomId);
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
                
                <h2 className="panel-title">Explore Beats</h2>
                
                {/* Session Control */}
                <div className="session-status-container">
                  {!roomId ? (
                    <div className="session-invite-card" onClick={handleCreateRoom}>
                      <div className="invite-icon">
                        <Users size={20} />
                      </div>
                      <div className="invite-text">
                        <h4>Listen Together</h4>
                        <p>Sync music with your friends</p>
                      </div>
                      <ChevronRight size={20} className="invite-arrow" />
                    </div>
                  ) : (
                    <div className="session-active-card">
                      <div className="active-room-pulse">
                        <Radio size={18} className="pulse-icon" />
                        <div className="pulse-ring" />
                      </div>
                      <div className="room-details">
                        <h4>Active Room: <span>{roomId}</span></h4>
                        <p>{isHost ? 'Hosting Session' : 'Listening with Friend'}</p>
                      </div>
                      <div className="room-actions">
                        <button className="share-session-btn" onClick={handleShareSession}>
                          <Share2 size={18} />
                        </button>
                        <button className="leave-session-btn" onClick={leaveRoom}>
                          Leave
                        </button>
                      </div>
                    </div>
                  )}
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

                    <div className="footer-song-card">
                      <div className="footer-art">
                        <img src={currentSong.image} alt="" />
                      </div>
                      <div className="footer-info">
                        <h4 dangerouslySetInnerHTML={{ __html: currentSong.title }} />
                        <p dangerouslySetInnerHTML={{ __html: currentSong.artist }} />
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
