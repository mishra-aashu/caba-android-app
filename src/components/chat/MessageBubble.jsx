import React, { memo, useState, useEffect, useMemo } from 'react';
// Removed framer-motion for uniform scrolling
import EmojiRenderer from '../common/EmojiRenderer';
import { isOnlyEmoji } from '../../utils/emojiUtils';
import styles from './MessageBubble.module.css';

// Icon for deleted messages
const BlockIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className={styles['deleted-icon']}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-4.41 3.59-8 8-8 4.41 0 8 3.59 8 8 0 4.41-3.59 8-8 8zm3.88-11.71L10.7 13.47l-1.59-1.59L7.7 13.3l4.59 4.59 6.6-6.6-1.42-1.42zM12 4c-1.86 0-3.57.65-4.93 1.74l9.67 9.67C17.91 13.88 18.5 12.02 18.5 10c0-4.41-3.59-8-8-8zM5.26 8.26C4.48 9.38 4 10.63 4 12c0 4.41 3.59 8 8 8 1.37 0 2.62-.48 3.74-1.26L5.26 8.26z"></path>
    <path fill="none" d="M0 0h24v24H0z"></path>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
    <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" />
  </svg>
);

// Spy icon for anonymous messages
const SpyIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className={styles['spy-icon']}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.41 0 8 3.59 8 8 0 1.85-.63 3.55-1.69 4.9z" />
    <circle cx="12" cy="10" r="3" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
  </svg>
);

// Lock icon for time capsule
const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className={styles['lock-icon']}>
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
  </svg>
);

// Utility function to check if a message was edited
const isMessageEdited = (message) => {
  return !!(message?.isEdited || message?.is_edited);
};

