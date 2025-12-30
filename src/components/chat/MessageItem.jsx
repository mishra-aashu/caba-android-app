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
import MessageBubble from './MessageBubble';

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

  const renderMessageContentForBubble = () => {
    if (message.is_deleted) {
      return "You deleted this message";
    }

    if (message.message_type === 'news_share') {
      try {
        const newsData = JSON.parse(message.content);
        return `Shared News: ${newsData.title} (${newsData.source})`;
      } catch (e) {
        return message.content;
      }
    } else if (message.message_type === 'reminder') {
      try {
        const reminderData = JSON.parse(message.content);
        if (reminderData.type === 'reminder_request') {
          return `Reminder: ${reminderData.title}`;
        }
      } catch (e) {
        return message.content;
      }
    } else if (
      ['image', 'video', 'audio', 'document'].includes(message.message_type)
    ) {
      // For media, MessageBubble will just show the content string (e.g., "Image")
      // The actual MediaMessage component will need to be rendered within MessageBubble's text slot or separately
      // For now, return a placeholder string. We'll refine this later.
      return `[${message.message_type.charAt(0).toUpperCase() + message.message_type.slice(1)}]`;
    } else {
      // Text message
      return message.content;
    }
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

      {/* Main message bubble component */}
      <MessageBubble
        text={renderMessageContentForBubble()}
        time={formatTime(message.created_at)}
        isMine={isSent}
        isDeleted={message.is_deleted} // Assuming message has an is_deleted prop
      />

      {/* Message actions dropdown - keep outside MessageBubble for now */}
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