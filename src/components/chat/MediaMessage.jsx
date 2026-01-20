import React, { useState, useEffect } from 'react';
import { getPublicMediaUrl } from '../../services/mediaService';
import './MediaMessage.css';

const MediaMessage = ({ message, repliedMsg, isSender, time, status, currentUserId }) => {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleViewMedia = () => {
    if (!imageLoaded) {
      setIsLoading(true);
      // Check if media_path is already a full URL (for GIFs from Tenor)
      const url = message.media_path.startsWith('http') ? message.media_path : getPublicMediaUrl(message.media_path);
      setMediaUrl(url);
      setImageLoaded(true);
      setIsLoading(false);
    }
  };

  // Auto-load for external GIFs
  useEffect(() => {
    if (message.media_path.startsWith('http')) {
      handleViewMedia();
    }
  }, [message.media_path]);

  // Render the message
  return (
    <div className={`message-row ${isSender ? 'sent' : 'received'}`}>
      <div className="media-bubble">
        {/* Reply Block */}
        {repliedMsg && (
          <div
            className="reply-quote-container"
            onClick={() => {
              const element = document.getElementById(`message-${repliedMsg.id}`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight');
                setTimeout(() => element.classList.remove('highlight'), 2000);
              }
            }}
          >
            {/* Green/Accent Bar */}
            <div className="reply-quote-bar"></div>

            <div className="reply-quote-content">
              {/* Name Logic: Agar sender_id meri hai to 'You', nahi to 'User' */}
              <span className="reply-quote-user">
                {repliedMsg.sender_id === currentUserId ? "You" : "User"}
              </span>

              {/* Content Logic: Image hai ya text? */}
              <p className="reply-quote-text">
                {repliedMsg.message_type === 'image'
                  ? "📷 Photo"
                  : repliedMsg.content?.substring(0, 60) || "..."}
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
              {message.media_path.startsWith('http') && (
                <span className="gif-badge">GIF</span>
              )}
            </>
          )}
          {imageLoaded && (
            <div className="media-time-overlay">
              <span>{time}</span>
              {isSender && <span className="tick-icon">{status === 'read' ? '✓✓' : '✓'}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaMessage;

