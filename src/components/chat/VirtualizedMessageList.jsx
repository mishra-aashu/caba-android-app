import React, { useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import useChatStore from '../../store/useChatStore';
import { useInfiniteMessages } from '../../hooks/useMessages';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import styles from '../../styles/chat.module.css';

/**
 * VirtualizedMessageList - A high-performance chat message list using react-virtuoso
 * 
 * Features:
 * - Uses Zustand store for messages (selective subscription for 60fps)
 * - Starts at bottom (chat-like behavior)
 * - Dynamic height support for variable message sizes
 * - Auto-scroll to bottom on new messages
 * - Memoized components to prevent unnecessary re-renders
 * - Optimized for mobile performance (60+ FPS)
 */
const VirtualizedMessageList = React.forwardRef(({
  currentUser,
  selectedMessages,
  isSelectionMode,
  onMessageSelect,
  onReply,
  onForward,
  onDelete,
  onEdit,
  onMediaView,
  onMediaDownload,
  isLoading,
  isGroupChat,
  onSenderClick,
  onAcceptGame,
  onRejectGame,
  onJoinGame,
  isScrolledToBottom,
  onScroll,
  followOutput,
  typingUsers = {},
  initialTopMostItemIndex,
  onRangeChanged,
  chatId,
}, ref) => {
  // 🔥 NEW ARCHITECTURE: TanStack Query for data
  const {
    data,
    isLoading: isQueryLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteMessages(chatId);

  // Sync with Realtime
  useRealtimeMessages(chatId, {}, currentUser?.id);

  // Flatten messages from infinite query pages
  const messages = useMemo(() => {
    if (!data) return [];
    // TanStack Query Infinite Query data is in pages. Reverse them if needed.
    // fetchMessagesPage returns newest first, so we reverse it to show in order (oldest at top).
    const allMsgs = data.pages.flatMap(page => page.data);
    return [...allMsgs].reverse();
  }, [data]);

  const isLoadingTotal = isQueryLoading && messages.length === 0;

  const virtuosoRef = useRef(null);
  const containerRef = useRef(null);

  // Combine messages with date headers
  const itemsWithHeaders = useMemo(() => {
    const items = [];

    messages.forEach((message, index) => {
      // Add date header if needed
      const createdAt = message?.created_at ?? message?.createdAt;
      if (createdAt) {
        const date = new Date(createdAt);
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const prevDate = prevMessage
          ? new Date(prevMessage.created_at ?? prevMessage.createdAt)
          : null;

        const isFirstOfDay = !prevDate || date.toDateString() !== prevDate.toDateString();

        if (isFirstOfDay) {
          items.push({ type: 'date-header', date: date.toDateString(), key: `header-${date.toDateString()}` });
        }
      }

      // Add message
      items.push({ type: 'message', message, key: message.id || message.tempId || `msg-${index}` });
    });
    return items;
  }, [messages]);

  // Scroll to bottom function exposed to parent
  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (virtuosoRef.current && itemsWithHeaders.length > 0) {
      virtuosoRef.current.scrollToIndex({
        index: itemsWithHeaders.length - 1,
        behavior,
        align: 'end',
      });
    }
  }, [itemsWithHeaders.length]);

  // Expose scrollToBottom to parent via imperative handle
  React.useImperativeHandle(ref, () => ({
    scrollToBottom
  }), [scrollToBottom]);



  // Memoized message item renderer with zero-height fix
  // Use useMemo instead of useCallback to avoid stale closures
  const renderMessage = useMemo(() => {
    return (index, message) => {
      if (!message) {
        // Return a placeholder with minimum height to prevent zero-sized element
        return (
          <div
            className={`${styles['message-item-placeholder']} ${styles['virtuoso-message-wrapper-static']}`}
          />
        );
      }

      // Safely get repliedMsg
      const replyTo = message.replyTo || message.reply_to;
      const repliedMsg = replyTo
        ? messages.find(m => m && m.id === replyTo)
        : null;

      // Get message ID for selection state
      const msgId = message.id || message.tempId || `msg-${index}`;
      const isSelected = selectedMessages?.has?.(message.id) || false;
      const msgCurrentUser = currentUser;

      // Wrap in a div with min-height to prevent zero-sized element error
      // Using stable dimensions
      return (
        <div
          className={`${styles['virtuoso-message-wrapper']} ${styles['virtuoso-message-wrapper-static']}`}
        >
          <MessageItem
            key={msgId}
            message={message}
            repliedMsg={repliedMsg}
            currentUser={msgCurrentUser}
            isSelected={isSelected}
            isSelectionMode={isSelectionMode}
            onSelect={() => onMessageSelect(message.id)}
            onReply={() => onReply(message)}
            onForward={() => onForward(message)}
            onDelete={onDelete}
            onEdit={onEdit}
            onMediaView={onMediaView}
            onMediaDownload={onMediaDownload}
            onAcceptGame={onAcceptGame}
            onRejectGame={onRejectGame}
            onJoinGame={onJoinGame}
            isGroupChat={isGroupChat}
            onSenderClick={onSenderClick}
          />
        </div>
      );
    };
  }, [
    messages,
    currentUser,
    selectedMessages,
    isSelectionMode,
    onMessageSelect,
    onReply,
    onForward,
    onDelete,
    onEdit,
    onMediaView,
    onMediaDownload,
    isGroupChat,
    onSenderClick,
    onAcceptGame,
    onRejectGame,
    onJoinGame,
  ]);



  // Render item with date headers
  const renderItem = useCallback((index) => {
    const item = itemsWithHeaders[index];
    if (!item) {
      return <div style={{ minHeight: '1px' }} />;
    }

    if (item.type === 'date-header') {
      return (
        <div
          className={`${styles['virtuoso-header-wrapper']} ${styles['date-header-wrapper-static']}`}
        >
          <div className={styles['date-separator']}>
            <div className={styles['date-pill']}>
              {new Date(item.date).toLocaleDateString()}
            </div>
          </div>
        </div>
      );
    }

    const messageIndex = messages.findIndex(m => m.id === item.message?.id || m.tempId === item.message?.tempId);
    return renderMessage(messageIndex, item.message);
  }, [itemsWithHeaders, messages, renderMessage]);

  // Loading state - Only show skeleton if we have ZERO messages in cache
  if (isLoadingTotal) {
    return (
      <div className={`${styles['messages-wrapper']} ${styles['virtuoso-loading']}`}>
        <div className={styles['skeleton-messages']}>
          <div className={`${styles['skeleton-message']} ${styles.received}`}></div>
          <div className={`${styles['skeleton-message']} ${styles.sent}`}></div>
          <div className={`${styles['skeleton-message']} ${styles.received}`}></div>
          <div className={`${styles['skeleton-message']} ${styles.sent}`}></div>
          <div className={`${styles['skeleton-message']} ${styles.received}`}></div>
          <div className={`${styles['skeleton-message']} ${styles.sent}`}></div>
        </div>
      </div>
    );
  }

  // Empty state - Only show if successfully loaded and still empty
  if (!isLoadingTotal && messages.length === 0) {
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
        initialTopMostItemIndex={initialTopMostItemIndex ?? (itemsWithHeaders.length > 0 ? itemsWithHeaders.length - 1 : 0)}
        followOutput={'auto'}
        atBottomStateChange={(isAtBottom) => {
          if (onScroll) onScroll({ isAtBottom });
        }}
        atTopStateChange={(isAtTop) => {
          if (onScroll) onScroll({ isAtTop });
        }}
        rangeChanged={(range) => {
          if (onRangeChanged) onRangeChanged(range.startIndex);
        }}
        itemContent={renderItem}
        computeItemKey={(index, item) => item?.key || `item-${index}`}
        overscan={200}
        alignToBottom={true}
        startReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        style={{
          flex: 1,
          width: '100%',
          minHeight: 0,
          height: '100%',
        }}
      />
      {/* Typing indicator outside virtuoso to avoid zero-sized element issues */}
      <TypingIndicator isVisible={Object.keys(typingUsers).length > 0} />
    </div>
  );
});


// Memoized export for performance - strict comparison to prevent flickering
// Note: messages is now handled by Zustand store subscription, not props
export default memo(VirtualizedMessageList, (prevProps, nextProps) => {
  // Re-render when messages array changes (new message, status update, etc)
  if (prevProps.messages !== nextProps.messages) return false;

  // Re-render on loading state change
  if (prevProps.isLoading !== nextProps.isLoading) return false;

  // Re-render on selection mode change
  if (prevProps.isSelectionMode !== nextProps.isSelectionMode) return false;

  // Re-render on currentUser change
  if (prevProps.currentUser !== nextProps.currentUser) return false;

  // Re-render on selected messages count change
  if (prevProps.selectedMessages?.size !== nextProps.selectedMessages?.size) return false;

  // Re-render on typing users count change
  const prevTypingCount = Object.keys(prevProps.typingUsers || {}).length;
  const nextTypingCount = Object.keys(nextProps.typingUsers || {}).length;
  if (prevTypingCount !== nextTypingCount) return false;

  return true;
});
