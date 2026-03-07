import React from 'react';
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

  const groupedMessages = groupMessagesByDate(messages);

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
            // Safely get repliedMsg - only pass if it exists and has an id
            const replyTo = message.replyTo || message.reply_to;
            const repliedMsg = replyTo
              ? messages.find(m => m && m.id === replyTo)
              : null;

            return (
              <MessageItem
                key={message.id || message.tempId || `msg-${groupIdx}-${msgIdx}`}
                message={message}
                repliedMsg={repliedMsg}
                currentUser={currentUser}
                isSelected={selectedMessages.has(message.id)}
                isSelectionMode={isSelectionMode}
                onSelect={() => onMessageSelect(message.id)}
                onReply={() => onReply(message)}
                onForward={() => onForward(message)}
                onDelete={onDelete}
                onEdit={onEdit}
                onMediaView={onMediaView}
                onMediaDownload={onMediaDownload}
                isGroupChat={isGroupChat}
                onSenderClick={onSenderClick}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

export default MessageList;