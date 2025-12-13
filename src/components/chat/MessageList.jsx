import React from 'react';
import MessageItem from './MessageItem';

const MessageList = ({
  messages,
  currentUser,
  selectedMessages,
  isSelectionMode,
  onMessageSelect,
  onReply,
  onDelete,
  onMediaView,
  onMediaDownload
}) => {
  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = {};

    messages.forEach(message => {
      const date = new Date(message.created_at);
      const dateKey = date.toDateString();

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return groups;
  };

  const groupedMessages = groupMessagesByDate(messages);

  if (!messages || messages.length === 0) {
    return (
      <div className="messages-wrapper">
        <div className="no-messages-placeholder">
          <div className="no-messages-content">
            <div className="no-messages-icon">💬</div>
            <h3>No messages yet</h3>
            <p>Start the conversation by sending a message!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-wrapper">
      {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
        <React.Fragment key={dateKey}>
          {/* Date Separator */}
          <div className="date-separator">
            <span>{new Date(dateMessages[0].created_at).toLocaleDateString()}</span>
          </div>

          {/* Messages for this date */}
          {dateMessages.map(message => (
            <MessageItem
              key={message.id}
              message={message}
              currentUser={currentUser}
              isSelected={selectedMessages.has(message.id)}
              isSelectionMode={isSelectionMode}
              onSelect={() => onMessageSelect(message.id)}
              onReply={() => onReply(message)}
              onDelete={onDelete}
              onMediaView={onMediaView}
              onMediaDownload={onMediaDownload}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

export default MessageList;