import React, { useState, useEffect } from 'react';
import { getPublicMediaUrl } from '../../services/mediaService';
import EmojiRenderer from '../common/EmojiRenderer';
import './MediaMessage.css';

const MediaMessage = ({ message, repliedMsg, isSender, time, status, currentUserId, onMediaClick }) => {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get media URL
  const getMediaUrl = () => {
    const mediaPath = message.mediaPath || message.media_path;
    return mediaPath.startsWith('http') ? mediaPath : getPublicMediaUrl(mediaPath);
  };

  const handleViewMedia = (e) => {
    e?.stopPropagation();
    
    // Always get fresh URL
    const url = getMediaUrl();
    setMediaUrl(url);
    setImageLoaded(true);
    setIsLoading(false);

    // Trigger fullscreen viewer if callback provided
    if (onMediaClick) {
      onMediaClick(url, message);
    }
  };

  // Auto-load for external GIFs
  useEffect(() => {
    const mediaPath = message.mediaPath || message.media_path;
    if (mediaPath && mediaPath.startsWith('http')) {
      handleViewMedia();
    }
  }, [message.mediaPath, message.media_path]);

  // Render the message
  return (
    <div className={`message-row ${isSender ? 'sent' : 'received'}`}>
      <div className={`media-bubble ${isSender ? 'media-sent' : 'media-received'}`}>
        {/* Reply Block */}
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
              {/* Name Logic: Agar sender_id meri hai to 'You', nahi to 'User' */}
              <span className="reply-quote-user">
                {(repliedMsg.senderId || repliedMsg.sender_id) === currentUserId ? "You" : "User"}
              </span>

              {/* Content Logic: Image hai ya text? */}
              <p className="reply-quote-text">
                {(repliedMsg.messageType || repliedMsg.message_type) === 'image'
                  ? <EmojiRenderer text="📷 Photo" />
                  : <EmojiRenderer text={repliedMsg.content?.substring(0, 60) || "..."} />}
              </p>
            </div>
          </div>
        )}
        <div className="media-content" onClick={handleViewMedia}>
          {!imageLoaded ? (
            <div className="media-placeholder">
              <span className="icon">🖼️</span>
              <span className="text">Click to view</span>
            </div>
          ) : (
            <>
              <img
                src={mediaUrl}
                alt="sent-media"
                className="actual-image"
                onLoad={() => setIsLoading(false)}
              />
              {(message.mediaPath || message.media_path)?.startsWith('http') && (
                <span className="gif-badge">GIF</span>
              )}
            </>
          )}
          {imageLoaded && (
            <div className="media-time-overlay">
              <span>{time}</span>
              {isSender && <span className={`tick-icon ${status === 'read' ? 'read' : ''}`}>{status === 'read' ? '✓✓' : '✓'}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaMessage;

