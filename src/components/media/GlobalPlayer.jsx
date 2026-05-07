import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import useMusicStore from '../../store/useMusicStore';
import useChatStore from '../../store/useChatStore';
import useIsDesktop from '../../hooks/useIsDesktop';
import { Play, Pause, SkipBack, SkipForward, Maximize2, Music, X, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { extractColorsFromImage } from '../../utils/colorExtractor';
import MusicPlayerService from '../../services/MusicPlayerService';
import { db } from '../../db/db';
import './GlobalPlayer.css';

/**
 * GlobalPlayer – Refactored to use MusicPlayerService for unified playback.
 */

const formatTime = (sec) => {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const GlobalPlayer = ({ showBottomNav = false, isMusicHub = false }) => {
  const currentSong = useMusicStore(state => state.currentSong);
  const isPlaying = useMusicStore(state => state.isPlaying);
  const setIsPlaying = useMusicStore(state => state.setIsPlaying);
  const progress = useMusicStore(state => state.progress);
  const setProgress = useMusicStore(state => state.setProgress);
  const duration = useMusicStore(state => state.duration);
  const setDuration = useMusicStore(state => state.setDuration);
  const volume = useMusicStore(state => state.volume);
  const isPanelOpen = useMusicStore(state => state.isPanelOpen);
  const isPlayerExpanded = useMusicStore(state => state.isPlayerExpanded);
  const setPlayerExpanded = useMusicStore(state => state.setPlayerExpanded);
  const setCurrentSong = useMusicStore(state => state.setCurrentSong);
  const extractedColors = useMusicStore(state => state.extractedColors);
  const setExtractedColors = useMusicStore(state => state.setExtractedColors);
  const roomId = useMusicStore(state => state.roomId);
  const isHost = useMusicStore(state => state.isHost);

  const isDesktop = useIsDesktop();
  const progressBarRef = useRef(null);
  const [isOfflineAvailable, setIsOfflineAvailable] = useState(false);
  const isFloating = !showBottomNav && !isDesktop;

  // ── 0. Offline Awareness ───────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    if (currentSong?.id) {
      db.offline_music_store.get(currentSong.id).then(data => {
        if (isMounted) setIsOfflineAvailable(data?.download_status === 'completed');
      });
    } else {
      setIsOfflineAvailable(false);
    }
    return () => { isMounted = false; };
  }, [currentSong?.id]);

  // ── 1. Color Extraction ─────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    if (currentSong?.image) {
      extractColorsFromImage(currentSong.image).then(colors => {
        if (isMounted && colors) setExtractedColors(colors);
      });
    } else {
      setExtractedColors(null);
    }
    return () => { isMounted = false; };
  }, [currentSong?.image, setExtractedColors]);

  // ── 2. Playback Controller (Reactive to Store) ─────────────────
  useEffect(() => {
    if (!currentSong) {
      MusicPlayerService.pause();
      return;
    }

    if (isPlaying) {
      MusicPlayerService.play(currentSong);
    } else {
      MusicPlayerService.pause();
    }
  }, [currentSong?.id, currentSong?.media_url, isPlaying]);

  // ── 3. Volume Sync ──────────────────────────────────────────────
  useEffect(() => {
    MusicPlayerService.setVolume(volume);
  }, [volume]);

  // ── 4. Progress Bar Sync ────────────────────────────────────────
  useEffect(() => {
    if (progressBarRef.current && duration > 0) {
      const percent = (progress / duration) * 100;
      progressBarRef.current.style.width = `${percent}%`;
    }
  }, [progress, duration]);

  // ── 5. Media Session API (Simplified) ──────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;

    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: currentSong.title?.replace(/&quot;/g, '"') || 'Unknown Title',
      artist: currentSong.artist?.replace(/&quot;/g, '"') || 'Unknown Artist',
      artwork: [{ src: currentSong.image || '', sizes: '512x512', type: 'image/png' }],
    });

    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler('previoustrack', () => useMusicStore.getState().playPrevious());
    navigator.mediaSession.setActionHandler('nexttrack', () => useMusicStore.getState().playNext());
  }, [currentSong, setIsPlaying]);

  if (!currentSong) return null;

  const isHidden = isPanelOpen || isPlayerExpanded;
  const themeColor = extractedColors ? extractedColors[0] : '#00ff88';

  return (
    <div 
      className={`global-player-root ${isHidden ? 'hidden' : ''}`}
      style={{ '--brand-primary': themeColor }}
    >
      <AnimatePresence mode="wait">
        {isFloating ? (
          <motion.div
            key="bubble-player"
            className="floating-bubble-player"
            drag
            dragConstraints={{
              left: -window.innerWidth + 80,
              right: 20,
              top: -window.innerHeight + 150,
              bottom: 20,
            }}
            initial={{ scale: 0, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setPlayerExpanded(true)}
            style={{ bottom: isMusicHub ? '160px' : '100px' }}
          >
            <svg className="bubble-progress-svg" viewBox="0 0 100 100">
              <circle className="bubble-bg-circle" cx="50" cy="50" r="46" />
              <motion.circle
                className="bubble-progress-circle"
                cx="50"
                cy="50"
                r="46"
                style={{ pathLength: (progress / (duration || 1)) || 0 }}
              />
            </svg>

            <div className="bubble-art-wrap">
              {currentSong.image ? (
                <img src={currentSong.image} alt="" className={isPlaying ? 'spinning' : ''} />
              ) : (
                <Music size={24} color="#00ff88" />
              )}
              {isOfflineAvailable && (
                <div className="bubble-cached-badge" title="Downloaded">
                  <Zap size={10} fill="currentColor" />
                </div>
              )}
            </div>

            <button
              className="bubble-play-overlay"
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying(!isPlaying);
              }}
            >
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="play-offset" />}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="bar-player"
            className="global-player-wrapper"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            onClick={() => setPlayerExpanded(true)}
            style={{
              cursor: 'pointer',
              bottom: isDesktop ? '24px' : (isMusicHub || showBottomNav) ? 'calc(var(--bottom-nav-total-height, 60px) + 14px)' : '14px',
            }}
          >
            <div className="player-progress-container">
              <div ref={progressBarRef} className="player-progress-fill" />
              <input
                type="range"
                className="player-seek-slider"
                min="0"
                max={duration || 0}
                step="0.1"
                value={progress || 0}
                onChange={(e) => {
                  if (!isHost && roomId) {
                    toast.error('Only Host can seek', { id: 'host-only' });
                    return;
                  }
                  MusicPlayerService.seekTo(parseFloat(e.target.value));
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="player-content">
              <div className="player-time-labels">
                <span className="time-current">{formatTime(progress)}</span>
                <span className="time-divider">/</span>
                <span className="time-total">{formatTime(duration)}</span>
              </div>

              <div className="player-left">
                <div className="player-artwork-mini">
                  {currentSong.image ? <img src={currentSong.image} alt="" /> : <Music size={20} />}
                </div>
                <div className="player-info-mini">
                  <div className="mini-title-scroller">
                    <span className="mini-title-text" dangerouslySetInnerHTML={{ __html: currentSong.title }} />
                    {isOfflineAvailable && <Zap size={12} className="cached-icon" fill="currentColor" title="Playing Offline" />}
                  </div>
                  <span className="mini-artist-text" dangerouslySetInnerHTML={{ __html: currentSong.artist }} />
                </div>
              </div>

              <div className="player-center" onClick={(e) => e.stopPropagation()}>
                <button className="player-btn-icon secondary" onClick={() => useMusicStore.getState().playPrevious()}>
                  <SkipBack size={20} fill="currentColor" />
                </button>
                <button
                  className={`player-btn-main ${!isHost && roomId ? 'disabled' : ''}`}
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="play-icon-offset" />}
                </button>
                <button className="player-btn-icon secondary" onClick={() => useMusicStore.getState().playNext()}>
                  <SkipForward size={20} fill="currentColor" />
                </button>
              </div>

              <div className="player-right" onClick={(e) => e.stopPropagation()}>
                <button className="player-btn-icon expand" onClick={() => setPlayerExpanded(true)}>
                  <Maximize2 size={18} />
                </button>
                <button
                  className="player-btn-icon close-btn"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentSong(null);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GlobalPlayer;