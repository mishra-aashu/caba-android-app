import React, { useRef, useCallback, useMemo, memo, useEffect, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import useChatStore from '../../store/useChatStore';
import styles from '../../styles/chat.module.css';
import { getStableMessageId } from '../../utils/messageHelpers';
import { EyeOff } from 'lucide-react';

const VirtualizedMessageList = React.forwardRef(({
  messages = [],
  currentUser,
  onReply,
  onForward,
  onDelete,
  onEdit,
  onMediaView,
  onMediaDownload,
  isLoading: isQueryLoading,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  isGroupChat,
  onSenderClick,
  onAcceptGame,
  onRejectGame,
  onJoinGame,
  onScroll,
  followOutput,
  typingUsers = {},
  initialTopMostItemIndex,
  onRangeChanged,
  chatId,
  isVanishMode = false,
  onToggleVanish,
  onManualRetry,
  isDexieLoading = false,
}, ref) => {
  const isSelectionMode = useChatStore(state => state.isSelectionMode);

  const lastReadMessageId = useMemo(() => {
    if (!messages.length || !currentUser?.id) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const isMine = (msg.sender_id || msg.senderId) === currentUser.id;
      const isRead = msg.is_read || msg.isRead;
      if (isMine && isRead) return msg.id;
    }
    return null;
  }, [messages, currentUser?.id]);

  // [PERF] O(1) Map for reply-to lookups. Replaces the O(N) messages.find() inside
  // renderMessage which was causing the entire render callback to re-create on every
  // new message event, forcing Virtuoso to rebuild all item renderers.
  const messageMap = useMemo(() => {
    const m = new Map();
    for (const msg of messages) {
      if (msg.id) m.set(msg.id, msg);
    }
    return m;
  }, [messages]);

  const isLoadingTotal = (isQueryLoading || isDexieLoading) && messages.length === 0;
  const virtuosoRef = useRef(null);
  const containerRef = useRef(null);

  // [FIX #6] Track both scroll states via refs so each callback can report both
  // Previously: atBottomStateChange only sent {isAtBottom}, atTopStateChange only sent {isAtTop}
  // This caused the parent's handleScroll to incorrectly set isAtBottom=false
  // when atTopStateChange fired (because isAtBottom was undefined → false)
  const isAtBottomRef = useRef(true);
  const isAtTopRef = useRef(false);

  // Swipe up to vanish mode logic
  const [swipeProgress, setSwipeProgress] = useState(0);
  const touchStartY = useRef(0);
  const startedAtBottom = useRef(false);
  const isPullingUp = useRef(false);
  const swipeThreshold = 80; // px

    // ─── MESSAGE LIST GENERATION ───
    const { itemsWithHeaders, messageIdToIndex } = useMemo(() => {
        const items = [];
        const idMap = new Map();

        // [STRICT SEPARATION] 
        // In normal mode: only show non-vanish messages
        // In vanish mode: only show vanish messages
        const displayMessages = isVanishMode 
            ? messages.filter(m => m.vanish_at || m.vanishAt)
            : messages.filter(m => !m.vanish_at && !m.vanishAt);

        // Add E2EE Notice at the very top
        if (!hasNextPage && displayMessages.length > 0) {
            items.push({ type: 'encryption-notice', key: 'e2ee-top-notice' });
        }

        if (isVanishMode) {
            if (displayMessages.length === 0) {
                items.push({ type: 'vanish-empty', key: 'vanish-empty-state' });
            } else {
                displayMessages.forEach((message, index) => {
                    const msgId = message.id || message.tempId;
                    if (msgId) idMap.set(msgId, messages.indexOf(message));
                    
                    const createdAt = message?.created_at ?? message?.createdAt;
                    if (createdAt) {
                        const date = new Date(createdAt);
                        const prevMessage = index > 0 ? displayMessages[index - 1] : null;
                        const prevDate = prevMessage ? new Date(prevMessage.created_at ?? prevMessage.createdAt) : null;
                        if (!prevDate || date.toDateString() !== prevDate.toDateString()) {
                            items.push({ type: 'vanish-date-header', date: date.toDateString(), key: `vanish-header-${date.toDateString()}` });
                        }
                    }
                    items.push({ type: 'vanish-message', message, key: msgId ? `v-${msgId}` : `v-msg-${index}` });
                });
            }
        } else {
            // Normal mode
            displayMessages.forEach((message, index) => {
                const msgId = message.id || message.tempId;
                if (msgId) idMap.set(msgId, messages.indexOf(message));

                const createdAt = message?.created_at ?? message?.createdAt;
                if (createdAt) {
                    const date = new Date(createdAt);
                    const prevMessage = index > 0 ? displayMessages[index - 1] : null;
                    const prevDate = prevMessage ? new Date(prevMessage.created_at ?? prevMessage.createdAt) : null;
                    if (!prevDate || date.toDateString() !== prevDate.toDateString()) {
                        items.push({ type: 'date-header', date: date.toDateString(), key: `header-${date.toDateString()}` });
                    }
                }
                items.push({ type: 'message', message, key: msgId || `msg-${index}` });
            });
        }

        return { itemsWithHeaders: items, messageIdToIndex: idMap };
    }, [messages, isVanishMode, hasNextPage]);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (virtuosoRef.current && itemsWithHeaders.length > 0) {
      virtuosoRef.current.scrollToIndex({
        index: itemsWithHeaders.length - 1,
        behavior,
        align: 'end',
      });
    }
  }, [itemsWithHeaders.length]);

  React.useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

  const VanishEmptyState = () => (
    <div className={styles['vanish-empty-inner']}>
      <div className={styles['vanish-empty-icon']}>
        <div className={styles['vanish-glow']} />
        <EyeOff size={48} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
      </div>
      <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
        Private Messaging
      </h3>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', maxWidth: '240px', lineHeight: '1.5' }}>
        Messages disappear after they've been seen or when you leave the chat.
      </p>
    </div>
  );

  const renderMessage = useCallback((messageIndex, message) => {
    if (!message) {
      return (
        <div className={styles['message-item-placeholder']} />
      );
    }

    const replyTo = message.replyTo || message.reply_to;
    // [PERF] O(1) Map lookup instead of O(N) find() — prevents renderMessage
    // from being invalidated (and Virtuoso from rebuilding all items) on every message event.
    const repliedMsg = replyTo ? (messageMap.get(replyTo) ?? null) : null;

    const msgId = getStableMessageId(message, messageIndex);

    return (
      <MessageItem
        key={msgId}
        index={messageIndex}
        message={message}
        repliedMsg={repliedMsg}
        currentUser={currentUser}
        onReply={onReply}
        onForward={onForward}
        onDelete={onDelete}
        onEdit={onEdit}
        onMediaView={onMediaView}
        onMediaDownload={onMediaDownload}
        onAcceptGame={onAcceptGame}
        onRejectGame={onRejectGame}
        onJoinGame={onJoinGame}
        isGroupChat={isGroupChat}
        onSenderClick={onSenderClick}
        isLastRead={message.id === lastReadMessageId}
        isLast={messageIndex === messages.length - 1}
        onManualRetry={onManualRetry}
      />
    );
  }, [
    messageMap,        // stable Map reference — only changes when messages array changes
    messages.length,   // need length for isLast calculation
    currentUser,
    onReply, onForward, onDelete, onEdit,
    onMediaView, onMediaDownload,
    isGroupChat, onSenderClick,
    onAcceptGame, onRejectGame, onJoinGame,
    lastReadMessageId,
  ]);

  const renderItem = useCallback((index, item) => {
    // [NOTE] Using the `item` parameter directly from Virtuoso
    // instead of itemsWithHeaders[index] — cleaner and avoids stale closure
    if (!item) return <div style={{ minHeight: '1px' }} />;

    if (item.type === 'encryption-notice') {
      return (
        <div className={styles['encryption-notice-container']}>
          <div className={styles['encryption-notice-pill']}>
            <div className={styles['encryption-notice-icon']}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            Messages and calls are end-to-end encrypted. No one outside of this chat, not even Elevengram, can read or listen to them. Click to learn more.
          </div>
        </div>
      );
    }
    if (item.type === 'vanish-empty') {
      return <VanishEmptyState />;
    }

    if (item.type === 'date-header') {
      return (
        <div className={styles['date-separator']}>
          <div className={styles['date-pill']}>
            {new Date(item.date).toLocaleDateString()}
          </div>
        </div>
      );
    }

    if (item.type === 'vanish-date-header') {
      return (
        <div className={styles['date-separator']} style={{ padding: '8px 0' }}>
          <div className={styles['date-pill']}>{new Date(item.date).toLocaleDateString()}</div>
        </div>
      );
    }

    if (item.type === 'vanish-message') {
      const mId = item.message?.id || item.message?.tempId;
      const messageIndex = mId ? (messageIdToIndex.get(mId) ?? -1) : -1;
      return (
        <div style={{ padding: '2px 0' }}>
          {renderMessage(messageIndex, item.message)}
        </div>
      );
    }

    const mId = item.message?.id || item.message?.tempId;
    const messageIndex = mId ? (messageIdToIndex.get(mId) ?? -1) : -1;
    return renderMessage(messageIndex, item.message);
  }, [messageIdToIndex, renderMessage]);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    if (!isVanishMode && isAtBottomRef.current) {
      // Prepare for pull-up (activate)
      startedAtBottom.current = true;
      isPullingUp.current = true;
    } else if (isVanishMode && isAtTopRef.current) {
      // Prepare for pull-down (deactivate)
      startedAtBottom.current = true; // Use same flag to indicate swipe started at target edge
      isPullingUp.current = true; 
    } else {
      startedAtBottom.current = false;
      isPullingUp.current = false;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPullingUp.current || !startedAtBottom.current) return;
    
    const touchY = e.touches[0].clientY;
    const deltaY = touchStartY.current - touchY;
    
    // directedDelta > 0 means the gesture is moving in the correct direction to trigger the toggle
    // Pull-up (deltaY > 0) when OFF
    // Pull-down (deltaY < 0) when ON
    const directedDelta = isVanishMode ? -deltaY : deltaY;

    if (directedDelta > 0) {
      // Check if we are actually at the edge while swiping
      // (sometimes scroll happens before we start tracking)
      const isAtEdge = isVanishMode ? isAtTopRef.current : isAtBottomRef.current;
      if (!isAtEdge) {
        setSwipeProgress(0);
        return;
      }

      const progress = Math.min(directedDelta, swipeThreshold + 40);
      setSwipeProgress(progress);
      
      // Prevent default to stop native rubber-banding during the gesture
      if (e.cancelable) e.preventDefault();
    } else {
      setSwipeProgress(0);
    }
  };

  const handleTouchEnd = () => {
    if (isPullingUp.current && startedAtBottom.current) {
      if (swipeProgress >= swipeThreshold) {
        onToggleVanish?.();
        // Haptics...
        if (window.Capacitor) {
          try {
            import('../../utils/hapticsManager').then(m => m.default.impact('medium'));
          } catch(e) {}
        }
      }
      setSwipeProgress(0);
      isPullingUp.current = false;
    }
  };

  // ─── TOUCH LISTENERS (MANUAL FOR PASSIVE: FALSE) ───
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (isLoadingTotal) {
    return (
      <div className={`${styles['messages-wrapper']} ${styles['virtuoso-loading']}`}>
        <div className={styles['skeleton-messages']}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`${styles['skeleton-message']} ${i % 2 === 0 ? styles.received : styles.sent}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!isLoadingTotal && !isDexieLoading && messages.length === 0) {
    return (
      <div className={`${styles['messages-wrapper']} ${styles['virtuoso-empty']}`}>
        <div className={styles['no-messages-placeholder']}>
          <div className={styles['no-messages-content']}>
            <div className={styles['no-messages-icon']}>💬</div>
            <h3>No messages yet</h3>
            <p>Start the conversation by sending a message!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles['messages-wrapper']} ${styles['virtuoso-container']} ${styles['full-size-flex-column']}`}
      ref={containerRef}
    >
      <Virtuoso
        ref={virtuosoRef}
        data={itemsWithHeaders}
        initialTopMostItemIndex={
          initialTopMostItemIndex ?? (itemsWithHeaders.length > 0 ? 999999 : 0)
        }
        followOutput="auto"
        // [FIX #6] Both callbacks now send BOTH isAtBottom and isAtTop
        // using refs to track the other value
        atBottomStateChange={(atBottom) => {
          isAtBottomRef.current = atBottom;
          onScroll?.({ isAtBottom: atBottom, isAtTop: isAtTopRef.current });
        }}
        atTopStateChange={(atTop) => {
          isAtTopRef.current = atTop;
          onScroll?.({ isAtTop: atTop, isAtBottom: isAtBottomRef.current });
        }}
        rangeChanged={(range) => onRangeChanged?.(range.startIndex)}
        itemContent={renderItem}
        computeItemKey={(index, item) => item?.key || `item-${index}`}
        overscan={100}
        increaseViewportBy={200}
        alignToBottom={true}
        startReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        components={{
          // [FIX] Add a small footer to ensure the last message isn't cut off
          Footer: () => <div style={{ height: '12px', width: '100%' }} />
        }}
        style={{ flex: 1, width: '100%', minHeight: 0, height: '100%' }}
      />
      
      {/* Swipe toggle indicator */}
      {swipeProgress > 0 && (
        <div 
          className={styles['swipe-vanish-indicator']}
          style={{ 
            [isVanishMode ? 'top' : 'bottom']: '40px',
            transform: isVanishMode ? `translateY(${swipeProgress / 2}px)` : `translateY(${-swipeProgress / 2}px)`,
            opacity: Math.min(swipeProgress / (swipeThreshold * 0.7), 1),
            display: 'flex',
            flexDirection: isVanishMode ? 'column-reverse' : 'column',
          }}
        >
          <div className={styles['swipe-circle']} style={{ 
            transform: `scale(${Math.min(0.5 + (swipeProgress / swipeThreshold) * 0.5, 1.2)})`,
            borderColor: swipeProgress >= swipeThreshold ? 'var(--brand-primary)' : 'rgba(255,255,255,0.3)',
            backgroundColor: swipeProgress >= swipeThreshold ? 'rgba(0, 168, 132, 0.1)' : 'transparent',
          }}>
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ transform: isVanishMode ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <path d="m18 15-6-6-6 6"/>
            </svg>
          </div>
          <span style={{ 
            fontSize: '13px', 
            fontWeight: '600', 
            color: swipeProgress >= swipeThreshold ? 'var(--brand-primary)' : '#fff',
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            marginTop: isVanishMode ? 0 : 8,
            marginBottom: isVanishMode ? 8 : 0,
          }}>
            {swipeProgress >= swipeThreshold 
              ? `Release to turn ${isVanishMode ? 'OFF' : 'ON'} vanish mode` 
              : `Swipe ${isVanishMode ? 'down' : 'up'} to turn ${isVanishMode ? 'off' : 'on'} vanish mode`}
          </span>
        </div>
      )}

      <TypingIndicator isVisible={Object.keys(typingUsers).length > 0} />
    </div>
  );
});

// [FIX #2 — CRITICAL] Added messages check to memo
// Previously: memo only checked isLoading, currentUser, chatId, isGroupChat, typingUsers
// MISSING: messages — so when new messages arrived (send/receive), the Virtuoso
// data prop never updated and the list showed stale content.
// New messages were completely invisible until something else forced a re-render.
export default memo(VirtualizedMessageList, (prevProps, nextProps) => {
  if (prevProps.messages !== nextProps.messages) return false;
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.currentUser?.id !== nextProps.currentUser?.id) return false;
  if (prevProps.chatId !== nextProps.chatId) return false;
  if (prevProps.isGroupChat !== nextProps.isGroupChat) return false;
  if (prevProps.isFetchingNextPage !== nextProps.isFetchingNextPage) return false;
  if (prevProps.hasNextPage !== nextProps.hasNextPage) return false;
  if (prevProps.isVanishMode !== nextProps.isVanishMode) return false;  // FIX: re-render on vanish toggle
  if (prevProps.isDexieLoading !== nextProps.isDexieLoading) return false;

  const prevTyping = Object.keys(prevProps.typingUsers || {}).length;
  const nextTyping = Object.keys(nextProps.typingUsers || {}).length;
  if (prevTyping !== nextTyping) return false;

  return true;
});