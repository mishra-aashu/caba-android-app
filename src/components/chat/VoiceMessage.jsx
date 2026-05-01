import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAudioBlob } from '../../hooks/useAudioBlob';
import EmojiRenderer from '../common/EmojiRenderer';
import { Play, Pause, LoaderCircle, AlertCircle, Clock, AlertTriangle, RefreshCcw } from 'lucide-react';
import { formatLastSeen } from '../../utils/dateFormatter';
import styles from './VoiceMessage.module.css';

const VoiceMessage = ({ 
    message, 
    repliedMsg, 
    isSender, 
    time, 
    status, 
    currentUserId, 
    isLastRead, 
    isLast, 
    onRetry 
}) => {
    // Get media path with fallbacks
    const mediaPath = message.mediaPath || message.media_path || message.mediaUrl || message.media_url;
    
    // Use the audio blob hook
    const { audioUrl, waveform, isLoading, error: hookError } = useAudioBlob(mediaPath);
    
    // Component state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackError, setPlaybackError] = useState(null);
    const [isAudioReady, setIsAudioReady] = useState(false);
    
    // Refs
    const audioRef = useRef(null);
    const waveformRef = useRef(null);
    const animationFrameRef = useRef(null);

    // Combined error state
    const error = hookError || playbackError;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Handle audio URL changes
    useEffect(() => {
        if (audioUrl && audioRef.current) {
            audioRef.current.src = audioUrl;
            setIsAudioReady(true);
            setPlaybackError(null);
        }
    }, [audioUrl]);

    // Toggle play/pause
    const togglePlay = useCallback(() => {
        if (!audioRef.current || !isAudioReady || isLoading || error) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            const playPromise = audioRef.current.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        setIsPlaying(true);
                        setPlaybackError(null);
                    })
                    .catch((err) => {
                        console.error("Playback error:", err);
                        setPlaybackError("Could not play audio");
                        setIsPlaying(false);
                    });
            }
        }
    }, [isPlaying, isAudioReady, isLoading, error]);

    // Handle time update with RAF for smooth animation
    const handleTimeUpdate = useCallback(() => {
        if (audioRef.current && !isNaN(audioRef.current.currentTime)) {
            setCurrentTime(audioRef.current.currentTime);
        }
    }, []);

    // Handle metadata loaded
    const handleLoadedMetadata = useCallback(() => {
        if (audioRef.current && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
        }
    }, []);

    // Handle audio ended
    const handleEnded = useCallback(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
        }
    }, []);

    // Handle audio error
    const handleAudioError = useCallback((e) => {
        console.error("Audio element error:", e);
        setPlaybackError("Failed to load audio");
        setIsPlaying(false);
        setIsAudioReady(false);
    }, []);

    // Handle waveform seek
    const handleSeek = useCallback((e) => {
        if (!audioRef.current || !duration || !waveformRef.current) return;

        const rect = waveformRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = percentage * duration;

        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    }, [duration]);

    // Format time display
    const formatTime = useCallback((seconds) => {
        if (isNaN(seconds) || seconds === Infinity || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Render waveform bars
    const renderWaveform = useCallback(() => {
        const bars = 40;
        const barElements = [];
        const progress = duration > 0 ? currentTime / duration : 0;
        const hasWaveform = Array.isArray(waveform) && waveform.length > 0;

        for (let i = 0; i < bars; i++) {
            const barProgress = i / bars;
            const isPlayed = barProgress < progress;
            const barEndProgress = (i + 1) / bars;
            const isActive = isPlaying && progress >= barProgress && progress < barEndProgress;

            // Get waveform value with validation
            let value = hasWaveform && waveform[i] !== undefined ? waveform[i] : 0.3;
            if (isNaN(value) || value < 0) value = 0.3;
            if (value > 1) value = 1;

            const barHeight = Math.max(4, (value * 22) + 6);

            barElements.push(
                <div
                    key={i}
                    className={`${styles['waveform-bar']} ${
                        isPlayed ? styles.played : styles.unplayed
                    } ${isActive ? styles.active : ''}`}
                    style={{ height: `${barHeight}px` }}
                />
            );
        }
        return barElements;
    }, [waveform, currentTime, duration, isPlaying]);

    // Handle reply message click
    const handleReplyClick = useCallback(() => {
        if (!repliedMsg?.id) return;

        const element = document.getElementById(`message-${repliedMsg.id}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('highlight');
            setTimeout(() => element.classList.remove('highlight'), 2000);
        }
    }, [repliedMsg]);

    // Handle reaction click
    const handleReactionClick = useCallback((emoji) => {
        if (window.handleReactionToggle) {
            window.handleReactionToggle(message.id, emoji);
        }
    }, [message.id]);

    // Handle retry
    const handleRetry = useCallback((e) => {
        e.stopPropagation();
        if (onRetry) {
            onRetry();
        }
    }, [onRetry]);

    return (
        <div className={`${styles['voice-outer-wrapper']} ${isSender ? styles['outer-mine'] : ''}`}>
            <div className={`${styles['message-row']} ${isSender ? styles.sent : styles.received}`}>
                <div className={`${styles['voice-card']} ${isSender ? styles['voice-sent'] : styles['voice-received']}`}>
                    
                    {/* Reply Quote */}
                    {repliedMsg && repliedMsg.id && (
                        <div className={styles['reply-quote-container']} onClick={handleReplyClick}>
                            <div className={styles['reply-quote-content']}>
                                <span className={styles['reply-quote-user']}>
                                    {(repliedMsg.senderId || repliedMsg.sender_id) === currentUserId ? "You" : "User"}
                                </span>
                                <p className={styles['reply-quote-text']}>
                                    {(repliedMsg.mediaType || repliedMsg.media_type) === 'voice' ? (
                                        <EmojiRenderer text="🎤 Voice Message" />
                                    ) : (
                                        <EmojiRenderer text={repliedMsg.content?.substring(0, 60) || "..."} />
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Main Voice Content */}
                    <div className={styles['voice-main-content']}>
                        
                        {/* Play Button */}
                        <div className={styles['play-btn-wrapper']} onClick={togglePlay}>
                            <button
                                className={styles['play-icon-btn']}
                                disabled={isLoading || (!isAudioReady && !error)}
                                aria-label={isPlaying ? "Pause" : "Play"}
                                type="button"
                            >
                                {isLoading ? (
                                    <LoaderCircle size={20} className="animate-spin" />
                                ) : error ? (
                                    <AlertCircle size={20} className={styles['error-icon']} />
                                ) : isPlaying ? (
                                    <Pause size={18} fill="currentColor" />
                                ) : (
                                    <Play size={18} fill="currentColor" />
                                )}
                            </button>
                        </div>

                        {/* Waveform and Info */}
                        <div className={styles['voice-body-column']}>
                            
                            {/* Waveform */}
                            <div 
                                className={styles['waveform-container']} 
                                ref={waveformRef} 
                                onClick={handleSeek}
                                role="slider"
                                aria-label="Audio timeline"
                                aria-valuemin={0}
                                aria-valuemax={duration}
                                aria-valuenow={currentTime}
                            >
                                <div className={styles.waveform}>
                                    {renderWaveform()}
                                </div>
                            </div>

                            {/* Duration and Status */}
                            <div className={styles['voice-info-row']}>
                                <span className={styles['voice-duration']}>
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </span>

                                <div className={styles['voice-meta-inline']}>
                                    <span className={styles['message-time']}>{time}</span>
                                    
                                    {isSender && (
                                        <span className={`${styles['status-indicator']} ${styles[status]}`}>
                                            {(status === 'pending' || status === 'sending') && (
                                                <Clock size={10} />
                                            )}
                                            {status === 'failed' && (
                                                <AlertTriangle size={10} />
                                            )}
                                            {status === 'sent' && (
                                                <div className={styles['check-icon']}>✓</div>
                                            )}
                                            {status === 'delivered' && (
                                                <div className={styles['check-icon-double']}>✓✓</div>
                                            )}
                                            {status === 'read' && (
                                                <div className={`${styles['check-icon-double']} ${styles.read}`}>
                                                    ✓✓
                                                </div>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Audio Element */}
                    {audioUrl && (
                        <audio
                            ref={audioRef}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onEnded={handleEnded}
                            onError={handleAudioError}
                            onCanPlay={() => setIsAudioReady(true)}
                            preload="metadata"
                        />
                    )}

                    {/* Retry Button */}
                    {isSender && status === 'failed' && (
                        <button className={styles['retry-button']} onClick={handleRetry} type="button">
                            <RefreshCcw size={10} />
                            <span>Retry</span>
                        </button>
                    )}

                    {/* Reactions */}
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
                                    <div
                                        key={emoji}
                                        className={`${styles['reaction-badge']} ${
                                            isMyReaction ? styles['user-reacted'] : ''
                                        }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleReactionClick(emoji);
                                        }}
                                        role="button"
                                        tabIndex={0}
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

            {/* External Status */}
            {isSender && 
             (isLastRead || isLast) && 
             status !== 'pending' && 
             status !== 'sending' && 
             status !== 'failed' && (
                <div className={styles['external-status']}>
                    {status === 'read' || message.isRead || message.is_read ? 'Seen' : 'Sent'}{' '}
                    {formatLastSeen(
                        (status === 'read' || message.isRead || message.is_read) && 
                        (message.seenAt || message.seen_at)
                            ? (message.seenAt || message.seen_at)
                            : (message.createdAt || message.created_at)
                    )}
                </div>
            )}
        </div>
    );
};

export default React.memo(VoiceMessage);