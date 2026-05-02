import React, { useState, useMemo } from 'react';
import { Pin, ChevronRight, ChevronDown, X } from 'lucide-react';
import styles from '../../styles/chat.module.css';

const PinnedMessagesBar = ({ pinnedMessages = [], onUnpin, onJumpToMessage }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!pinnedMessages || pinnedMessages.length === 0) return null;

  const latestPinned = pinnedMessages[pinnedMessages.length - 1];

  return (
    <div className={`${styles['pinned-bar-container']} ${isExpanded ? styles['expanded'] : ''}`}>
      <div className={styles['pinned-bar-header']} onClick={() => pinnedMessages.length > 1 && setIsExpanded(!isExpanded)}>
        <div className={styles['pinned-bar-left']}>
          <Pin size={16} className={styles['pin-icon']} />
          <div className={styles['pinned-info']}>
            <span className={styles['pinned-label']}>
              {pinnedMessages.length} Pinned Message{pinnedMessages.length > 1 ? 's' : ''}
            </span>
            {!isExpanded && (
              <p className={styles['pinned-preview']} onClick={(e) => { e.stopPropagation(); onJumpToMessage(latestPinned.id); }}>
                {latestPinned.content || (latestPinned.mediaType ? `[${latestPinned.mediaType}]` : 'Pinned message')}
              </p>
            )}
          </div>
        </div>
        <div className={styles['pinned-bar-right']}>
          {pinnedMessages.length > 1 && (
            isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className={styles['pinned-list']}>
          {pinnedMessages.map((msg) => (
            <div key={msg.id} className={styles['pinned-list-item']}>
              <div 
                className={styles['pinned-item-content']} 
                onClick={() => { onJumpToMessage(msg.id); setIsExpanded(false); }}
              >
                <p>{msg.content || `[${msg.mediaType || 'Media'}]`}</p>
                <span className={styles['pinned-time']}>{new Date(msg.createdAt).toLocaleDateString()}</span>
              </div>
              <button 
                className={styles['unpin-btn']} 
                onClick={(e) => { e.stopPropagation(); onUnpin(msg.id); }}
                title="Unpin"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PinnedMessagesBar;
