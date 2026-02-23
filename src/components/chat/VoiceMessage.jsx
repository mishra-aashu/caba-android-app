import React, { useState, useRef, useEffect } from 'react';
import { getPublicMediaUrl } from '../../services/mediaService';
import { Play, Pause, LoaderCircle, AlertTriangle } from 'lucide-react';
import './VoiceMessage.css';

const VoiceMessage = ({ message, repliedMsg, isSender, time, status, currentUserId }) => {
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const waveformRef = useRef(null);

  useEffect(() => {
    const fetchAudioUrl = () => {
      const mediaPath = message.mediaPath || message.media_path;
      if (!mediaPath) {
        setError('No media path provided.');
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        const url = getPublicMediaUrl(mediaPath);
        if (url) {
          setAudioUrl(url);
        } else {
          throw new Error('Failed to get audio URL.');
        }
      } catch (err) {
        setError(err.message);
        console.error("Error fetching audio URL:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAudioUrl();
  }, [message.mediaPath, message.media_path]);

  const handlePlayPause = () => {
    if (!audioRef.current || isLoading || error) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error("Playback error:", err);
        setError("Could not play audio.");
        setIsPlaying(false);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === Infinity) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Simple waveform visualization (static bars)
  const renderWaveform = () => {
    const bars = 40;
    const barElements = [];
    const progress = duration > 0 ? currentTime / duration : 0;

    for (let i = 0; i < bars; i++) {
      const barProgress = i / bars;
      // Highlight played bars with white, unplayed with lighter shade
      const isPlayed = barProgress < progress;
      barElements.push(
        <div
          key={i}
          className="waveform-bar"
          style={{
            height: `${10 + Math.random() * 10}px`,
            backgroundColor: isPlayed ? '#fff' : 'rgba(255,255,255,0.5)',
            borderRadius: '1px'
          }}
        />
      );
    }
    return barElements;
  };

  const togglePlay = () => {
    if (!audioRef.current || isLoading || error) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error("Playback error:", err);
        setError("Could not play audio.");
        setIsPlaying(false);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (e) => {
    if (!audioRef.current || !duration) return;
    const newTime = (e.target.value / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const renderPlayButton = () => {
    if (isLoading) {
      return <LoaderCircle size={20} className="animate-spin" />;
    }
    if (error) {
      return <AlertTriangle size={20} color="red" />;
    }
    return isPlaying ? "⏸" : "▶";
  }

  return (
    <div className={`message-row ${isSender ? 'sent' : 'received'}`}>
      <div className={`voice-card ${isSender ? "voice-sent" : "voice-received"}`}>
        {repliedMsg && repliedMsg.id && (
          <div
            className="reply-quote-container"
            onClick={() => {
              if (repliedMsg?.id) {
                const element = document.getElementById(`message-${repliedMsg.id}`);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  element.classList.add('highlight');
                  setTimeout(() => element.classList.remove('highlight'), 2000);
                }
              }
            }}
          >
            <div className="reply-quote-content">
              <span className="reply-quote-user">
                {(repliedMsg.senderId || repliedMsg.sender_id) === currentUserId ? "You" : "User"}
              </span>
              <p className="reply-quote-text">
                {(repliedMsg.mediaType || repliedMsg.media_type) === 'voice' ? '🎤 Voice Message' : repliedMsg.content}
              </p>
            </div>
          </div>
        )}

        <div className="voice-content">
          <div className="play-btn-wrapper" onClick={togglePlay}>
            <span className="play-icon">
              {isLoading ? <LoaderCircle size={20} className="animate-spin" /> : error ? <AlertTriangle size={20} color="red" /> : isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </span>
          </div>

          <div className="waveform-container" ref={waveformRef} onClick={handleSeek}>
            <div className="waveform">
              {renderWaveform()}
            </div>
            {/* Progress Indicator */}
            <div
              className="waveform-progress"
              style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            ></div>
          </div>

          <div className="voice-time">
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>

          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onError={(e) => {
                console.error("Audio element error:", e);
                setError("Failed to load audio.");
              }}
              preload="metadata"
            />
          )}

          <div className="voice-time-overlay">
            <span>{time}</span>
            {isSender && <span className={`tick-icon ${status === 'read' ? 'read' : ''}`}>{status === 'read' ? '✓✓' : '✓'}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceMessage;