import React, { useState, useRef } from 'react';
import { supabase } from '../../utils/supabase';
import MediaMessage from './MediaMessage';
import {
  Calendar,
  Check,
  CheckCheck,
  MoreVertical,
  Reply,
  Copy,
  Share2,
  Edit,
  Trash2,
  Newspaper,
  Bell,
  Clock,
  MapPin,
} from 'lucide-react';

const MessageItem = ({
  message,
  currentUser,
  isSelected,
  isSelectionMode,
  onSelect,
  onReply,
  onDelete,
  onMediaView,
  onMediaDownload,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const bubbleRef = useRef(null);
  const messageRef = useRef(null);

  const isSent = message.sender_id === currentUser.id;
  const isReplied = message.reply_to;

  const handleLongPress = (e) => {
    e.preventDefault();
    if (!isSelectionMode) {
      onSelect();
    }
  };

  const handleClick = () => {
    if (isSelectionMode) {
      onSelect();
    }
  };

  const handleReply = () => {
    onReply(message);
    setShowActions(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setShowActions(false);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handleForward = () => {
    // Copy to clipboard for forwarding
    navigator.clipboard.writeText(`Forwarded message:\n"${message.content}"`);
    setShowActions(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setShowActions(false);
  };

  const saveEdit = async () => {
    if (editContent.trim() && editContent !== message.content) {
      try {
        const { error } = await supabase
          .from('messages')
          .update({
            content: editContent.trim(),
            edited_at: new Date().toISOString(),
          })
          .eq('id', message.id);

        if (error) throw error;

        message.content = editContent.trim();
        message.edited_at = new Date().toISOString();
      } catch (error) {
        console.error('Error editing message:', error);
      }
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
    setShowActions(false);
  };

  const confirmDelete = async () => {
    setShowDeleteModal(false);

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', message.id);

      if (error) throw error;

      // Remove the message from the UI
      if (onDelete) {
        onDelete(message.id);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleTouchStart = (e) => {
    setTouchStartTime(Date.now());
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e) => {
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Check for swipe right (for reply)
    if (
      absDeltaX > 50 &&
      absDeltaX > absDeltaY &&
      deltaX > 0 &&
      !isSelectionMode
    ) {
      handleReply();
      return;
    }

    if (touchDuration > 500 && !isSelectionMode) {
      // Long press
      handleLongPress(e);
    }
  };

  const handleDownload = async (mediaUrl, messageId) => {
    if (onMediaDownload) {
      await onMediaDownload(mediaUrl, messageId);
    }
  };

  const handleView = (mediaUrl, mediaType) => {
    if (onMediaView) {
      onMediaView(mediaUrl, mediaType, message);
    }
  };

  const renderMessageContent = () => {
    let messageContent;

    // Handle different message types
    if (message.message_type === 'news_share') {
      // News share message
      try {
        const newsData = JSON.parse(message.content);
        messageContent = (
          <div
            className="news-share-message"
            onClick={() => window.open(newsData.link, '_blank')}
          >
            <div className="news-share-header">
              <Newspaper size={16} />
              <span>Shared News</span>
            </div>
            <div className="news-share-content">
              <h4>{newsData.title}</h4>
              <p>
                <strong>{newsData.source}</strong>
              </p>
              <div className="news-share-link">Read Full Article →</div>
            </div>
          </div>
        );
      } catch (e) {
        messageContent = <p className="message-text">{message.content}</p>;
      }
    } else if (message.message_type === 'reminder') {
      // Reminder message
      try {
        const reminderData = JSON.parse(message.content);
        if (reminderData.type === 'reminder_request') {
          messageContent = (
            <div className="reminder-message-card">
              <div className="reminder-header">
                <Bell size={16} className="reminder-icon" />
                <span className="reminder-label">REMINDER REQUEST</span>
              </div>
              <div className="reminder-content">
                <h4 className="reminder-title">{reminderData.title}</h4>
                {reminderData.description && (
                  <p className="reminder-description">
                    {reminderData.description}
                  </p>
                )}
                <div className="reminder-details">
                  <div className="reminder-time">
                    <Clock size={16} />
                    {new Date(reminderData.reminder_time).toLocaleString()}
                  </div>
                  {reminderData.location && (
                    <div className="reminder-location">
                      <MapPin size={16} />
                      {reminderData.location}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }
      } catch (e) {
        messageContent = (
          <p>
            <Calendar size={16} /> Reminder message
          </p>
        );
      }
    } else if (
      ['image', 'video', 'audio', 'document'].includes(message.message_type)
    ) {
      // Media message
      messageContent = (
        <MediaMessage
          message={message}
          isSent={isSent}
          onDownload={handleDownload}
          onView={handleView}
        />
      );
    } else {
      // Text message
      messageContent = <p className="message-text">{message.content}</p>;
    }

    return messageContent;
  };

  return (
    <div
      ref={messageRef}
      className={`message ${isSent ? 'sent' : 'received'} ${
        isSelected ? 'selected' : ''
      } ${isReplied ? 'replied' : ''} ${
        message.is_vanished ? 'vanished' : ''
      }`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!isSelectionMode) {
          setShowActions(!showActions);
        }
      }}
    >
      {/* Selection indicator */}
      {isSelectionMode && (
        <div className={`selection-indicator ${isSelected ? 'selected' : ''}`}>
          {isSelected && <span>✓</span>}
        </div>
      )}
      <div className="message-content">
        {/* Message bubble with all content */}
        <div className="message-bubble" ref={bubbleRef}>
          {/* Reply indicator */}
          {isReplied && (
            <div className="replied-message-container">
              <div className="replied-message-header">
                <Reply size={16} />
                <span className="replied-message-user">
                  {isSent ? 'You' : 'Them'}
                </span>
              </div>
              <div className="replied-message-content">
                {/* Would need to fetch replied message content */}
                Replied message
              </div>
            </div>
          )}

          {/* Message content */}
          {isEditing ? (
            <div className="message-edit">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                autoFocus
              />
              <div className="edit-actions">
                <button onClick={saveEdit}>Save</button>
                <button onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            renderMessageContent()
          )}

          {/* Vanish timer */}
          {message.vanish_at && !message.is_vanished && (
            <div className="vanish-timer">
              <Clock size={16} />
              <span>Timer</span>
            </div>
          )}

          {/* Message status for sent messages */}
          {isSent && (
            <span className="message-status">
              {message.is_read ? (
                <CheckCheck size={16} />
              ) : (
                <Check size={16} />
              )}
            </span>
          )}
        </div>

        {/* Timestamp positioned outside bubble */}
        <div className="message-meta">
          <span className="message-time">
            {formatTime(message.created_at)}
            {message.edited_at && ' (edited)'}
          </span>
        </div>

        {/* Message actions dropdown */}
        {showActions && !isSelectionMode && (
          <div className="message-actions">
            <button className="message-arrow-btn">
              <MoreVertical size={16} />
            </button>
            <div className="message-dropdown">
              <div className="message-option" onClick={handleReply}>
                <Reply size={16} className="icon" /> Reply
              </div>
              <div className="message-option" onClick={handleCopy}>
                <Copy size={16} className="icon" /> Copy
              </div>
              <div className="message-option" onClick={handleForward}>
                <Share2 size={16} className="icon" /> Forward
              </div>
              {isSent && (
                <>
                  <div className="message-option" onClick={handleEdit}>
                    <Edit size={16} className="icon" /> Edit
                  </div>
                  <div className="message-option danger" onClick={handleDelete}>
                    <Trash2 size={16} className="icon" /> Delete
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="delete-modal-overlay" onClick={cancelDelete}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>Delete Message</h3>
            </div>
            <div className="delete-modal-body">
              <p>Are you sure you want to delete this message? This action cannot be undone.</p>
            </div>
            <div className="delete-modal-actions">
              <button
                className="delete-cancel-btn"
                onClick={cancelDelete}
                style={{ padding: '10px 20px', marginRight: '10px' }}
              >
                Cancel
              </button>
              <button
                className="delete-confirm-btn"
                onClick={confirmDelete}
                style={{ padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageItem;