import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, useDragControls, AnimatePresence } from 'framer-motion';
import useMusicStore from '../../store/useMusicStore';
import useAuthStore from '../../store/authStore';
import {
  ChevronDown, MoreHorizontal, SkipBack, SkipForward,
  Play, Pause, Share2, ListMusic, Heart, ChevronRight,
  Repeat, Repeat1, Download, CheckCircle, Loader2
} from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import OfflineMusicManager from '../../services/OfflineMusicManager';
import './FullscreenPlayer.css';

const FullscreenPlayer = () => {
  const {
    currentSong, isPlaying, setIsPlaying,
    duration,
    progress, setProgress, seekTo,
    isPlayerExpanded, setPlayerExpanded,
    isHost, roomId,
    playNext, playPrevious,
    searchResults,
    likedSongs, toggleLikeSong,
    recommendations,
    repeatMode, toggleRepeatMode,
    extractedColors,
    downloadProgress,
  } = useMusicStore();

  const [isFullyExpanded, setIsFullyExpanded] = useState(false);
  const dragControls = useDragControls();
  const user = useAuthStore((state) => state.user);
  const progressBarRef = useRef(null);
  const timeCurrentRef = useRef(null);
  const recommendationsRef = useRef(null);

  // Reset fully expanded state when player closes
  useEffect(() => {
    if (!isPlayerExpanded) {
      setIsFullyExpanded(false);
    }
  }, [isPlayerExpanded]);

  // ─── Helpers ──────────────────────────────────────────────────
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ─── Reactive progress bar & time (no rAF) ────────────────────
  useEffect(() => {
    if (progressBarRef.current && duration > 0) {
      progressBarRef.current.style.width = `${(progress / duration) * 100}%`;
    }
    if (timeCurrentRef.current) {
      timeCurrentRef.current.textContent = formatTime(progress);
    }
  }, [progress, duration]);   // runs every time store updates

  // ─── Derived playlist (stable references) ─────────────────────
  const playlist = useMemo(() => {
    return recommendations.length > 0 ? recommendations : searchResults;
  }, [recommendations, searchResults]);

  const nextSong = useMemo(() => {
    if (!currentSong || playlist.length === 0) return null;
    const idx = playlist.findIndex((s) => s.id === currentSong.id);
    const nextIdx = idx === -1 || idx === playlist.length - 1 ? 0 : idx + 1;
    return playlist[nextIdx];
  }, [currentSong?.id, playlist]);   // depends only on ID

  // ─── Colors (as before) ────────────────────────────────────────
  const colors = useMemo(() => {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // If we have extracted colors, use them
    if (extractedColors && extractedColors.length >= 5) {
      return extractedColors;
    }

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
      `hsl(${hue5}, ${baseSaturation}%, ${baseLightness}%)`,
    ];
  }, [currentSong?.id, extractedColors]);

  // ─── Native UI Polish (Status Bar) ───────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const updateStatusBar = async () => {
      try {
        if (isPlayerExpanded) {
          // Set to dominant color of artwork
          await StatusBar.setBackgroundColor({ color: colors[0] || '#13131f' });
          await StatusBar.setStyle({ style: Style.Dark });
        } else {
          // Reset to default dark
          await StatusBar.setBackgroundColor({ color: '#0b141a' });
          await StatusBar.setStyle({ style: Style.Dark });
        }
      } catch (e) {
        console.warn('[StatusBar] Update failed:', e);
      }
    };

    const timer = setTimeout(updateStatusBar, 400);
    return () => clearTimeout(timer);
  }, [isPlayerExpanded, colors]);

  // ─── Handlers ─────────────────────────────────────────────────
  const triggerHaptic = useCallback((style = ImpactStyle.Light) => {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style });
    }
  }, []);

  const handleSeek = (e) => {
    if (roomId && !isHost) {
      toast.error('Only Host can seek', { id: 'fs-seek-warn' });
      return;
    }
    const time = parseFloat(e.target.value);
    seekTo(time);   // store handles audio sync
  };

  const handleContainerClick = (e) => {
    if (roomId && !isHost) {
      toast.error('Only Host can seek', { id: 'fs-seek-warn' });
      return;
    }
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    seekTo(percent * duration);
  };

  const handleTogglePlay = () => {
    if (roomId && !isHost) {
      toast.error('You are listening together. Only Host controls playback.', { id: 'fs-play-warn' });
      return;
    }
    triggerHaptic(ImpactStyle.Medium);
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (roomId && !isHost) {
      toast.error('Only Host can change songs', { id: 'fs-next-warn' });
      return;
    }
    triggerHaptic(ImpactStyle.Light);
    playNext();
  };

  const handlePrevious = () => {
    if (roomId && !isHost) {
      toast.error('Only Host can change songs', { id: 'fs-prev-warn' });
      return;
    }
    triggerHaptic(ImpactStyle.Light);
    playPrevious();
  };

  const handleShare = () => {
    const text = `Listening to ${currentSong?.title} by ${currentSong?.artist} on Elevengram Music!`;
    navigator.clipboard.writeText(text);
    toast.success('Song info copied to clipboard!', { icon: '🔗' });
  };

  const handleLike = () => {
    if (!currentSong) return;
    toggleLikeSong(currentSong, user?.id);
  };

  const scrollToRecommendations = () => {
    recommendationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDownload = () => {
    if (!currentSong) return;
    OfflineMusicManager.downloadSong(currentSong);
  };

  // Remove the exit early return to keep it always in DOM for smoothness
  const isLiked = currentSong ? likedSongs.some((s) => s.id === currentSong.id) : false;

  return (
    <motion.div
      key="fullscreen-player"
      className={`fullscreen-player-overlay ${isFullyExpanded ? 'fully-expanded' : ''}`}
      animate={isPlayerExpanded ? 'animate' : 'initial'}
      variants={{
        initial: { 
          y: '100%', 
          opacity: 0,
          pointerEvents: 'none',
          visibility: 'hidden',
          transition: { duration: 0.3 }
        },
        animate: { 
          y: 0, 
          opacity: 1, 
          pointerEvents: 'auto',
          visibility: 'visible',
          transition: { 
            type: 'tween', 
            ease: [0.32, 0.72, 0, 1],
            duration: 0.35
          } 
        }
      }}
      initial="initial"
      onAnimationComplete={(definition) => {
        if (definition === 'animate') {
          setIsFullyExpanded(true);
        } else {
          setIsFullyExpanded(false);
        }
      }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.02}
      onDragEnd={(_, info) => {
        if (info.offset.y > 100 || info.velocity.y > 500) {
          setPlayerExpanded(false);
        }
      }}
      style={{ 
        '--artwork-dominant-color': colors[0],
        willChange: 'transform',
        transform: 'translateZ(0)',
        background: isFullyExpanded ? 'transparent' : 'var(--bg-primary)',
        display: currentSong ? 'flex' : 'none' // Still hide if no song exists at all
      }}
    >
      {/* Dynamic Animated Background - CSS Transition handled via .fully-expanded class */}
      <div className="dynamic-gradient-bg">
        <div className="blob blob-1" style={{ backgroundColor: colors[0] }} />
        <div className="blob blob-2" style={{ backgroundColor: colors[1] }} />
        <div className="blob blob-3" style={{ backgroundColor: colors[2] }} />
      </div>

      {/* Header */}
      <div className="player-header" onPointerDown={(e) => dragControls.start(e)}>
        <div className="player-drag-handle" />
        <button className="header-btn" onClick={() => setPlayerExpanded(false)} aria-label="Close player">
          <ChevronDown size={24} />
        </button>
        <div className="header-meta">
          <span>{roomId ? `SYNCED ROOM: ${roomId}` : 'ELEVENGRAM MUSIC'}</span>
        </div>
        <button
          className={`header-btn ${repeatMode !== 'off' ? 'active-mode' : ''}`}
          onClick={toggleRepeatMode}
          aria-label={`Repeat mode: ${repeatMode}`}
        >
          {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
        </button>
        <button className="header-btn" aria-label="More options">
          <MoreHorizontal size={24} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="fullscreen-player-scrollable">
        <div className="scroll-content-inner">
          {/* Main Content: Artwork & Title */}
          <div className="player-main-content">
            <div className={`artwork-container ${isPlaying ? 'playing' : ''}`}>
              <img src={currentSong?.image} alt={currentSong?.title} loading="eager" />
            </div>

            <div className="song-info-expanded">
              <h2 dangerouslySetInnerHTML={{ __html: currentSong?.title || '' }} />
              <p dangerouslySetInnerHTML={{ __html: currentSong?.artist || '' }} />
            </div>

            <div className="song-actions-row">
              <button
                className={`fs-action-btn ${repeatMode !== 'off' ? 'active' : ''}`}
                onClick={toggleRepeatMode}
                style={{ color: repeatMode !== 'off' ? '#00ff88' : 'inherit' }}
              >
                {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
              </button>
              <button
                className={`fs-action-btn ${isLiked ? 'active' : ''}`}
                onClick={handleLike}
                style={{ color: isLiked ? '#ff4b4b' : 'inherit' }}
              >
                <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={isLiked ? 0 : 2} />
              </button>
              <button className="fs-action-btn" onClick={handleShare}>
                <Share2 size={20} />
              </button>
              <button 
                className="fs-action-btn download-btn-fs" 
                onClick={handleDownload}
                title={currentSong && downloadProgress[currentSong.id] === 100 ? 'Downloaded' : 'Download'}
              >
                {currentSong && downloadProgress[currentSong.id] === 100 ? (
                  <CheckCircle size={20} color="#00ff88" />
                ) : (currentSong && downloadProgress[currentSong.id] > 0) ? (
                  <div className="download-progress-mini">
                    <Loader2 size={20} className="animate-spin" />
                    <span className="progress-text">{Math.round(downloadProgress[currentSong.id])}%</span>
                  </div>
                ) : (
                  <Download size={20} />
                )}
              </button>
              <button className="fs-action-btn" onClick={scrollToRecommendations}>
                <ListMusic size={20} />
              </button>
            </div>
          </div>

          {/* Footer: Controls & Seek */}
          <div className="player-controls-footer">
            <div className="progress-section">
              <div className="time-row">
                <span ref={timeCurrentRef}>0:00</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="seek-bar-container" onClick={handleContainerClick}>
                <div ref={progressBarRef} className="seek-bar-fill" />
                <input
                  type="range"
                  className="seek-input-fs"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={progress ?? 0}
                  onChange={handleSeek}
                  aria-label="Seek"
                />
              </div>
            </div>

            <div className="main-controls-row">
              <button className="fs-control-btn" onClick={handlePrevious}>
                <SkipBack size={32} fill="currentColor" />
              </button>
              <button className="fs-control-btn fs-play-btn" onClick={handleTogglePlay}>
                {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" style={{ marginLeft: 4 }} />}
              </button>
              <button className="fs-control-btn" onClick={handleNext}>
                <SkipForward size={32} fill="currentColor" />
              </button>
            </div>

            {/* Up Next Preview – disabled when not host in a room */}
            {nextSong && (
              <button
                className={`up-next-mini-card ${roomId && !isHost ? 'disabled' : ''}`}
                onClick={handleNext}
                disabled={!!(roomId && !isHost)}
              >
                <div className="up-next-label">UP NEXT</div>
                <div className="up-next-content">
                  <img src={nextSong.image} alt={nextSong.title} />
                  <div className="up-next-info">
                    <span dangerouslySetInnerHTML={{ __html: nextSong.title }} />
                    <p dangerouslySetInnerHTML={{ __html: nextSong.artist }} />
                  </div>
                  <ChevronRight size={16} />
                </div>
              </button>
            )}

            <div className="bottom-spacing" style={{ height: '24px' }} />
          </div>

          {/* Recommendations Section */}
          <div className="player-recommendations-section" ref={recommendationsRef}>
            <div className="section-header">
              <h3>Recommended for You</h3>
              <div className="section-tag">More like this</div>
            </div>

            <div className="recommendations-list">
              {playlist.length > 0 ? (
                playlist.map((song, i) => (
                  <motion.div
                    key={song.id + i}
                    className={`recommendation-item ${currentSong.id === song.id ? 'active' : ''}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => {
                      useMusicStore.getState().setCurrentSong(song);
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
                      {currentSong.id === song.id && isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="recs-loading">
                  <div className="loading-dots"><span /><span /><span /></div>
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