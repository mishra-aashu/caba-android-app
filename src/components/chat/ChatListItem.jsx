import React from 'react';
import { Timer } from 'lucide-react';
import { formatLastSeen, formatTime } from '../../utils/timeUtils';
import '../../styles/ChatListItem.css';

const ChatListItem = ({ chat, onClick, isActive }) => {
  if (!chat) return null;
  const {
    name,
    avatar,
    lastMessage,
    timestamp,
    unreadCount,
    is_online,
    last_seen,
    isGroup,
    member_count,
    member_preview,
    is_vanish_enabled
  } = chat;

  // Format time using our helper or fallback
  // If user is online, show 'Online', otherwise show last seen if available, else message timestamp
  const displayTime = formatTime(timestamp);

  // Determine message prefix (You: or Name:)
  const messagePrefix = chat.isMyMessage
    ? <span className="message-sender-prefix me">You: </span>
    : (isGroup && chat.lastMessageSenderName ? <span className="message-sender-prefix">{chat.lastMessageSenderName}: </span> : null);

  return (
    <div
      className={`chat-item ${isActive ? 'active' : ''} ${isGroup ? 'group-item' : ''} ${is_vanish_enabled ? 'vanish-mode' : ''}`}
      onClick={onClick}
    >
      <div className="chat-avatar-container">
        <img
          src={avatar || (isGroup ? "/group-avatar.png" : "/default-avatar.png")}
          alt={name || 'User'}
          className="chat-avatar"
          onError={(e) => {
            e.target.src = isGroup ? "https://ionicframework.com/docs/img/demos/avatar.svg" : "https://ionicframework.com/docs/img/demos/avatar.svg";
          }}
        />
        {is_online && !isGroup && <span className="online-dot"></span>}
        {isGroup && (
          <span className="group-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </span>
        )}
      </div>

      <div className="chat-info">
        <div className="chat-header-row">
          <div className="chat-name">
            {isGroup && (
              <span className="group-indicator" title="Group Chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="group-icon">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                </svg>
              </span>
            )}
            {name || 'Unknown'}
            {is_vanish_enabled && (
              <Timer size={14} className="vanish-icon" />
            )}
          </div>
          <span className="chat-time">
            {displayTime}
          </span>
        </div>

        <div className="chat-footer-row">
          <p className="chat-last-message">
            {messagePrefix}
            {lastMessage}
          </p>

          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatListItem;
