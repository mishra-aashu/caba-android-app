import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMusicStore from '../../store/useMusicStore';
import { ChevronDown, MoreHorizontal, SkipBack, SkipForward, Play, Pause, Share2, ListMusic, Heart } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './FullscreenPlayer.css';

const FullscreenPlayer = () => {
  const { 
    currentSong, isPlaying, setIsPlaying, 
    progress, setProgress, 
    duration,
    isPlayerExpanded, setPlayerExpanded,
    isHost, roomId
  } = useMusicStore();

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeek = (e) => {
    if (!isHost && roomId) {
      toast.error("Only Host can seek", { id: 'fs-seek-warn' });
      return;
    }
    const time = parseFloat(e.target.value);
    setProgress(time);
  };

  // Generate deterministic random colors based on song ID for consistency
  const colors = useMemo(() => {
    if (!currentSong) return ['#4f46e5', '#ec4899', '#06b6d4'];
    const id = currentSong.id || 'default';
    const hue1 = (id.charCodeAt(0) * 10) % 360;
    const hue2 = (id.charCodeAt(id.length - 1) * 15) % 360;
    const hue3 = (hue1 + 120) % 360;
    return [
      `hsl(${hue1}, 70%, 40%)`,
      `hsl(${hue2}, 70%, 40%)`,
      `hsl(${hue3}, 70%, 40%)`
    ];
  }, [currentSong?.id]);



  if (!isPlayerExpanded || !currentSong) return null;

  return (
    <motion.div 
      key="fullscreen-player"
      className="fullscreen-player-overlay"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 0.8 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={(e, { offset, velocity }) => {
        if (offset.y > 100 || velocity.y > 500) {
          setPlayerExpanded(false);
        }
      }}
    >
      {/* Dynamic Animated Background */}
      <div className="dynamic-gradient-bg">
        <div className="blob blob-1" style={{ backgroundColor: colors[0] }} />
        <div className="blob blob-2" style={{ backgroundColor: colors[1] }} />
        <div className="blob blob-3" style={{ backgroundColor: colors[2] }} />
      </div>

      {/* Header */}
      <div className="player-header">
        <button className="header-btn" onClick={() => setPlayerExpanded(false)}>
          <ChevronDown size={24} />
        </button>
        <div className="header-meta">
          <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', opacity: 0.6 }}>
            PLAYING FROM SEARCH
          </span>
        </div>
        <button className="header-btn">
          <MoreHorizontal size={24} />
        </button>
      </div>

      {/* Main Content: Artwork & Title */}
      <div className="player-main-content">
        <motion.div 
          className={`artwork-container ${isPlaying ? 'playing' : ''}`}
          layoutId={`artwork-${currentSong.id}`}
        >
          <img src={currentSong.image} alt={currentSong.title} />
        </motion.div>

        <div className="song-info-expanded">
          <h2 dangerouslySetInnerHTML={{ __html: currentSong.title }} />
          <p dangerouslySetInnerHTML={{ __html: currentSong.artist }} />
        </div>
      </div>

      {/* Footer: Controls & Seek */}
      <div className="player-controls-footer">
        <div className="progress-section">
          <div className="time-row">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="seek-bar-container">
            <div 
              className="seek-bar-fill" 
              style={{ width: `${(progress / (duration || 1)) * 100}%` }} 
            />
            <input 
              type="range"
              className="seek-input-fs"
              min="0"
              max={duration || 0}
              step="0.1"
              value={progress || 0}
              onChange={handleSeek}
            />
          </div>
        </div>

        <div className="main-controls-row">
          <button className="fs-control-btn">
            <SkipBack size={32} fill="currentColor" />
          </button>
          
          <button 
            className="fs-control-btn fs-play-btn"
            onClick={() => {
              if (roomId && !isHost) {
                toast.error("Only Host can control playback", { id: 'fs-play-warn' });
                return;
              }
              setIsPlaying(!isPlaying);
            }}
          >
            {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" style={{ marginLeft: 4 }} />}
          </button>

          <button className="fs-control-btn">
            <SkipForward size={32} fill="currentColor" />
          </button>
        </div>

        <div className="bottom-actions">
          <button className="fs-control-btn">
            <Heart size={22} />
          </button>
          <button className="fs-control-btn">
            <Share2 size={22} />
          </button>
          <button className="fs-control-btn">
            <ListMusic size={22} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default FullscreenPlayer;
