import React from 'react';
import { IonIcon } from '@ionic/react';
import { checkmarkDoneOutline, checkmarkOutline, micOutline, imageOutline } from 'ionicons/icons';
import '../../styles/ChatListItem.css'; // Adjust path as necessary

const ChatListItem = ({ chat, onClick }) => {
  // Props destructuring (Aapka Supabase data yahan aayega)
  const { name, avatar, lastMessage, time, unreadCount, isMyMessage, status, type } = chat;

  // Icon Logic Helper
  const getStatusIcon = () => {
    if (!isMyMessage) return null;
    if (status === 'read') return <IonIcon icon={checkmarkDoneOutline} className="msg-status-icon status-blue" />;
    if (status === 'delivered') return <IonIcon icon={checkmarkDoneOutline} className="msg-status-icon status-grey" />;
    return <IonIcon icon={checkmarkOutline} className="msg-status-icon status-grey" />;
  };

  return (
    <div className="chat-item" onClick={onClick}>
      
      {/* 1. LEFT: AVATAR */}
      <div className="chat-avatar">
        <img 
          src={avatar || "https://ionicframework.com/docs/img/demos/avatar.svg"} 
          alt={name} 
        />
      </div>

      {/* 2. RIGHT: CONTENT (Border iske neeche aayegi) */}
      <div className="chat-info">
        
        {/* Top Row: Name & Time */}
        <div className="chat-header">
          <span className="chat-name">{name}</span>
          <span className={`chat-time ${unreadCount > 0 ? 'active' : ''}`}>
            {time}
          </span>
        </div>

        {/* Bottom Row: Message & Badge */}
        <div className="chat-footer">
          
          <div className="last-message-container">
            {/* Status Icon (Blue Ticks) */}
            {getStatusIcon()}

            {/* Message Type Icon (Agar Photo/Audio hai) */}
            {type === 'image' && <IonIcon icon={imageOutline} style={{marginRight: 4, color: '#667781'}} />}
            {type === 'audio' && <IonIcon icon={micOutline} style={{marginRight: 4, color: '#667781'}} />}

            {/* The Text */}
            <span className="last-message">
              {type === 'image' ? 'Photo' : type === 'audio' ? 'Voice Message' : lastMessage}
            </span>
          </div>

          {/* Unread Badge (Sirf tab dikhega jab count > 0) */}
          {unreadCount > 0 && (
            <div className="unread-badge">
              {unreadCount}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};

export default ChatListItem;
