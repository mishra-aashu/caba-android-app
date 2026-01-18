import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import MediaMessage from './MediaMessage';
import VoiceMessage from './VoiceMessage';
import {
  Calendar,
  Check,
  CheckCheck,
  MoreVertical,
  Newspaper,
  Bell,
  Clock,
  MapPin,
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import DesktopContextMenu from './DesktopContextMenu';

const MessageItem = ({
  message,
  repliedMsg,
  currentUser,
  isSelected,
  isSelectionMode,
  onSelect,
  onReply,
  onForward,
  onDelete,
  onMediaView,
  onMediaDownload,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const bubbleRef = useRef(null);
  const messageRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showActions) {
        // Don't close if clicking on the message item or context menu
        const isClickOnMessage = messageRef.current && messageRef.current.contains(e.target);
        const isClickOnContextMenu = e.target.closest('.context-menu');

        if (!isClickOnMessage && !isClickOnContextMenu) {
          setShowActions(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  const isSent = message.sender_id === currentUser.id;
  const isReplied = message.reply_to;
  // Better touch device detection - check if device primarily uses touch
  const isTouchDevice = window.matchMedia && window.matchMedia('(hover: none)').matches;

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
    onForward(message);
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

  const handleDelete = async () => {
    setShowActions(false);
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', message.id);

      if (error) throw error;

      // Remove the message from the UI instantly
      if (onDelete) {
        onDelete(message.id);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
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
    if (message.media_path && (message.media_type === 'image' || message.media_type === 'video')) {
      return (
        <MediaMessage
          message={message}
          repliedMsg={repliedMsg}
          currentUserId={currentUser?.id}
          isSender={isSent}
          time={formatTime(message.created_at)}
          status={message.is_read ? 'read' : 'sent'}
        />
      );
    }

    if (message.media_path && message.media_type === 'voice') {
      return (
        <VoiceMessage
          message={message}
          repliedMsg={repliedMsg}
          currentUserId={currentUser?.id}
          isSender={isSent}
          time={formatTime(message.created_at)}
          status={message.is_read ? 'read' : 'sent'}
        />
      );
    }

    // Fallback for text messages or other types
    return (
      <MessageBubble
        text={message.content}
        repliedMsg={repliedMsg}
        currentUserId={currentUser?.id}
        time={formatTime(message.created_at)}
        isMine={isSent}
        isDeleted={message.is_deleted}
        status={message.is_read ? 'read' : 'sent'}
        edited={!!message.edited_at}
      />
    );
  };

  return (
    <>
      <div
        ref={messageRef}
        id={`message-${message.id}`}
        className={`message-item ${isSent ? 'sent' : 'received'} ${
          isSelected ? 'selected' : ''
        } ${showActions ? 'highlighted' : ''}`}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          // Only show context menu on desktop (non-touch devices)
          if (!isTouchDevice) {
            e.preventDefault();
            if (!isSelectionMode) {
              setMenuPos({ x: e.clientX, y: e.clientY });
              setShowActions(true);
            }
          }
        }}
      >
        <div className="message-content-wrapper">
          {renderMessageContent()}
        </div>
      </div>

      {/* Desktop Context Menu - Rendered outside message item to avoid click conflicts */}
      <DesktopContextMenu
        position={menuPos}
        isVisible={showActions && !isSelectionMode && !isTouchDevice}
        onReply={handleReply}
        onCopy={handleCopy}
        onForward={handleForward}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSelect={onSelect}
        isSent={isSent}
        onClose={() => setShowActions(false)}
      />
    </>
  );
};

export default MessageItem;