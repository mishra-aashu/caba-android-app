import React, { useState, useEffect, useCallback } from 'react';
import { getPublicMediaUrl } from '../../services/mediaService';
import EmojiRenderer from '../common/EmojiRenderer';
import styles from './MediaMessage.module.css';

const MediaMessage = ({ message, repliedMsg, isSender, time, status, currentUserId, onMediaClick }) => {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get media URL
  const getMediaUrl = () => {
    const mediaPath = message.mediaPath || message.media_path;
    return mediaPath.startsWith('http') ? mediaPath : getPublicMediaUrl(mediaPath);
  };

  const loadMedia = useCallback(() => {
    const url = getMediaUrl();
    setMediaUrl(url);
    setImageLoaded(true);
    setIsLoading(false);
    return url;
  }, [message.mediaPath, message.media_path]);

  const handleMediaClick = (e) => {
    e?.stopPropagation();
    const url = loadMedia();
    if (onMediaClick) {
      onMediaClick(url, message);
    }
  };

  // Auto-load for external GIFs
  useEffect(() => {
    const mediaPath = message.mediaPath || message.media_path;
    if (mediaPath && mediaPath.startsWith('http')) {
      loadMedia();
    }
  }, [message.mediaPath, message.media_path, loadMedia]);

  // Render the message
  return (
    <div className={`${styles['message-row']} ${isSender ? styles.sent : styles.received}`}>
      <div className={`${styles['media-bubble']} ${isSender ? styles['media-sent'] : styles['media-received']}`}>
        {/* Reply Block */}
        {repliedMsg && repliedMsg.id && (
          <div
            className={styles['reply-quote-container']}
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
            <div className={styles['reply-quote-content']}>
              {/* Name Logic: Agar sender_id meri hai to 'You', nahi to 'User' */}
              <span className={styles['reply-quote-user']}>
                {(repliedMsg.senderId || repliedMsg.sender_id) === currentUserId ? "You" : "User"}
              </span>

              {/* Content Logic: Image hai ya text? */}
              <p className={styles['reply-quote-text']}>
                {(repliedMsg.messageType || repliedMsg.message_type) === 'image'
                  ? <EmojiRenderer text="📷 Photo" />
                  : <EmojiRenderer text={repliedMsg.content?.substring(0, 60) || "..."} />}
              </p>
            </div>
          </div>
        )}
        <div className={styles['media-content']} onClick={handleMediaClick}>
          {!imageLoaded ? (
            <div className={styles['media-placeholder']}>
              <span className={styles.icon}>🖼️</span>
              <span className={styles.text}>Click to view</span>
            </div>
          ) : (
            <>
              <img
                src={mediaUrl}
                alt="sent-media"
                className={styles['actual-image']}
                onLoad={() => setIsLoading(false)}
              />
              {(message.mediaPath || message.media_path)?.startsWith('http') && (
                <span className={styles['gif-badge']}>GIF</span>
              )}
            </>
          )}
          {imageLoaded && (
            <div className={styles['media-time-overlay']}>
              <span>{time}</span>
              {isSender && <span className={`${styles['tick-icon']} ${status === 'read' ? styles.read : ''}`}>{status === 'read' ? '✓✓' : '✓'}</span>}
            </div>
          )}
        </div>

        {/* Reactions Display */}
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
                  className={`${styles['reaction-badge']} ${isMyReaction ? styles['user-reacted'] : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.handleReactionToggle) {
                      window.handleReactionToggle(message.id, emoji);
                    }
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
  );
};

export default MediaMessage;

