import React, { useState, useEffect, useCallback } from 'react';
import { getPublicMediaUrl } from '../../services/mediaService';
import EmojiRenderer from '../common/EmojiRenderer';
import CachedImage from '../common/CachedImage';
import { formatLastSeen } from '../../utils/dateFormatter';
import { Clock, AlertCircle, RefreshCcw } from 'lucide-react';
import styles from './MediaMessage.module.css';

const MediaMessage = ({ message, repliedMsg, isSender, time, status, currentUserId, onMediaClick, isLastRead, isLast, onRetry }) => {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    if (onMediaClick) onMediaClick(url, message);
  };

  useEffect(() => {
    const mediaPath = message.mediaPath || message.media_path;
    if (mediaPath && mediaPath.startsWith('http')) loadMedia();
  }, [message.mediaPath, message.media_path, loadMedia]);

  return (
    <div className={`${styles['media-outer-wrapper']} ${isSender ? styles['outer-mine'] : ''}`}>
      <div className={`${styles['message-row']} ${isSender ? styles.sent : styles.received}`}>
        <div className={`${styles['media-bubble']} ${isSender ? styles['media-sent'] : styles['media-received']}`}>
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
                <CachedImage src={mediaUrl} alt="sent-media" className={styles['actual-image']} onLoad={() => setIsLoading(false)} />
                {(message.mediaPath || message.media_path)?.startsWith('http') && (
                  <span className={styles['gif-badge']}>GIF</span>
                )}
              </>
            )}
            {imageLoaded && (
              <div className={styles['media-time-overlay']}>
                <span>{time}</span>
                {isSender && (
                  <span className={styles['status-indicator']}>
                    {(status === 'pending' || status === 'sending') && <Clock size={10} />}
                    {status === 'failed' && <AlertCircle size={10} className={styles['status-icon-failed']} />}
                  </span>
                )}
              </div>
            )}
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

export default MediaMessage;
