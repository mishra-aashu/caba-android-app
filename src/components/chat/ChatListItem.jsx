import React from 'react';
import { IonIcon } from '@ionic/react';
import { checkmarkDoneOutline, checkmarkOutline, micOutline, imageOutline } from 'ionicons/icons';
import { formatLastSeen } from '../../utils/timeUtils';
import '../../styles/ChatListItem.css'; // Adjust path as necessary

const ChatListItem = ({ chat, onClick, isActive }) => {
  // Props destructuring (Aapka Supabase data yahan aayega)
  const { name, avatar, lastMessage, time, unreadCount, isMyMessage, status, type, is_online, last_seen } = chat;

  return (
    <div
      className={`chat-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >

      {/* 1. Avatar Container */}
      <div className="chat-avatar-container">
        <img src={avatar || "https://ionicframework.com/docs/img/demos/avatar.svg"} alt="dp" className="chat-avatar" />
        {/* Online Status Dot */}
        {is_online && <span className="online-dot"></span>}
      </div>

      {/* 2. Text Info (Name + Message) */}
      <div className="chat-info">

        <div className="chat-header-row">
          <div className="chat-name">{name}</div>
          <span className="chat-time">
            {is_online ? 'Online' : (last_seen ? formatLastSeen(last_seen) : time)}
          </span>
        </div>

        <div className="chat-footer-row">
          <p className="chat-last-message">
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
