import React, { useState, useRef, useEffect } from 'react';
import { getPublicMediaUrl } from '../../services/mediaService';
import { useAudioBlob } from '../../hooks/useAudioBlob';
import EmojiRenderer from '../common/EmojiRenderer';
import { Play, Pause, LoaderCircle, AlertTriangle, Clock, AlertCircle, RefreshCcw } from 'lucide-react';
import { formatLastSeen } from '../../utils/dateFormatter';
import styles from './VoiceMessage.module.css';

const VoiceMessage = ({ message, repliedMsg, isSender, time, status, currentUserId, isLastRead, isLast, onRetry }) => {
  const { audioUrl, isLoading, error: hookError } = useAudioBlob(message.mediaPath || message.media_path);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState(null);
  const audioRef = useRef(null);
  const waveformRef = useRef(null);

  const error = hookError || playbackError;
  const setError = setPlaybackError;

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

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
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
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderWaveform = () => {
    const bars = 40;
    const barElements = [];
    const progress = duration > 0 ? currentTime / duration : 0;
    for (let i = 0; i < bars; i++) {
      const barProgress = i / bars;
      const isPlayed = barProgress < progress;
      barElements.push(
        <div
          key={i}
          className={`${styles['waveform-bar']} ${isPlayed ? styles.played : styles.unplayed}`}
          style={{ height: `${10 + Math.random() * 10}px` }}
        />
      );
    }
    return barElements;
  };

  return (
    <div className={`${styles['voice-outer-wrapper']} ${isSender ? styles['outer-mine'] : ''}`}>
      <div className={`${styles['message-row']} ${isSender ? styles.sent : styles.received}`}>
        <div className={`${styles['voice-card']} ${isSender ? styles["voice-sent"] : styles["voice-received"]}`}>
          {repliedMsg && repliedMsg.id && (
            <div
              className={styles['reply-quote-container']}
              onClick={() => {
                const element = document.getElementById(`message-${repliedMsg.id}`);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  element.classList.add('highlight');
                  setTimeout(() => element.classList.remove('highlight'), 2000);
                }
              }}
            >
              <div className={styles['reply-quote-content']}>
                <span className={styles['reply-quote-user']}>
                  {(repliedMsg.senderId || repliedMsg.sender_id) === currentUserId ? "You" : "User"}
                </span>
                <p className={styles['reply-quote-text']}>
                  {(repliedMsg.mediaType || repliedMsg.media_type) === 'voice'
                    ? <EmojiRenderer text="🎤 Voice Message" />
                    : <EmojiRenderer text={repliedMsg.content?.substring(0, 60) || "..."} />}
                </p>
              </div>
            </div>
          )}

          <div className={styles['voice-content']}>
            <div className={styles['play-btn-wrapper']} onClick={togglePlay}>
              <span className={styles['play-icon']}>
                {isLoading ? <LoaderCircle size={20} className="animate-spin" /> : error ? <AlertTriangle size={20} color="red" /> : isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </span>
            </div>

            <div className={styles['waveform-container']} ref={waveformRef} onClick={handleSeek}>
              <div className={styles.waveform}>{renderWaveform()}</div>
              <div className={styles['waveform-progress']} style={{ width: `${(currentTime / duration) * 100 || 0}%` }}></div>
            </div>

            <div className={styles['voice-time']}>
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
                  console.error("Audio error:", e);
                  setError("Failed to load audio.");
                }}
                preload="metadata"
              />
            )}

            <div className={styles['voice-time-overlay']}>
              <span>{time}</span>
              {isSender && (
                <span className={styles['status-indicator']}>
                  {(status === 'pending' || status === 'sending') && <Clock size={10} />}
                  {status === 'failed' && <AlertCircle size={10} className={styles['status-icon-failed']} />}
                </span>
              )}
            </div>
          </div>

          {isSender && status === 'failed' && (
            <button
              className={styles['retry-button']}
              onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
            >
              <RefreshCcw size={10} />
              <span>Retry</span>
            </button>
          )}

          {message?.metadata && Object.keys(message.metadata).length > 0 && (
            <div className={styles['message-reactions']}>
              {Object.entries(
                Object.values(message.metadata).reduce((acc, emoji) => {
                  acc[emoji] = (acc[emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => {
                const isMyReaction = message.metadata[currentUserId] === emoji;
                return (
                  <div key={emoji} className={`${styles['reaction-badge']} ${isMyReaction ? styles['user-reacted'] : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.handleReactionToggle) window.handleReactionToggle(message.id, emoji);
                    }}
                  >
                    <EmojiRenderer text={emoji} />
                    {count > 1 && <span className={styles['reaction-count']}>{count}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Seen Status - same logic as MessageBubble */}
      {isSender && (isLastRead || isLast) && status !== 'pending' && status !== 'sending' && status !== 'failed' && (
        <div className={styles['external-status']}>
          {status === 'read' || message.isRead || message.is_read ? 'Seen' : 'Sent'} {formatLastSeen((status === 'read' || message.isRead || message.is_read) && (message.seenAt || message.seen_at) ? (message.seenAt || message.seen_at) : (message.createdAt || message.created_at))}
        </div>
      )}
    </div>
  );
};

export default VoiceMessage;