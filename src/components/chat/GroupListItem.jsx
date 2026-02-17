/**
 * GroupListItem - Special ChatListItem for Groups
 * Shows group avatar, member names preview instead of user info
 */

import React from 'react';
import { Users } from 'lucide-react';
import { getInitials } from '../../utils/stringUtils';
import { isUserOnline } from '../../utils/timeUtils';

const GroupListItem = ({ group, onClick, isActive }) => {
  // Get member preview text - "Sender: Message" format
  const getMemberPreview = () => {
    if (!group.last_message) return 'No messages yet';
    
    // For group messages, show sender name + message
    // Format: "Amit: Chalo kal milte hai"
    const message = group.last_message.length > 30 
      ? group.last_message.substring(0, 30) + '...' 
      : group.last_message;
    
    return message;
  };

  // Get member count text
  const getMemberCountText = () => {
    const count = group.member_count || 2;
    return `${count} ${count === 1 ? 'member' : 'members'}`;
  };

  // Format time
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }
  };

  // Get initials from group name
  const getGroupInitials = () => {
    if (!group.name) return 'G';
    const words = group.name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return group.name.substring(0, 2).toUpperCase();
  };

  return (
    <div 
      className={`chat-item-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      {/* Group Avatar */}
      <div className="chat-item-avatar">
        {group.avatar_url ? (
          <img 
            src={group.avatar_url} 
            alt={group.name}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className="avatar-placeholder"
          style={{ 
            display: group.avatar_url ? 'none' : 'flex',
            background: 'linear-gradient(135deg, #25d366, #128c7e)'
          }}
        >
          <Users size={20} color="white" />
        </div>
        
        {/* Online indicator - groups don't have online status, but we can show member count */}
        {group.unreadCount > 0 && (
          <span className="unread-count">{group.unreadCount}</span>
        )}
      </div>

      {/* Chat Info */}
      <div className="chat-item-info">
        <div className="chat-item-header">
          <span className="chat-item-name">{group.name || 'Unnamed Group'}</span>
          <span className="chat-item-time">
            {formatTime(group.last_message_time)}
          </span>
        </div>
        
        <div className="chat-item-preview">
          {/* Show member count for groups */}
          <span className="member-count-badge">
            <Users size={12} />
            {getMemberCountText()}
          </span>
          <span className="chat-item-message">
            {getMemberPreview()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GroupListItem;
