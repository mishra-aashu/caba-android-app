import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import useMusicStore from '../../store/useMusicStore';
import useChatStore from '../../store/useChatStore';
import useIsDesktop from '../../hooks/useIsDesktop';
import { Play, Pause, SkipBack, SkipForward, Maximize2, Music, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './GlobalPlayer.css';

/**
 * GlobalPlayer – optimized for smooth, uninterrupted playback.
 * 
 * Key improvements over the previous version:
 *  • Single state‑machine style audio controller (no competing useEffect hooks)
 *  • Proper Promise‑based play queue to avoid AbortError stutters
 *  • Pre‑load next song in a hidden Audio element for almost gapless transitions
 *  • High‑frequency progress sync (rAF) with throttled store updates (every 150ms)
 *  • No hard‑coded 500ms gap – the next track begins immediately on end
 */

// ─── helpers ──────────────────────────────────────────────────────
const formatTime = (sec) => {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// ─── component ────────────────────────────────────────────────────
const GlobalPlayer = ({ showBottomNav = false }) => {
  const {
    currentSong,
    isPlaying,
    setIsPlaying,
    progress,
    setProgress,
    duration,
    setDuration,
    volume,
    togglePanel,
    isPanelOpen,
    isPlayerExpanded,
    refreshCurrentSongMetadata,
    setCurrentSong,
    roomId,
    isHost,
    setPlayerExpanded,
    lastSeekTo,
  } = useMusicStore();

  const isDesktop = useIsDesktop();
  const location = useLocation();
  const activeChatId = useChatStore((state) => state.activeChatId);
  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const animFrameId = useRef(null);
  const lastStoreSyncRef = useRef(0);
  const isRefreshing = useRef(false);
  const retryCount = useRef(0);
  const playPromiseRef = useRef(null);

  // Preload audio element for the next track (avoids gap)
  const preloadAudioRef = useRef(null);

  // Floating bubble position (for drag)
  const [bubblePos, setBubblePos] = useState({ x: 0, y: 0 });
  const isFloating = !showBottomNav;

  // ── 1. High‑performance UI loop (rAF) ──────────────────────────
  const updateUI = useCallback(() => {
    const audio = audioRef.current;
    const bar = progressBarRef.current;
    if (audio && bar && audio.duration) {
      const cur = audio.currentTime;
      const dur = audio.duration;
      const percent = (cur / dur) * 100;
      bar.style.width = `${percent}%`;

      // Sync store progress every ~150ms (not every frame)
      const now = performance.now();
      if (now - lastStoreSyncRef.current > 150) {
        setProgress(cur);
        setDuration(dur);
        lastStoreSyncRef.current = now;
      }
    }
    animFrameId.current = requestAnimationFrame(updateUI);
  }, [setProgress, setDuration]);

  useEffect(() => {
    if (isPlaying) {
      animFrameId.current = requestAnimationFrame(updateUI);
    } else {
      // Final sync when paused
      const audio = audioRef.current;
      if (audio && audio.duration) {
        setProgress(audio.currentTime);
        setDuration(audio.duration);
      }
      cancelAnimationFrame(animFrameId.current);
    }
    return () => cancelAnimationFrame(animFrameId.current);
  }, [isPlaying, updateUI]);

  // ── 2. Unified Audio Controller (song + play/pause + preload) ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // If no song or no valid URL → stop and clear
    if (!currentSong?.id || !currentSong.media_url) {
      if (!audio.paused) audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    const srcChanged = audio.src !== currentSong.media_url;

    // --- Source Change ---
    if (srcChanged) {
      retryCount.current = 0;
      audio.src = currentSong.media_url;
      audio.load();

      // Restore progress if already defined (e.g., from a previous session)
      if (progress > 0) {
        audio.currentTime = progress;
      }
    }

    // --- Play / Pause Intent ---
    const executePlay = () => {
      // Always wait for the previous play promise to settle to avoid AbortError
      if (playPromiseRef.current) {
        playPromiseRef.current
          .catch(() => {})
          .finally(() => {
            playPromiseRef.current = null;
            attemptPlay();
          });
      } else {
        attemptPlay();
      }
    };

    const attemptPlay = () => {
      const p = audio.play();
      if (p !== undefined) {
        playPromiseRef.current = p;
        p.catch((e) => {
          if (e.name === 'AbortError') return; // interrupted by pause / new play – ignore
          console.warn('[Player] Play failed:', e);
          if (e.name === 'NotSupportedError') {
            refreshIfNeeded();
          } else if (e.name === 'NotAllowedError') {
            setIsPlaying(false);
          }
        });
      }
    };

    const refreshIfNeeded = () => {
      if (isRefreshing.current) return;
      isRefreshing.current = true;
      refreshCurrentSongMetadata().finally(() => {
        isRefreshing.current = false;
      });
    };

    if (isPlaying) {
      executePlay();
    } else {
      // Only pause if the audio is actually playing (avoid redundant pause)
      if (!audio.paused) {
        audio.pause();
      }
      // Cancel any pending play promise
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {});
        playPromiseRef.current = null;
      }
    }

    // --- Preload next track (gapless) ---
    // We create a hidden Audio element and load the next song's URL
    if (!preloadAudioRef.current) {
      preloadAudioRef.current = new Audio();
      preloadAudioRef.current.preload = 'auto';
    }

    const playlist =
      useMusicStore.getState().recommendations.length > 0
        ? useMusicStore.getState().recommendations
        : useMusicStore.getState().searchResults;

    if (playlist.length > 1) {
      const currentIndex = playlist.findIndex((s) => s.id === currentSong.id);
      const nextIndex = (currentIndex + 1) % playlist.length;
      const nextSong = playlist[nextIndex];
      if (nextSong && nextSong.media_url) {
        // Preload if not already loaded
        if (preloadAudioRef.current.src !== nextSong.media_url) {
          preloadAudioRef.current.src = nextSong.media_url;
          preloadAudioRef.current.load();
        }
      }
    }
  }, [currentSong, isPlaying]); // runs only when song or play state changes

  // ── 3. Volume Sync ──────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // ── 4. Explicit Seek (e.g., from FullscreenPlayer) ──────────────
  useEffect(() => {
    if (audioRef.current && lastSeekTo) {
      audioRef.current.currentTime = progress;
    }
  }, [lastSeekTo]);

  // ── 5. Event Handlers ──────────────────────────────────────────
  const onLoadedMetadata = () => {
    const dur = audioRef.current?.duration;
    if (dur && dur !== duration) setDuration(dur);
  };

  const onDurationChange = () => {
    const dur = audioRef.current?.duration;
    if (dur) setDuration(dur);
  };

  const onPlay = () => {
    setIsPlaying(true);
    retryCount.current = 0;
  };
  const onPause = () => setIsPlaying(false);

  const onError = (e) => {
    const err = audioRef.current?.error;
    if (!err || err.code === 1 || err.message?.includes('Empty src')) return;

    const realError =
      err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ||
      err.code === MediaError.MEDIA_ERR_NETWORK;

    if (realError && currentSong?.id && !isRefreshing.current && retryCount.current < 2) {
      isRefreshing.current = true;
      retryCount.current += 1;
      toast.loading(`Refreshing stream... (${retryCount.current}/2)`, { id: 'music-refresh' });
      refreshCurrentSongMetadata().finally(() => {
        isRefreshing.current = false;
      });
    } else if (retryCount.current >= 2) {
      toast.error('Stream unavailable. Try another song.', { id: 'music-refresh' });
      setIsPlaying(false);
      retryCount.current = 0;
    }
  };

  // ── 6. Instant next‑track (no 500ms gap!) ─────────────────────
  const onEnded = () => {
    console.log('[Player] Song ended, going to next...');
    // Immediately advance – the useEffect will pick up the new song and play
    useMusicStore.getState().playNext();
  };

  // ── 7. Seek handling (slider) ──────────────────────────────────
  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio && audio.duration) {
      audio.currentTime = time;
      setProgress(time);
      // Update progress bar immediately
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${(time / audio.duration) * 100}%`;
      }
    }
  };

  // ── 8. Bubble / Bar UI ─────────────────────────────────────────
  if (!currentSong) return null;

  const isHidden = isPanelOpen || isPlayerExpanded;

  return (
    <div className={`global-player-root ${isHidden ? 'hidden' : ''}`}>
      {/* Main audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {}} // we use rAF instead, no need for extra handler
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onDurationChange}
        onError={onError}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        preload="auto"
        crossOrigin="anonymous" // useful if CORS is needed
      />

      <AnimatePresence mode="wait">
        {isFloating ? (
          /* ── Floating Bubble Player ── */
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
            dragElastic={0.1}
            dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
            initial={{ scale: 0, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setPlayerExpanded(true)}
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
          /* ── Standard Bottom Bar Player ── */
          <motion.div
            key="bar-player"
            className="global-player-wrapper"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            onClick={() => setPlayerExpanded(true)}
            style={{
              cursor: 'pointer',
              bottom: isDesktop ? undefined : showBottomNav ? 'var(--bottom-nav-total-height)' : '0px',
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
                  handleSeek(e);
                }}
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
                  {currentSong.image ? (
                    <img src={currentSong.image} alt="" />
                  ) : (
                    <Music size={20} />
                  )}
                </div>
                <div className="player-info-mini">
                  <div className="mini-title-scroller">
                    <span className="mini-title-text" dangerouslySetInnerHTML={{ __html: currentSong.title }} />
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