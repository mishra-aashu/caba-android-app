import React, { memo, useState, useEffect, useMemo } from 'react';
import EmojiRenderer from '../common/EmojiRenderer';
import { isOnlyEmoji, getEmojiCount } from '../../utils/emojiUtils';
import { formatLastSeen } from '../../utils/dateFormatter';
import { Clock, AlertCircle, RefreshCcw } from 'lucide-react';
// EncryptionService intentionally NOT imported here.
// Decryption happens once at sync time (syncService/useRealtimeMessages).
// Running AES decrypt per-bubble on every render was the root cause of chat-switch freezes.
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
  message,
  isGroupChat,
  isLastRead,
  isLast,
  onRetry,
}) => {
  const [unlockCountdown, setUnlockCountdown] = useState('');
  const [vanishCountdown, setVanishCountdown] = useState('');


  const isAnonymous = message?.isAnonymous || message?.is_anonymous;
  const unlockAt = message?.unlockAt || message?.unlock_at;
  const isTimeCapsule = !!unlockAt;
  const isLocked = isTimeCapsule && new Date(unlockAt) > new Date();

  // [FIX #9] Jumbo emoji should ONLY trigger for a single emoji. 
  // Two or more emojis should be normal sized.
  const emojiCount = useMemo(() => isOnlyEmoji(text) ? getEmojiCount(text) : 0, [text]);
  const isJumboEmoji = !isDeleted && !isLocked && emojiCount === 1;

  const isEdited = useMemo(() => {
    return !!(edited || message?.is_edited || message?.isEdited);
  }, [edited, message?.is_edited, message?.isEdited]);

  const displayedText = useMemo(() => {
    if (isDeleted || isLocked) return text;
    // [PERF] No decrypt here. Data is already plaintext from the sync layer.
    // If you see '🔒:' in a bubble, fix the sync/realtime layer — not this component.
    return text;
  }, [text, isDeleted, isLocked]);

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
      const minutes = Math.floor(diff / (1000 * 60));
      if (minutes > 1440) {
        setUnlockCountdown(`Opens in ${Math.floor(minutes / 1440)}d`);
      } else if (minutes > 60) {
        setUnlockCountdown(`Opens in ${Math.floor(minutes / 60)}h`);
      } else {
        setUnlockCountdown(`Opens in ${minutes}m`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [isTimeCapsule, message?.unlockAt, message?.unlock_at]);

  const vanishAt = message?.vanishAt || message?.vanish_at;
  const isVanishing = !!vanishAt;

  useEffect(() => {
    if (!isVanishing) return;
    const updateCountdown = () => {
      const now = new Date();
      const vanishTime = new Date(vanishAt);
      const diff = vanishTime - now;
      if (diff <= 0) {
        setVanishCountdown('Vanish');
        return;
      }
      const seconds = Math.floor(diff / 1000);
      if (seconds < 60) {
        setVanishCountdown(`${seconds}s`);
      } else if (seconds < 3600) {
        setVanishCountdown(`${Math.floor(seconds / 60)}m`);
      } else if (seconds < 86400) {
        setVanishCountdown(`${Math.floor(seconds / 3600)}h`);
      } else {
        setVanishCountdown(`${Math.floor(seconds / 86400)}d`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isVanishing, vanishAt]);


  const senderName = isAnonymous ? 'Anonymous' : (sender?.id === currentUserId ? 'You' : (sender?.name || 'Unknown'));

  const emojiStyle = isJumboEmoji ? { width: '96px', height: '96px', fontSize: '96px', lineHeight: '1' } : {};

  return (
    <div
      className={`${styles['message-outer-container']} ${isMine ? styles['outer-mine'] : ''}`}
      style={{ contain: 'layout' }}
    >
      <div
        className={`${styles['message-container']} ${isMine ? styles.mine : styles.theirs} ${isAnonymous ? styles.anonymous : ''} ${isLocked ? styles.locked : ''} ${isJumboEmoji ? styles['jumbo-emoji'] : ''}`}
      >
        <div className={`${styles.bubble} ${styles['caba-bubble']} ${isMine ? `${styles['bubble-sent']} ${styles['caba-bubble--sent']}` : `${styles['bubble-received']} ${styles['caba-bubble--received']}`} ${isJumboEmoji ? styles['jumbo-emoji-bubble'] : ''}`}>
          {isGroupChat && !isMine && !isJumboEmoji && (
            <div className={styles['sender-name']}>
              {senderName}
            </div>
          )}
          {repliedMsg && !isLocked && repliedMsg.id && (
            <div className={styles['reply-quote-container']}>
              <div className={styles['reply-quote-content']}>
                <span className={styles['reply-quote-user']}>
                  {(repliedMsg.senderId || repliedMsg.sender_id) === currentUserId ? "You" : "Other"}
                </span>
                <p className={styles['reply-quote-text']}>
                  {repliedMsg.content?.substring(0, 40) || "Media"}
                </p>
              </div>
            </div>
          )}

          <div className={styles['message-content']}>
            <span className={`${styles.text} ${isDeleted ? styles['deleted-text'] : ''} ${isLocked ? styles.blurred : ''}`}>
              {isDeleted && <BlockIcon />}
              <EmojiRenderer text={isLocked ? 'Time Capsule' : displayedText} style={emojiStyle} />
            </span>

            {message?.metadata && (
              <div className={styles['message-reactions']}>
                {Object.entries(message.metadata).slice(0, 3).map(([uid, emoji]) => (
                  <div key={uid} className={styles['reaction-badge']}>
                    <EmojiRenderer text={emoji} />
                  </div>
                ))}
              </div>
            )}

            <span className={styles.timestamp}>
              {isVanishing && vanishCountdown && (
                <span className={styles['vanish-countdown']}>
                  <Clock size={8} className={styles['vanish-icon']} />
                  {vanishCountdown}
                </span>
              )}
              {time}
              {isEdited && <span className={styles['edited-indicator']}> (ed)</span>}


              {isMine && (
                <span className={styles['status-indicator']}>
                  {(status === 'pending' || status === 'sending') && <Clock size={10} className={styles['status-icon']} />}
                  {status === 'failed' && <AlertCircle size={10} className={styles['status-icon-failed']} />}
                </span>
              )}
            </span>
          </div>

          {isMine && status === 'failed' && (
            <button
              className={styles['retry-button']}
              onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
            >
              <RefreshCcw size={10} />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>

      {isMine && (isLastRead || isLast) && status !== 'pending' && status !== 'sending' && status !== 'failed' && (
        <div className={styles['external-status']}>
          {status === 'read' || message.isRead || message.is_read ? 'Seen' : 'Sent'} {formatLastSeen((status === 'read' || message.isRead || message.is_read) && (message.seenAt || message.seen_at) ? (message.seenAt || message.seen_at) : (message.createdAt || message.created_at))}
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  return prev.text === next.text &&
    prev.time === next.time &&
    prev.isLastRead === next.isLastRead &&
    prev.status === next.status &&
    prev.message?.metadata === next.message?.metadata;
});

MessageBubble.displayName = 'MessageBubble';
export default MessageBubble;
