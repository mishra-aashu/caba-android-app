import React, { useState, useEffect } from 'react';
import EmojiRenderer from '../common/EmojiRenderer';
import './MessageBubble.css';

// Icon for deleted messages
const BlockIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#8696a0" style={{marginRight: '5px', verticalAlign: 'middle'}}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-4.41 3.59-8 8-8 4.41 0 8 3.59 8 8 0 4.41-3.59 8-8 8zm3.88-11.71L10.7 13.47l-1.59-1.59L7.7 13.3l4.59 4.59 6.6-6.6-1.42-1.42zM12 4c-1.86 0-3.57.65-4.93 1.74l9.67 9.67C17.91 13.88 18.5 12.02 18.5 10c0-4.41-3.59-8-8-8zM5.26 8.26C4.48 9.38 4 10.63 4 12c0 4.41 3.59 8 8 8 1.37 0 2.62-.48 3.74-1.26L5.26 8.26z"></path>
    <path fill="none" d="M0 0h24v24H0z"></path>
    <circle cx="12" cy="12" r="10" stroke="#667781" strokeWidth="2" fill="none" />
    <line x1="5" y1="5" x2="19" y2="19" stroke="#667781" strokeWidth="2" />
  </svg>
);

// Spy icon for anonymous messages
const SpyIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{marginRight: '4px'}}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.41 0 8 3.59 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
    <circle cx="12" cy="10" r="3"/>
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
  </svg>
);

// Lock icon for time capsule
const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{marginRight: '4px'}}>
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
  </svg>
);

// Utility function to check if a message was edited
const isMessageEdited = (message) => {
  if (!message?.updated_at || !message?.created_at) return false;
  
  const updatedTime = new Date(message.updated_at);
  const createdTime = new Date(message.created_at);
  const timeDiff = updatedTime.getTime() - createdTime.getTime();
  
  // Very conservative threshold - only show "edited" if time difference is more than 3 seconds
  // This ensures only truly edited messages show the label, avoiding database precision issues
  const isTimeEdited = timeDiff > 3000; // 3000ms = 3 seconds
  
  // Additional safety check: if the timestamps are exactly the same down to seconds, don't show edited
  const updatedSeconds = Math.floor(updatedTime.getTime() / 1000);
  const createdSeconds = Math.floor(createdTime.getTime() / 1000);
  const isSameSecond = updatedSeconds === createdSeconds;
  
  return isTimeEdited && !isSameSecond;
};

const MessageBubble = ({ 
  text, 
  repliedMsg, 
  currentUserId, 
  time, 
  isMine, 
  isDeleted,
  status,
  edited,
  sender,
  message // Full message object for special features
}) => {
  const [unlockCountdown, setUnlockCountdown] = useState('');
  
  // Check for special message types
  const isAnonymous = message?.is_anonymous;
  const isTimeCapsule = message?.unlock_at;
  const isLocked = isTimeCapsule && new Date(message.unlock_at) > new Date();
  
  // Properly check if message was edited - only show "edited" if updated_at > created_at
  const isEdited = isMessageEdited(message);

  // Calculate time remaining for time capsule
  useEffect(() => {
    if (!isTimeCapsule) return;
    
    const updateCountdown = () => {
      const now = new Date();
      const unlockTime = new Date(message.unlock_at);
      const diff = unlockTime - now;
      
      if (diff <= 0) {
        setUnlockCountdown('');
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setUnlockCountdown(`Opens in ${days} day${days > 1 ? 's' : ''}`);
      } else if (hours > 0) {
        setUnlockCountdown(`Opens in ${hours}h ${minutes}m`);
      } else {
        setUnlockCountdown(`Opens in ${minutes} minute${minutes > 1 ? 's' : ''}`);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [isTimeCapsule, message?.unlock_at]);

  // Determine sender name
  const getSenderName = () => {
    if (isAnonymous) return 'Anonymous';
    if (sender?.id === currentUserId) return 'You';
    return sender?.name || 'Unknown';
  };

  // Determine avatar
  const getAvatar = () => {
    if (isAnonymous) return <SpyIcon />;
    if (sender?.avatar) {
      return <img src={sender.avatar} alt={sender.name} />;
    }
    return null;
  };

  return (
    <div className={`message-container ${isMine ? 'mine' : 'theirs'} ${isAnonymous ? 'anonymous' : ''} ${isLocked ? 'locked' : ''}`}>
      
      {/* Bubble Box */}
      <div className="bubble">
        {/* Anonymous/Group sender info */}
        {!isMine && (isAnonymous || message?.is_group_message) && (
          <div className="sender-info">
            <div className="sender-avatar">
              {getAvatar()}
            </div>
            <span className={`sender-name ${isAnonymous ? 'anonymous-name' : ''}`}>
              {getSenderName()}
            </span>
          </div>
        )}

        {/* Time Capsule Lock */}
        {isLocked && (
          <div className="time-capsule-locked">
            <LockIcon />
            <span className="lock-text">{unlockCountdown || 'Locked'}</span>
          </div>
        )}

        {/* Reply Block */}
        {repliedMsg && !isLocked && repliedMsg.id && (
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
            <div className="reply-quote-bar"></div>
            <div className="reply-quote-content">
              <span className="reply-quote-user">
                {repliedMsg.sender_id === currentUserId ? "You" : "User"}
              </span>
              <p className="reply-quote-text">
                {repliedMsg.message_type === 'image'
                  ? <EmojiRenderer text="📷 Photo" />
                  : <EmojiRenderer text={repliedMsg.content?.substring(0, 60) || "..."} />}
              </p>
            </div>
          </div>
        )}

        {/* Actual Message Content */}
        <div className="message-content">
          {/* Text Area */}
          <span className={`text ${isDeleted ? 'deleted-text' : ''} ${isLocked ? 'blurred' : ''}`}>
            {isDeleted && <BlockIcon />}
            {isLocked ? <LockIcon /> : null}
            <EmojiRenderer text={isLocked ? 'Time Capsule Message' : text} />
          </span>

          {/* Time Area */}
          <span className="timestamp">
            {isTimeCapsule && !isLocked && '⏰ '}
            {time}
            {isEdited && <span className="edited-indicator">edited</span>}
            {isMine && <span className="tick">✓✓</span>}
          </span>
        </div>

        {isMine && <div className="tail-mine"></div>}
      </div>
    </div>
  );
};

export default MessageBubble;
