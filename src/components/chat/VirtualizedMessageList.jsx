import React, { useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import useChatStore from '../../store/useChatStore';
import styles from '../../styles/chat.module.css';
import { getStableMessageId } from '../../utils/messageHelpers';

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

  const isLoadingTotal = isQueryLoading && messages.length === 0;
  const virtuosoRef = useRef(null);
  const containerRef = useRef(null);

  // Optimized items with pre-calculated index map
  const { itemsWithHeaders, messageIdToIndex } = useMemo(() => {
    const items = [];
    const idMap = new Map();
    
    messages.forEach((message, index) => {
      const msgId = message.id || message.tempId;
      if (msgId) idMap.set(msgId, index);

      const createdAt = message?.created_at ?? message?.createdAt;
      if (createdAt) {
        const date = new Date(createdAt);
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const prevDate = prevMessage
          ? new Date(prevMessage.created_at ?? prevMessage.createdAt)
          : null;
        if (!prevDate || date.toDateString() !== prevDate.toDateString()) {
          items.push({
            type: 'date-header',
            date: date.toDateString(),
            key: `header-${date.toDateString()}`
          });
        }
      }
      items.push({
        type: 'message',
        message,
        key: msgId || `msg-${index}`
      });
    });
    return { itemsWithHeaders: items, messageIdToIndex: idMap };
  }, [messages]);

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

  const renderMessage = useCallback((messageIndex, message) => {
    if (!message) {
      return (
        <div className={styles['message-item-placeholder']} />
      );
    }

    const replyTo = message.replyTo || message.reply_to;
    const repliedMsg = replyTo
      ? messages.find(m => m && m.id === replyTo)
      : null;

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
      />
    );
  }, [
    messages,
    currentUser,
    onReply, onForward, onDelete, onEdit,
    onMediaView, onMediaDownload,
    isGroupChat, onSenderClick,
    onAcceptGame, onRejectGame, onJoinGame,
    lastReadMessageId,
  ]);

  const renderItem = useCallback((index) => {
    const item = itemsWithHeaders[index];
    if (!item) return <div style={{ minHeight: '1px' }} />;

    if (item.type === 'date-header') {
      return (
        <div className={styles['date-separator']}>
          <div className={styles['date-pill']}>
            {new Date(item.date).toLocaleDateString()}
          </div>
        </div>
      );
    }

    const mId = item.message?.id || item.message?.tempId;
    const messageIndex = mId ? (messageIdToIndex.get(mId) ?? -1) : -1;
    return renderMessage(messageIndex, item.message);
  }, [itemsWithHeaders, messageIdToIndex, renderMessage]);

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
        initialTopMostItemIndex={
          initialTopMostItemIndex ?? (itemsWithHeaders.length > 0 ? itemsWithHeaders.length - 1 : 0)
        }
        followOutput="auto"
        atBottomStateChange={(isAtBottom) => onScroll?.({ isAtBottom })}
        atTopStateChange={(isAtTop) => onScroll?.({ isAtTop })}
        rangeChanged={(range) => onRangeChanged?.(range.startIndex)}
        itemContent={renderItem}
        computeItemKey={(index, item) => item?.key || `item-${index}`}
        overscan={50}
        alignToBottom={true}
        startReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        style={{ flex: 1, width: '100%', minHeight: 0, height: '100%' }}
      />
      <TypingIndicator isVisible={Object.keys(typingUsers).length > 0} />
    </div>
  );
});

export default memo(VirtualizedMessageList, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.currentUser?.id !== nextProps.currentUser?.id) return false;
  if (prevProps.chatId !== nextProps.chatId) return false;
  if (prevProps.isGroupChat !== nextProps.isGroupChat) return false;

  const prevTyping = Object.keys(prevProps.typingUsers || {}).length;
  const nextTyping = Object.keys(nextProps.typingUsers || {}).length;
  if (prevTyping !== nextTyping) return false;

  return true;
});

