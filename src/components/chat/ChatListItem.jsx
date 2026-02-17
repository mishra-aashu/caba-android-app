import React from 'react';
import { formatLastSeen } from '../../utils/timeUtils';
import '../../styles/ChatListItem.css';

const ChatListItem = ({ chat, onClick, isActive }) => {
  // Props destructuring (Aapka Supabase data yahan aayega)
  const { name, avatar, lastMessage, time, unreadCount, isMyMessage, status, type, is_online, last_seen, isGroup, member_count, member_preview } = chat;

  return (
    <div
      className={`chat-item ${isActive ? 'active' : ''} ${isGroup ? 'group-item' : ''}`}
      onClick={onClick}
    >

      {/* 1. Avatar Container */}
      <div className="chat-avatar-container">
        <img src={avatar || "https://ionicframework.com/docs/img/demos/avatar.svg"} alt="dp" className="chat-avatar" />
        {/* Online Status Dot - Only show for non-group chats */}
        {is_online && !isGroup && <span className="online-dot"></span>}
        {/* Group indicator badge */}
        {isGroup && (
          <span className="group-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </span>
        )}
      </div>

      {/* 2. Text Info (Name + Message) */}
      <div className="chat-info">

        <div className="chat-header-row">
          <div className="chat-name">
            {isGroup && (
              <span className="group-indicator" title="Group Chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="group-icon">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
              </span>
            )}
            {name}
          </div>
          <span className="chat-time">
            {is_online && !isGroup ? 'Online' : (last_seen ? formatLastSeen(last_seen) : time)}
          </span>
        </div>

        <div className="chat-footer-row">
          <p className="chat-last-message">
            {isGroup && member_preview && member_preview.length > 0 && (
              <span className="member-preview">
                {member_preview.slice(0, 2).map((m, i) => (
                  <span key={i} className="preview-name">{m.name}{i < Math.min(member_preview.length, 2) - 1 ? ', ' : ''}</span>
                ))}
                {member_preview.length > 2 && <span className="more-members"> +{member_preview.length - 2}</span>}:
              </span>
            )}
            {lastMessage}
          </p>

          {/* Optional: Unread Count Badge */}
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </div>

      </div>

    </div>
  );
};

export default ChatListItem;
