import React from 'react';
import MessageItem from './MessageItem';

const MessageList = ({
  messages,
  currentUser,
  selectedMessages,
  isSelectionMode,
  onMessageSelect,
  onReply,
  onForward,
  onDelete,
  onMediaView,
  onMediaDownload,
  isLoading
}) => {
  // Helper function to safely parse dates
  const isValidDate = (d) => d instanceof Date && !isNaN(d);

  const formatDateSafe = (dateString) => {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    if (!isValidDate(date)) return null;
    
    return date.toDateString();
  };

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = {};

    messages.forEach(message => {
      const dateKey = formatDateSafe(message.created_at);
      
      // Skip messages with invalid dates
      if (!dateKey) return;

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return groups;
  };

  const groupedMessages = groupMessagesByDate(messages);

  if (!messages || messages.length === 0) {
    if (isLoading) {
      return (
        <div className="messages-wrapper">
          <div className="skeleton-messages">
            <div className="skeleton-message received"></div>
            <div className="skeleton-message sent"></div>
            <div className="skeleton-message received"></div>
            <div className="skeleton-message sent"></div>
            <div className="skeleton-message received"></div>
            <div className="skeleton-message sent"></div>
          </div>
        </div>
      );
    }
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
            <div className="date-pill">
              {new Date(dateMessages[0].created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Messages for this date */}
          {dateMessages.map(message => {
            // Find the replied message if reply_to exists
            const repliedMsg = message.reply_to ? messages.find(m => m.id === message.reply_to) : null;

            return (
              <MessageItem
                key={message.id}
                message={message}
                repliedMsg={repliedMsg}
                currentUser={currentUser}
                isSelected={selectedMessages.has(message.id)}
                isSelectionMode={isSelectionMode}
                onSelect={() => onMessageSelect(message.id)}
                onReply={() => onReply(message)}
                onForward={() => onForward(message)}
                onDelete={onDelete}
                onMediaView={onMediaView}
                onMediaDownload={onMediaDownload}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

export default MessageList;