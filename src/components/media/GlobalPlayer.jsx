import React, { useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import useMusicStore from '../../store/useMusicStore';
import { Play, Pause, SkipBack, SkipForward, Maximize2, Music, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './GlobalPlayer.css';

/**
 * GlobalPlayer Component
 * A sticky "floating" player that persists across the app.
 * Integrated with useMusicStore for global state control.
 */
const GlobalPlayer = () => {
  const { 
    currentSong, isPlaying, setIsPlaying, 
    progress, setProgress, 
    duration, setDuration,
    volume,
    togglePanel,
    isPanelOpen,
    isPlayerExpanded,
    refreshCurrentSongMetadata,
    setCurrentSong,
    roomId,
    isHost,
    setPlayerExpanded
  } = useMusicStore();

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const animationRef = useRef(null);
  const isRefreshingRef = useRef(false);
  const retryCountRef = useRef(0); // Max retry attempts to prevent infinite loops

  // Animation loop for progress bar (High Performance)
  const updateProgressUI = useCallback(() => {
    if (audioRef.current && progressBarRef.current) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      if (dur > 0) {
        const percent = (cur / dur) * 100;
        progressBarRef.current.style.width = `${percent}%`;
      }
    }
    animationRef.current = requestAnimationFrame(updateProgressUI);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateProgressUI);
    } else {
      cancelAnimationFrame(animationRef.current);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, updateProgressUI]);

  // Sync audio element with store state
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (currentSong?.media_url) {
      if (audioRef.current.src !== currentSong.media_url) {
        console.log("[Player] Source change detected, loading:", currentSong.title);
        retryCountRef.current = 0; // Reset retry count for new song
        
        // Safety: If there was a pending play, we need to handle it
        // but changing .src usually cancels it anyway.
        audioRef.current.src = currentSong.media_url;
        audioRef.current.load();
        
        // Restore progress if persisted
        if (progress > 0) {
          audioRef.current.currentTime = progress;
        }

        if (isPlaying) {
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(e => {
              if (e.name !== 'AbortError') {
                console.warn("[Player] Playback failed:", e);
              }
            });
          }
        }
      }
    } else {
      // No URL or song cleared - pause safely
      if (!audioRef.current.paused) {
        audioRef.current.pause();
      }
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  }, [currentSong]);

  useEffect(() => {
    if (!audioRef.current || !currentSong?.media_url) return;
    
    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          if (e.name === 'AbortError') {
             // Interrupted by pause, ignore
             return;
          }
          console.warn("[Player] Playback failed:", e);
          if (e.name === 'NotSupportedError') {
             if (!isRefreshingRef.current) {
               isRefreshingRef.current = true;
               refreshCurrentSongMetadata().finally(() => {
                 isRefreshingRef.current = false;
               });
             }
          } else if (e.name === 'NotAllowedError') {
            setIsPlaying(false);
          }
        });
      }
    } else {
      // Only pause if not already paused to avoid redundant calls
      if (!audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Occasional store sync for progress (not every frame)
  const onTimeUpdate = () => {
    if (audioRef.current && Math.abs(audioRef.current.currentTime - progress) > 2) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const onAudioError = (e) => {
    const error = audioRef.current?.error;
    
    // CRITICAL: Ignore harmless errors during source transitions
    if (!error || error.code === 1 || error.message?.includes('Empty src')) return;
    
    console.error("[AudioError]", error);
    
    const isRealError = error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || 
                        error.code === MediaError.MEDIA_ERR_NETWORK;
    
    if (isRealError && currentSong?.id && !isRefreshingRef.current && retryCountRef.current < 2) {
      isRefreshingRef.current = true;
      retryCountRef.current += 1;
      
      console.log(`[Player] Attempting refresh ${retryCountRef.current}/2 for: ${currentSong.title}`);
      toast.loading(`Refreshing stream... (${retryCountRef.current}/2)`, { 
        id: 'music-refresh', duration: 3000 
      });
      
      refreshCurrentSongMetadata().then(success => {
        if (!success) {
          toast.error("Stream unavailable. Try another song.", { id: 'music-refresh' });
          setIsPlaying(false);
        }
        // Note: We DON'T reset retryCountRef here anymore. 
        // We only reset it in the 'onPlay' event or on source change.
      }).finally(() => {
        isRefreshingRef.current = false;
      });
    } else if (retryCountRef.current >= 2) {
      toast.error("Stream unavailable. Please select the song again.", { id: 'music-refresh' });
      setIsPlaying(false);
      retryCountRef.current = 0;
    }
  };

  const onPlay = () => {
    console.log("[Player] Playback started successfully");
    retryCountRef.current = 0; // SUCCESS! Reset retries
    setIsPlaying(true);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = time;
      setProgress(time);
      if (progressBarRef.current) {
        const percent = (time / audioRef.current.duration) * 100;
        progressBarRef.current.style.width = `${percent}%`;
      }
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!currentSong) return null;

  return (
    <div className={`global-player-wrapper ${(isPanelOpen || isPlayerExpanded) ? 'hidden' : ''}`}>
      <audio 
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onError={onAudioError}
        onEnded={() => setIsPlaying(false)}
        onPlay={onPlay}
        preload="auto"
      />
      
      <div className="player-progress-container">
        <div 
          ref={progressBarRef}
          className="player-progress-fill" 
          style={{ width: `${(progress / (duration || 1)) * 100}%` }} 
        />
        <input 
          type="range" 
          className="player-seek-slider"
          min="0"
          max={duration || 0}
          step="0.1"
          value={progress || 0}
          onChange={(e) => {
            if (!isHost && roomId) {
              toast.error("Only Host can seek", { id: 'host-only' });
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

        <div 
          className="player-left" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPlayerExpanded(true);
          }}
        >
          <motion.div 
            className="player-artwork-mini" 
            layoutId={`artwork-${currentSong.id}`}
          >
            {currentSong.image ? (
              <img src={currentSong.image} alt="" />
            ) : (
              <Music size={20} />
            )}
          </motion.div>
          <div className="player-info-mini">
            <div className="mini-title-scroller">
               <span className="mini-title-text" dangerouslySetInnerHTML={{ __html: currentSong.title }} />
            </div>
            <span className="mini-artist-text" dangerouslySetInnerHTML={{ __html: currentSong.artist }} />
          </div>
        </div>

        <div className="player-center">
          <button className="player-btn-icon secondary">
            <SkipBack size={20} fill="currentColor" />
          </button>
          
          <button 
            className={`player-btn-main ${(!isHost && roomId) ? 'disabled' : ''}`} 
            onClick={() => {
              if (!isHost && roomId) {
                toast.error("Only Host can control playback", { id: 'host-only', duration: 1000 });
                return;
              }
              setIsPlaying(!isPlaying);
            }}
          >
            {isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" className="play-icon-offset" />
            )}
          </button>
          
          <button className="player-btn-icon secondary">
            <SkipForward size={20} fill="currentColor" />
          </button>
        </div>

        <div className="player-right">
          <button className="player-btn-icon expand" onClick={() => setPlayerExpanded(true)} title="Fullscreen">
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
    </div>
  );
};

export default GlobalPlayer;
