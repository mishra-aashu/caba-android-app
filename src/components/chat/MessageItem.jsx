import React, { useState, useRef, useCallback, memo, Suspense, lazy } from 'react';
import MediaMessage from './MediaMessage';
import VoiceMessage from './VoiceMessage';
import { formatBubbleTime } from '../../utils/dateFormatter';
import { Check, Reply } from 'lucide-react';
import MessageBubble from './MessageBubble';
import useChatStore from '../../store/useChatStore';
import { manualRetrySyncItem } from '../../db/db';
import toast from 'react-hot-toast';
// [FIX #3] Added missing import — was causing ReferenceError crash on long press
import hapticsManager from '../../utils/hapticsManager';
import styles from '../../styles/chat.module.css';

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
  isLast,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const messageRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const swipeTriggered = useRef(false);

  const isSelectionMode = useChatStore(state => state.isSelectionMode);
  const msgId = message.id || message.tempId;
  const isSelected = useChatStore(useCallback(state => state.selectedMessageIds.has(msgId), [msgId]));
  const toggleSelection = useChatStore(state => state.toggleMessageSelection);

  const isSent = (message.senderId || message.sender_id) === currentUser?.id;
  const isRead = message.isRead || message.is_read;

  // [FIX #4] Unified status computation — used by ALL sub-components
  // Previously: VoiceMessage/MediaMessage got `isRead ? 'read' : 'sent'`
  // which ignored 'pending', 'sending', 'failed' statuses entirely.
  // Now matches the same pattern MessageBubble already used.
  const messageStatus = message.status || (isRead ? 'read' : 'sent');

  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);

  // [FIX #8] Track touch vs mouse to prevent double-firing
  const isTouchDevice = useRef(false);

  const handleTouchStart = (e) => {
    isTouchDevice.current = true;
    isLongPress.current = false;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipeTriggered.current = false;

    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (isSelectionMode) {
        toggleSelection(msgId);
      } else {
        hapticsManager.impact();
        setMenuPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        setShowActions(true);
      }
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (!touchStartX.current || isLongPress.current || isSelectionMode) return;

    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Prevent vertical scrolling from triggering swipe
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    // Resistance logic: Swipe right for both sent/received
    if (deltaX > 0) {
      // Clear long press if swiping
      if (deltaX > 10 && longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }

      const resistance = 0.5;
      const x = Math.min(deltaX * resistance, 80); // Cap at 80px
      setSwipeX(x);

      // Trigger threshold feedback
      if (x >= 60 && !swipeTriggered.current) {
        swipeTriggered.current = true;
        hapticsManager.impact('light');
      } else if (x < 60) {
        swipeTriggered.current = false;
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    if (swipeTriggered.current) {
      onReply(message);
      hapticsManager.impact('medium');
    }

    setSwipeX(0);
    touchStartX.current = null;
    touchStartY.current = null;
    swipeTriggered.current = false;

    if (isLongPress.current) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
    }
  };

  // [FIX #8] Mouse handlers only fire if not a touch device
  const handleMouseDown = (e) => {
    if (isTouchDevice.current) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (isSelectionMode) {
        toggleSelection(msgId);
      } else {
        setMenuPos({ x: e.clientX, y: e.clientY });
        setShowActions(true);
      }
    }, 500);
  };

  const handleMouseUp = () => {
    if (isTouchDevice.current) {
      isTouchDevice.current = false; // Reset for next interaction
      return;
    }
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (isSelectionMode) {
      toggleSelection(msgId);
      return;
    }
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowActions(true);
  };

  const handleSelectionTap = (e) => {
    e.preventDefault();
    toggleSelection(msgId);
  };

  const handleMessageTap = (e) => {
    if (isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelection(msgId);
      return;
    }
    // [FIX] No longer triggering actions on simple click
    // Actions are now triggered ONLY on Long Press above.
  };

  const handleRetry = useCallback(async () => {
    const tempId = message.tempId || (String(msgId).startsWith('temp_') ? String(msgId).replace('temp_', '') : null);
    if (tempId) {
      try {
        await manualRetrySyncItem(tempId);
        toast.success('Retrying message...');

        if (navigator.onLine) {
          window.dispatchEvent(new Event('online'));
        }
      } catch (err) {
        console.error('Retry failed:', err);
        toast.error('Failed to retry');
      }
    }
  }, [msgId, message.tempId]);

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
          // [FIX #4] Was: status={isRead ? 'read' : 'sent'}
          // 'pending', 'sending', 'failed' were never shown
          status={messageStatus}
          onMediaClick={(url, msg) => isSelectionMode ? toggleSelection(msgId) : onMediaView?.(url, mediaType, msg)}
          isLastRead={isLastRead}
          isLast={isLast}
          // [FIX #4] Was: not passed at all — retry button never worked
          onRetry={handleRetry}
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
          // [FIX #4] Same fix as MediaMessage
          status={messageStatus}
          isLastRead={isLastRead}
          isLast={isLast}
          // [FIX #4] Same fix — retry now works for voice messages
          onRetry={handleRetry}
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
        status={messageStatus}
        message={message}
        isLastRead={isLastRead}
        isLast={isLast}
        onRetry={handleRetry}
      />
    );
  };

  return (
    <div
      ref={messageRef}
      id={`message-${msgId}`}
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

      <div className={`${styles['swipe-indicator']} ${swipeX > 40 ? styles.active : ''}`} style={{ transform: `translateY(-50%) translateX(${Math.min(swipeX - 40, 0)}px)` }}>
        <Reply size={20} />
      </div>

      <div className={styles['message-content-wrapper']}>
        <div 
          className={styles['message-bubble-wrapper']}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onClick={handleMessageTap}
          style={{ 
            transform: `translateX(${swipeX}px)`,
            transition: swipeX === 0 ? 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)' : 'none'
          }}
        >
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
            onSelect={() => { toggleSelection(msgId); }}
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

// [FIX #5] Updated memo comparison
// Previously: only checked id, content, is_read, isLastRead
// Missing: status (sending→sent transitions stuck), metadata (reactions invisible),
//          is_deleted (deleted messages didn't show as deleted)
export default memo(MessageItem, (prev, next) => {
  return prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.is_read === next.message.is_read &&
    prev.message.status === next.message.status &&
    prev.message.metadata === next.message.metadata &&
    prev.message.is_deleted === next.message.is_deleted &&
    prev.isLastRead === next.isLastRead;
});