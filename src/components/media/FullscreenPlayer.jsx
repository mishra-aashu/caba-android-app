import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMusicStore from '../../store/useMusicStore';
import { ChevronDown, MoreHorizontal, SkipBack, SkipForward, Play, Pause, Share2, ListMusic, Heart, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './FullscreenPlayer.css';

const FullscreenPlayer = () => {
  const { 
    currentSong, isPlaying, setIsPlaying, 
    duration,
    isPlayerExpanded, setPlayerExpanded,
    isHost, roomId,
    playNext, playPrevious,
    togglePanel,
    setProgress,
    searchResults
  } = useMusicStore();

  const nextSong = useMemo(() => {
    if (!currentSong || searchResults.length <= 1) return null;
    const currentIndex = searchResults.findIndex(s => s.id === currentSong.id);
    if (currentIndex === -1 || currentIndex === searchResults.length - 1) return searchResults[0];
    return searchResults[currentIndex + 1];
  }, [currentSong, searchResults]);

  const progressRef = useRef(0);
  const progressBarRef = useRef(null);
  const timeCurrentRef = useRef(null);
  const animationRef = useRef(null);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // High Performance Animation Loop
  const updateUI = useCallback(() => {
    const storeProgress = useMusicStore.getState().progress;
    progressRef.current = storeProgress;
    
    if (progressBarRef.current) {
      const percent = (storeProgress / (duration || 1)) * 100;
      progressBarRef.current.style.width = `${percent}%`;
    }
    if (timeCurrentRef.current) {
      timeCurrentRef.current.textContent = formatTime(storeProgress);
    }
    
    animationRef.current = requestAnimationFrame(updateUI);
  }, [duration]);

  useEffect(() => {
    if (isPlayerExpanded && isPlaying) {
      animationRef.current = requestAnimationFrame(updateUI);
    } else {
      cancelAnimationFrame(animationRef.current);
      // Final sync when paused
      if (isPlayerExpanded) {
        const storeProgress = useMusicStore.getState().progress;
        if (progressBarRef.current) {
          const percent = (storeProgress / (duration || 1)) * 100;
          progressBarRef.current.style.width = `${percent}%`;
        }
        if (timeCurrentRef.current) {
          timeCurrentRef.current.textContent = formatTime(storeProgress);
        }
      }
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlayerExpanded, isPlaying, updateUI, duration]);

  const handleSeek = (e) => {
    if (roomId && !isHost) {
      toast.error("Only Host can seek", { id: 'fs-seek-warn' });
      return;
    }
    const time = parseFloat(e.target.value);
    setProgress(time);
    if (progressBarRef.current) {
      progressBarRef.current.style.width = `${(time / (duration || 1)) * 100}%`;
    }
  };

  const handleTogglePlay = () => {
    // Robust Host Check
    if (roomId && !isHost) {
      toast.error("You are listening together. Only Host controls playback.", { id: 'fs-play-warn' });
      return;
    }
    setIsPlaying(!isPlaying);
  };

  const handleShare = () => {
    const text = `Listening to ${currentSong.title} by ${currentSong.artist} on Elevengram Music!`;
    navigator.clipboard.writeText(text);
    toast.success("Song info copied to clipboard!", { icon: '🔗' });
  };

  const handleLike = () => {
    toast.success("Added to your Liked Songs", { icon: '❤️' });
  };

  const handleQueueOpen = () => {
    setPlayerExpanded(false);
    setTimeout(() => togglePanel(true), 300);
  };

  const colors = useMemo(() => {
    if (!currentSong) return ['#4f46e5', '#ec4899', '#06b6d4'];
    const id = currentSong.id || 'default';
    const hue1 = (id.charCodeAt(0) * 10) % 360;
    const hue2 = (id.charCodeAt(id.length - 1) * 15) % 360;
    const hue3 = (hue1 + 120) % 360;
    return [
      `hsl(${hue1}, 70%, 35%)`,
      `hsl(${hue2}, 70%, 35%)`,
      `hsl(${hue3}, 70%, 35%)`
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
          <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.2em', opacity: 0.6 }}>
            {roomId ? `SYNCED ROOM: ${roomId}` : 'ELEVENGRAM MUSIC'}
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
          <p dangerouslySetInnerHTML={{ __html: currentSong.artist }} style={{ display: 'block', opacity: 0.7 }} />
        </div>
      </div>

      {/* Footer: Controls & Seek */}
      <div className="player-controls-footer">
        <div className="progress-section">
          <div className="time-row">
            <span ref={timeCurrentRef}>0:00</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="seek-bar-container">
            <div 
              ref={progressBarRef}
              className="seek-bar-fill" 
            />
            <input 
              type="range"
              className="seek-input-fs"
              min="0"
              max={duration || 0}
              step="0.1"
              defaultValue="0"
              onChange={handleSeek}
            />
          </div>
        </div>

        <div className="main-controls-row">
          <button className="fs-control-btn" onClick={playPrevious}>
            <SkipBack size={32} fill="currentColor" />
          </button>
          
          <button 
            className="fs-control-btn fs-play-btn"
            onClick={handleTogglePlay}
          >
            {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" style={{ marginLeft: 4 }} />}
          </button>

          <button className="fs-control-btn" onClick={playNext}>
            <SkipForward size={32} fill="currentColor" />
          </button>
        </div>

        {/* Up Next Preview */}
        {nextSong && (
          <div className="up-next-mini-card" onClick={playNext}>
            <div className="up-next-label">UP NEXT</div>
            <div className="up-next-content">
              <img src={nextSong.image} alt={nextSong.title} />
              <div className="up-next-info">
                <span dangerouslySetInnerHTML={{ __html: nextSong.title }} />
                <p dangerouslySetInnerHTML={{ __html: nextSong.artist }} />
              </div>
              <ChevronRight size={16} />
            </div>
          </div>
        )}

        <div className="bottom-actions">
          <button className="fs-control-btn" onClick={handleLike}>
            <Heart size={22} />
          </button>
          <button className="fs-control-btn" onClick={handleShare}>
            <Share2 size={22} />
          </button>
          <button className="fs-control-btn" onClick={handleQueueOpen}>
            <ListMusic size={22} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default FullscreenPlayer;
