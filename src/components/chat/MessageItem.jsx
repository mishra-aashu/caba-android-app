import React, { useState, useRef, useCallback, memo, Suspense, lazy } from 'react';
import MediaMessage from './MediaMessage';
import VoiceMessage from './VoiceMessage';
import { formatBubbleTime } from '../../utils/dateFormatter';
import { Check } from 'lucide-react';
import MessageBubble from './MessageBubble';
import useChatStore from '../../store/useChatStore';
import styles from '../../styles/chat.module.css';

// Lazy load heavy interactive components
const DesktopContextMenu = lazy(() => import('./DesktopContextMenu'));
const ReactionPicker = lazy(() => import('./ReactionPicker'));

const MessageItem = ({
  message,
  index,
  repliedMsg,
  currentUser,
  onReply,
  onForward,
  onMediaView,
  onDelete,
  onEdit,
  isGroupChat,
  onSenderClick,
  isLastRead,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const messageRef = useRef(null);

  const isSelectionMode = useChatStore(state => state.isSelectionMode);
  const msgId = message.id || message.tempId;
  const isSelected = useChatStore(useCallback(state => state.selectedMessageIds.has(msgId), [msgId]));
  const toggleSelection = useChatStore(state => state.toggleMessageSelection);

  const isSent = (message.senderId || message.sender_id) === currentUser?.id;
  const isRead = message.isRead || message.is_read;

  const handleContextMenu = (e) => {
    if (isSelectionMode) return;
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowActions(true);
  };

  const handleSelectionTap = (e) => {
    e.preventDefault();
    toggleSelection(msgId);
  };

  const renderContent = () => {
    const mediaPath = message.mediaPath || message.media_path;
    const mediaType = message.mediaType || message.media_type;
    const time = formatBubbleTime(message.createdAt || message.created_at);

    if (mediaPath && (mediaType === 'image' || mediaType === 'video')) {
      return (
        <MediaMessage
          message={message}
          repliedMsg={repliedMsg}
          currentUserId={currentUser?.id}
          isSender={isSent}
          time={time}
          status={isRead ? 'read' : 'sent'}
          onMediaClick={(url, msg) => onMediaView?.(url, mediaType, msg)}
          isLastRead={isLastRead}
        />
      );
    }

    if (mediaPath && (mediaType === 'voice' || mediaType === 'audio')) {
      return (
        <VoiceMessage
          message={message}
          repliedMsg={repliedMsg}
          currentUserId={currentUser?.id}
          isSender={isSent}
          time={time}
          status={isRead ? 'read' : 'sent'}
          isLastRead={isLastRead}
        />
      );
    }

    return (
      <MessageBubble
        text={message.content ?? ''}
        repliedMsg={repliedMsg}
        currentUserId={currentUser?.id}
        time={time}
        isMine={isSent}
        isDeleted={message.isDeleted || message.is_deleted}
        status={isRead ? 'read' : 'sent'}
        message={message}
        isLastRead={isLastRead}
      />
    );
  };

  return (
    <div
      ref={messageRef}
      id={`message-${msgId}`}
      onContextMenu={handleContextMenu}
      className={`${styles['message-item']} ${isSent ? styles.sent : styles.received} ${isSelected ? styles.selected : ''} ${isSelectionMode ? styles['selection-active'] : ''}`}
      style={{ contain: 'layout' }}
    >
      {isSelectionMode && (
        <>
          <div className={styles['selection-overlay']} onClick={handleSelectionTap} />
          <div className={`${styles['selection-indicator']} ${isSelected ? styles.selected : ''}`}>
            {isSelected && <Check size={14} color="white" strokeWidth={3} />}
          </div>
        </>
      )}

      <div className={styles['message-content-wrapper']}>
        <div className={styles['message-bubble-wrapper']}>
          {renderContent()}
        </div>
      </div>

      <Suspense fallback={null}>
        {showActions && (
          <DesktopContextMenu
            position={menuPos}
            isVisible={showActions}
            onReply={() => onReply(message)}
            onCopy={() => navigator.clipboard.writeText(message.content)}
            onForward={() => onForward(message)}
            onDelete={() => onDelete(message.id)}
            onEdit={() => onEdit(message)}
            onSelect={() => { console.log('Select clicked for message:', msgId); toggleSelection(msgId); }}
            onReactionSelect={(emoji) => window.handleReactionToggle?.(msgId, emoji)}
            onClose={() => setShowActions(false)}
            isSent={isSent}
            isDeleted={message.isDeleted || message.is_deleted}
          />
        )}
        {showReactionPicker && (
          <ReactionPicker
            onSelect={(reaction) => {
              window.handleReactionToggle?.(message.id, reaction);
              setShowReactionPicker(false);
            }}
            onClose={() => setShowReactionPicker(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default memo(MessageItem, (prev, next) => {
  return prev.message.id === next.message.id &&
         prev.message.content === next.message.content &&
         prev.message.is_read === next.message.is_read &&
         prev.isLastRead === next.isLastRead;
});

