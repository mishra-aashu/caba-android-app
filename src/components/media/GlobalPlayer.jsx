import React, { useRef, useEffect, useCallback } from 'react';
import useMusicStore from '../../store/useMusicStore';
import { Play, Pause, SkipBack, SkipForward, Maximize2, Music } from 'lucide-react';
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
    isPanelOpen
  } = useMusicStore();

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const animationRef = useRef(null);

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
        audioRef.current.src = currentSong.media_url;
        audioRef.current.load();
        if (isPlaying) {
          audioRef.current.play().catch(e => console.warn("Playback blocked:", e));
        }
      }
    } else {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, [currentSong]);

  useEffect(() => {
    if (!audioRef.current || !currentSong) return;
    
    if (isPlaying) {
      audioRef.current.play().catch(e => {
        console.warn("Playback failed:", e);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Occasional store sync for progress (not every frame)
  const onTimeUpdate = () => {
    if (audioRef.current && Math.abs(audioRef.current.currentTime - progress) > 1) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
      if (progressBarRef.current) {
        const percent = (time / audioRef.current.duration) * 100;
        progressBarRef.current.style.width = `${percent}%`;
      }
    }
  };

  if (!currentSong) return null;

  return (
    <div className={`global-player-wrapper ${isPanelOpen ? 'hidden' : ''}`}>
      <audio 
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="auto"
      />
      
      <div className="player-progress-container">
        <div 
          ref={progressBarRef}
          className="player-progress-fill" 
          style={{ width: `${(progress / duration) * 100}%` }} 
        />
        <input 
          type="range" 
          className="player-seek-slider"
          min="0"
          max={duration || 0}
          value={progress}
          onChange={handleSeek}
        />
      </div>

      <div className="player-content">
        <div className="player-left" onClick={() => togglePanel(true)}>
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

        <div className="player-center">
          <button className="player-btn-icon secondary">
            <SkipBack size={20} fill="currentColor" />
          </button>
          
          <button 
            className="player-btn-main" 
            onClick={() => setIsPlaying(!isPlaying)}
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
          <button className="player-btn-icon expand" onClick={() => togglePanel(true)}>
            <Maximize2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalPlayer;
