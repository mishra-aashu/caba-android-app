import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useMusicStore from '../../store/useMusicStore';
import useAuthStore from '../../store/authStore';
import { ChevronDown, MoreHorizontal, SkipBack, SkipForward, Play, Pause, Share2, ListMusic, Heart, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './FullscreenPlayer.css';

const FullscreenPlayer = () => {
  const navigate = useNavigate();
  const { 
    currentSong, isPlaying, setIsPlaying, 
    duration,
    isPlayerExpanded, setPlayerExpanded,
    isHost, roomId,
    playNext, playPrevious,
    setProgress,
    searchResults,
    likedSongs, toggleLikeSong,
    recommendations, activeTab
  } = useMusicStore();

  const dragControls = useDragControls();
  const user = useAuthStore(state => state.user);

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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
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
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
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
    if (!currentSong) return;
    toggleLikeSong(currentSong, user?.id);
  };

  const handleQueueOpen = () => {
    setPlayerExpanded(false);
    setTimeout(() => navigate('/listen-together'), 300);
  };

  const handlePrevious = () => {
    if (roomId && !isHost) {
      toast.error("Only Host can change songs", { id: 'fs-prev-warn' });
      return;
    }
    playPrevious();
  };

  const handleNext = () => {
    if (roomId && !isHost) {
      toast.error("Only Host can change songs", { id: 'fs-next-warn' });
      return;
    }
    playNext();
  };

  const colors = useMemo(() => {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const baseLightness = isDarkMode ? 30 : 40;
    const baseSaturation = isDarkMode ? 70 : 75;

    if (!currentSong) {
      return isDarkMode 
        ? ['hsl(220, 65%, 25%)', 'hsl(280, 60%, 28%)', 'hsl(180, 65%, 26%)', 'hsl(340, 60%, 27%)', 'hsl(140, 65%, 25%)']
        : ['hsl(220, 75%, 45%)', 'hsl(280, 70%, 48%)', 'hsl(180, 75%, 46%)', 'hsl(340, 70%, 47%)', 'hsl(140, 75%, 45%)'];
    }
    
    const id = currentSong.id || 'default';
    const seed1 = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seed2 = id.length;
    
    const hue1 = (seed1 * 13) % 360;
    const hue2 = (seed1 * 21 + seed2 * 17) % 360;
    const hue3 = (hue1 + 72) % 360;
    const hue4 = (hue2 + 144) % 360;
    const hue5 = (hue1 + 216) % 360;
    
    return [
      `hsl(${hue1}, ${baseSaturation}%, ${baseLightness}%)`,
      `hsl(${hue2}, ${baseSaturation}%, ${baseLightness}%)`,
      `hsl(${hue3}, ${baseSaturation}%, ${baseLightness}%)`,
      `hsl(${hue4}, ${baseSaturation}%, ${baseLightness}%)`,
      `hsl(${hue5}, ${baseSaturation}%, ${baseLightness}%)`
    ];
  }, [currentSong?.id]);

  const containerVariants = {
    initial: { 
      y: '100%', 
      opacity: 0,
      transition: { duration: 0 }
    },
    animate: { 
      y: 0, 
      opacity: 1,
      transition: {
        type: 'spring',
        damping: 30,
        stiffness: 300,
        mass: 0.8
      }
    },
    exit: { 
      y: '100%', 
      opacity: 0,
      transition: {
        type: 'tween',
        ease: 'easeIn',
        duration: 0.25
      }
    }
  };

  if (!isPlayerExpanded || !currentSong) return null;

  const isLiked = likedSongs.some(s => s.id === currentSong.id);

  return (
    <motion.div 
      key="fullscreen-player"
      className="fullscreen-player-overlay"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      drag="y"
      dragControls={dragControls}
      dragListener={false}
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
        <div className="blob blob-4" style={{ backgroundColor: colors[3] }} />
        <div className="blob blob-5" style={{ backgroundColor: colors[4] }} />
      </div>

      {/* Header */}
      <div className="player-header" onPointerDown={(e) => dragControls.start(e)}>
        <div className="player-drag-handle" />
        <button 
          className="header-btn" 
          onClick={() => setPlayerExpanded(false)}
          aria-label="Close player"
        >
          <ChevronDown size={24} />
        </button>
        <div className="header-meta">
          <span>
            {roomId ? `SYNCED ROOM: ${roomId}` : 'ELEVENGRAM MUSIC'}
          </span>
        </div>
        <button className="header-btn" aria-label="More options">
          <MoreHorizontal size={24} />
        </button>
      </div>

      {/* Scrollable Content Container */}
      <div className="fullscreen-player-scrollable">
        <div className="scroll-content-inner">
          {/* Main Content: Artwork & Title */}
          <div className="player-main-content">
            <div className={`artwork-container ${isPlaying ? 'playing' : ''}`}>
              <img 
                src={currentSong.image} 
                alt={currentSong.title}
                loading="eager"
              />
            </div>

            <div className="song-info-expanded">
              <h2 dangerouslySetInnerHTML={{ __html: currentSong.title }} />
              <p dangerouslySetInnerHTML={{ __html: currentSong.artist }} />
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
                <div ref={progressBarRef} className="seek-bar-fill" />
                <input 
                  type="range"
                  className="seek-input-fs"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  defaultValue="0"
                  onChange={handleSeek}
                  aria-label="Seek"
                />
              </div>
            </div>

            <div className="main-controls-row">
              <button 
                className="fs-control-btn" 
                onClick={handlePrevious}
                aria-label="Previous song"
              >
                <SkipBack size={32} fill="currentColor" />
              </button>
              
              <button 
                className="fs-control-btn fs-play-btn"
                onClick={handleTogglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause size={36} fill="currentColor" />
                ) : (
                  <Play size={36} fill="currentColor" style={{ marginLeft: 4 }} />
                )}
              </button>

              <button 
                className="fs-control-btn" 
                onClick={handleNext}
                aria-label="Next song"
              >
                <SkipForward size={32} fill="currentColor" />
              </button>
            </div>

            {/* Up Next Preview */}
            {nextSong && (
              <div className="up-next-mini-card" onClick={handleNext}>
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
              <button 
                className={`fs-control-btn ${isLiked ? 'active' : ''}`} 
                onClick={handleLike}
                style={{ color: isLiked ? '#ff4b4b' : 'inherit' }}
                aria-label={isLiked ? "Unlike" : "Like"}
              >
                <Heart 
                  size={22} 
                  fill={isLiked ? "currentColor" : "none"} 
                  strokeWidth={isLiked ? 0 : 2} 
                />
              </button>
              <button 
                className="fs-control-btn" 
                onClick={handleShare}
                aria-label="Share"
              >
                <Share2 size={22} />
              </button>
              <button 
                className="fs-control-btn" 
                onClick={handleQueueOpen}
                aria-label="View queue"
              >
                <ListMusic size={22} />
              </button>
            </div>
          </div>

          {/* Recommendations Section */}
          <div className="player-recommendations-section">
            <div className="section-header">
              <h3>Recommended for You</h3>
              <div className="section-tag">More like this</div>
            </div>
            
            <div className="recommendations-list">
              {recommendations.length > 0 ? (
                recommendations.map((song, i) => (
                  <motion.div 
                    key={song.id + i} 
                    className={`recommendation-item ${currentSong.id === song.id ? 'active' : ''}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => {
                      useMusicStore.getState().setCurrentSong(song);
                      // Scroll back to top smoothly when a new song is picked
                      document.querySelector('.fullscreen-player-scrollable')?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div className="rec-art">
                      <img src={song.image} alt="" />
                      {currentSong.id === song.id && isPlaying && (
                        <div className="rec-visualizer">
                          <div className="v-bar" />
                          <div className="v-bar" />
                          <div className="v-bar" />
                        </div>
                      )}
                    </div>
                    <div className="rec-info">
                      <h4 dangerouslySetInnerHTML={{ __html: song.title }} />
                      <p dangerouslySetInnerHTML={{ __html: song.artist }} />
                    </div>
                    <button className="rec-play-btn">
                      {currentSong.id === song.id && isPlaying ? (
                        <Pause size={16} fill="currentColor" />
                      ) : (
                        <Play size={16} fill="currentColor" />
                      )}
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="recs-loading">
                  <div className="loading-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <p>Finding more music for you...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default FullscreenPlayer;