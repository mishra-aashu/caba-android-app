import React from 'react';
import { Timer, Users, User } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchMessagesPage } from '../../hooks/useMessages';
import { formatLastSeen, formatTime } from '../../utils/dateFormatter';
import { useResolveName } from '../../hooks/useResolveName';
import EmojiRenderer from '../common/EmojiRenderer';
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

  const queryClient = useQueryClient();
  const resolvedName = useResolveName(!isGroup ? chat.otherUserId : null, name);

  // ─── AGGRESSIVE PRE-FETCH ──────────────────────────────────────────────────
  // Pre-loading data on 'hover' or 'touch start' (pointer down) ensures that
  // by the time the click is complete and navigation finishes, the data
  // is already in the cache. This is the 'Full Proof' secret to instant feel.
  const handlePrefetch = () => {
    if (chat.id) {
      queryClient.prefetchInfiniteQuery({
        queryKey: ['messages', chat.id],
        queryFn: ({ pageParam }) => fetchMessagesPage({ chatId: chat.id, pageParam }),
        initialPageParam: null,
        staleTime: 1000 * 60 * 5,
      });
    }
  };

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
      onMouseEnter={handlePrefetch}
      onPointerDown={handlePrefetch}
    >
      <div className="chat-avatar-container">
        {isGroup ? (
          <div className="group-avatar-fallback">
            <Users size={24} />
          </div>
        ) : (
          <>
            <img
              src={avatar || "/default-avatar.png"}
              alt={name || 'User'}
              className="chat-avatar"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="avatar-fallback" style={{ display: 'none' }}>
              <User size={24} />
            </div>
          </>
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
            {resolvedName}
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
            <EmojiRenderer text={lastMessage} />
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