const MessageBubble = memo(({
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
  // Removed animation controls for uniform scrolling

  // Check for special message types
  const isAnonymous = message?.isAnonymous || message?.is_anonymous;
  const unlockAt = message?.unlockAt || message?.unlock_at;
  const isTimeCapsule = !!unlockAt;
  const isLocked = isTimeCapsule && new Date(unlockAt) > new Date();

  // Check if message contains only emojis (1-3 emojis, no text)
  // This enables the "Jumbo Emoji" feature for Telegram-like emoji-only messages
  const isJumboEmoji = !isDeleted && !isLocked && isOnlyEmoji(text);

  // Properly check if message was edited
  const isEdited = useMemo(() => {
    // Only trust explicit flags/props
    return !!(edited || message?.is_edited || message?.isEdited);
  }, [edited, message?.is_edited, message?.isEdited]);

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
  }, [isTimeCapsule, message?.unlockAt, message?.unlock_at]);

  // Memoize sender name computation
  const senderName = useMemo(() => {
    if (isAnonymous) return 'Anonymous';
    if (sender?.id === currentUserId) return 'You';
    return sender?.name || 'Unknown';
  }, [isAnonymous, sender, currentUserId]);

  // Memoize avatar
  const avatar = useMemo(() => {
    if (isAnonymous) return <SpyIcon />;
    if (sender?.avatar) {
      return <img src={sender.avatar} alt={sender.name} />;
    }
    return null;
  }, [isAnonymous, sender]);

  // Memoize emoji renderer for performance
  const emojiStyle = isJumboEmoji ? { width: '64px', height: '64px' } : {};

  // Removed jelly animation for uniform scrolling

  return (
    <div
      className={`${styles['message-container']} ${isMine ? styles.mine : styles.theirs} ${isAnonymous ? styles.anonymous : ''} ${isLocked ? styles.locked : ''} ${isJumboEmoji ? styles['jumbo-emoji'] : ''}`}
    >
      {/* Bubble Box */}
      <div className={`${styles.bubble} ${styles['caba-bubble']} ${isMine ? `${styles['bubble-sent']} ${styles['caba-bubble--sent']}` : `${styles['bubble-received']} ${styles['caba-bubble--received']}`} ${isJumboEmoji ? styles['jumbo-emoji-bubble'] : ''}`}>
        {/* Anonymous sender info inside bubble (Only for truly anonymous messages) */}
        {!isMine && isAnonymous && (
          <div className={styles['sender-info']}>
            <div className={styles['sender-avatar']}>
              {avatar}
            </div>
            <span className={`${styles['sender-name']} ${styles['anonymous-name']}`}>
              {senderName}
            </span>
          </div>
        )}

        {/* Time Capsule Lock */}
        {isLocked && (
          <div className={styles['time-capsule-locked']}>
            <LockIcon />
            <span className={styles['lock-text']}>{unlockCountdown || 'Locked'}</span>
          </div>
        )}

        {/* Reply Block */}
        {repliedMsg && !isLocked && repliedMsg.id && (
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
              <span className={styles['reply-quote-user']}>
                {(repliedMsg.senderId || repliedMsg.sender_id) === currentUserId ? "You" : "User"}
              </span>
              <p className={styles['reply-quote-text']}>
                {(repliedMsg.mediaType || repliedMsg.media_type) === 'image' || (repliedMsg.messageType || repliedMsg.message_type) === 'image'
                  ? <EmojiRenderer text="📷 Photo" />
                  : (repliedMsg.mediaType === 'voice' || repliedMsg.media_type === 'voice' || repliedMsg.mediaType === 'audio' || repliedMsg.media_type === 'audio' || repliedMsg.messageType === 'audio' || repliedMsg.message_type === 'audio')
                    ? <EmojiRenderer text="🎤 Voice Message" />
                    : <EmojiRenderer text={repliedMsg.content?.substring(0, 60) || "..."} />}
              </p>
            </div>
          </div>
        )}

        {/* Actual Message Content */}
        <div className={styles['message-content']}>
          {/* Text Area */}
          <span className={`${styles.text} ${isDeleted ? styles['deleted-text'] : ''} ${isLocked ? styles.blurred : ''} ${isJumboEmoji ? styles['jumbo-emoji-text'] : ''}`}>
            {isDeleted && <BlockIcon />}
            {isLocked ? <LockIcon /> : null}
            <EmojiRenderer
              text={isLocked ? 'Time Capsule Message' : text}
              style={emojiStyle}
            />
          </span>

          {/* Reactions Display */}
          {message?.metadata && Object.keys(message.metadata).length > 0 && (
            <div className={styles['message-reactions']}>
              {Object.entries(
                Object.values(message.metadata).reduce((acc, emoji) => {
                  acc[emoji] = (acc[emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => {
                const hasUserReacted = Object.values(message.metadata).some(
                  (uReaction) => uReaction === emoji && Object.keys(message.metadata).find(uid => message.metadata[uid] === emoji) === currentUserId
                );

                // Refined hasUserReacted check
                const isMyReaction = message.metadata[currentUserId] === emoji;

                return (
                  <div
                    key={emoji}
                    className={`${styles['reaction-badge']} ${isMyReaction ? styles['user-reacted'] : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Toggling via badge
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

          {/* Time Area */}
          <span className={styles.timestamp}>
            {isTimeCapsule && !isLocked && '⏰ '}
            {time}
            {isEdited && <span className={styles['edited-indicator']}>edited</span>}
            {isMine && (
              <span className={`${styles.tick} ${styles['tick-icon']} ${status === 'read' ? styles.read : ''}`}>
                {status === 'pending' ? (
                  <span className={styles['pending-indicator']}>🕒</span>
                ) : (
                  status === 'read' || status === 'delivered' ? '✓✓' : '✓'
                )}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo - only re-render when these change
  if (prevProps.text !== nextProps.text) return false;
  if (prevProps.time !== nextProps.time) return false;
  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.isMine !== nextProps.isMine) return false;
  if (prevProps.isDeleted !== nextProps.isDeleted) return false;
  if (prevProps.edited !== nextProps.edited) return false;

  // Check repliedMsg changes
  const prevReplyId = prevProps.repliedMsg?.id;
  const nextReplyId = nextProps.repliedMsg?.id;
  if (prevReplyId !== nextReplyId) return false;

  // Check sender changes
  const prevSenderId = prevProps.sender?.id;
  const nextSenderId = nextProps.sender?.id;
  if (prevSenderId !== nextSenderId) return false;

  // Check message object key changes
  const prevMessageId = prevProps.message?.id;
  const nextMessageId = nextProps.message?.id;
  if (prevMessageId !== nextMessageId) return false;

  // Check unlock status for time capsule
  const prevLocked = prevProps.message?.unlockAt || prevProps.message?.unlock_at;
  const nextLocked = nextProps.message?.unlockAt || nextProps.message?.unlock_at;
  if (prevLocked !== nextLocked) return false;

  // Check for metadata changes (reactions)
  const prevMeta = JSON.stringify(prevProps.message?.metadata || {});
  const nextMeta = JSON.stringify(nextProps.message?.metadata || {});
  if (prevMeta !== nextMeta) return false;

  return true;
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
