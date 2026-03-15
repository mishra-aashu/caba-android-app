import React, { useMemo } from 'react';
import MessageItem from './MessageItem';
import styles from '../../styles/chat.module.css';

const MessageList = ({
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
  isLoading,
  isGroupChat,
  onSenderClick,
}) => {
  const isValidDate = (d) => d instanceof Date && !isNaN(d);

  const formatDateSafe = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (!isValidDate(date)) return null;
    return date.toDateString();
  };

  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages.forEach(message => {
      const createdAt = message.created_at ?? message.createdAt;
      const dateKey = formatDateSafe(createdAt);
      if (!dateKey) return;
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(message);
    });
    return groups;
  };

  // [FIX #7] Calculate lastReadMessageId — was not computed at all
  // This means isLastRead was never passed, so "Seen" indicators never showed
  const lastReadMessageId = useMemo(() => {
    if (!messages?.length || !currentUser?.id) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const isMine = (msg.sender_id || msg.senderId) === currentUser.id;
      const isRead = msg.is_read || msg.isRead;
      if (isMine && isRead) return msg.id;
    }
    return null;
  }, [messages, currentUser?.id]);

  const groupedMessages = groupMessagesByDate(messages || []);

  if (!messages || messages.length === 0) {
    if (isLoading) {
      return (
        <div className={styles['messages-wrapper']}>
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
    return (
      <div className={styles['messages-wrapper']}>
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

  // [FIX #7] Track global message index for MessageItem's `index` prop
  let globalIndex = 0;

  return (
    <div className={styles['messages-wrapper']}>
      {Object.entries(groupedMessages).map(([dateKey, dateMessages], groupIdx) => (
        <React.Fragment key={`group-${dateKey}-${groupIdx}`}>
          <div className={styles['date-separator']}>
            <div className={styles['date-pill']}>
              {new Date(dateMessages[0].created_at ?? dateMessages[0].createdAt).toLocaleDateString()}
            </div>
          </div>

          {dateMessages.map((message, msgIdx) => {
            const replyTo = message.replyTo || message.reply_to;
            const repliedMsg = replyTo
              ? messages.find(m => m && m.id === replyTo)
              : null;

            // [FIX #7] Pass correct global index and isLastRead
            const currentIndex = globalIndex++;

            return (
              <MessageItem
                key={message.id || message.tempId || `msg-${groupIdx}-${msgIdx}`}
                message={message}
                index={currentIndex}
                repliedMsg={repliedMsg}
                currentUser={currentUser}
                onReply={() => onReply(message)}
                onForward={() => onForward(message)}
                onDelete={onDelete}
                onEdit={onEdit}
                onMediaView={onMediaView}
                onMediaDownload={onMediaDownload}
                isGroupChat={isGroupChat}
                onSenderClick={onSenderClick}
                // [FIX #7] Was: not passed — "Seen" timestamp never showed
                isLastRead={message.id === lastReadMessageId}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

export default MessageList;