import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import MediaMessage from './MediaMessage';
import VoiceMessage from './VoiceMessage';
import { getValidAvatarUrl } from '../../utils/avatarUtils';
import {
  Calendar,
  Check,
  CheckCheck,
  MoreVertical,
  Newspaper,
  Bell,
  Clock,
  MapPin,
  Play,
  XCircle,
  CheckCircle,
  Send,
  UserCheck,
  UserX
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import DesktopContextMenu from './DesktopContextMenu';
import toast from 'react-hot-toast';

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
  onAcceptGame,
  onRejectGame,
  isGroupChat,
  onSenderClick,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [isUpwards, setIsUpwards] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message?.content ?? '');
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const bubbleRef = useRef(null);
  const messageRef = useRef(null);

  // Move these declarations before useEffect to fix initialization error
  const safeMessage = message ?? {};
  const isSent = (safeMessage.senderId || safeMessage.sender_id) === currentUser?.id;
  const isReplied = !!(safeMessage.replyTo || safeMessage.reply_to);
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showActions) {
        const isClickOnMessage = messageRef.current && messageRef.current.contains(e.target);
        const isClickOnContextMenu = e.target.closest('.context-menu');
        if (!isClickOnMessage && !isClickOnContextMenu) {
          setShowActions(false);
        }
      }
    };

    const handleEditTrigger = (e) => {
      if (e.detail.messageId === safeMessage.id && isSent) {
        handleEdit();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    messageRef.current?.addEventListener('triggerEdit', handleEditTrigger);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      messageRef.current?.removeEventListener('triggerEdit', handleEditTrigger);
    };
  }, [showActions, safeMessage.id, isSent]);

  const sender = safeMessage.sender ?? {};
  const senderName = sender.name || sender.username || 'User';
  const senderAvatar = getValidAvatarUrl(sender.avatar || sender.profile_image || sender.profileImage);
  const senderInitial = (senderName || 'U').charAt(0).toUpperCase();

  const myAvatar = getValidAvatarUrl(currentUser?.avatar || currentUser?.profile_image);
  const myName = currentUser?.name || currentUser?.username || 'Me';
  const myInitial = (myName || 'M').charAt(0).toUpperCase();

  const MENU_H = 220;
  const MENU_W = 180;
  const openContextMenu = (clientX, clientY) => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    let x = clientX;
    let y = clientY;
    const openUpwards = (screenH - y) < MENU_H;
    setIsUpwards(openUpwards);
    if (openUpwards) y -= MENU_H;
    if (screenW - x < MENU_W) x -= MENU_W;
    setMenuPos({ x, y });
    setShowActions(true);
  };

  const handleLongPress = (e, touchX, touchY) => {
    e.preventDefault();
    if (!isSelectionMode) openContextMenu(touchX ?? e.clientX, touchY ?? e.clientY);
  };

  const handleClick = () => {
    if (isSelectionMode) onSelect();
  };

  const handleReply = () => {
    onReply(safeMessage);
    setShowActions(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(safeMessage.content ?? '');
      setShowActions(false);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handleForward = () => {
    onForward(safeMessage);
    setShowActions(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setShowActions(false);
  };

  const saveEdit = async () => {
    if (editContent.trim() && editContent !== (safeMessage.content ?? '')) {
      try {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('messages')
          .update({
            content: editContent.trim(),
            updated_at: now
          })
          .eq('id', safeMessage.id);
        if (error) throw error;

        // Update the local message object to reflect the change immediately
        safeMessage.content = editContent.trim();
        if (safeMessage.updatedAt) safeMessage.updatedAt = now;
        if (safeMessage.updated_at) safeMessage.updated_at = now;
        safeMessage.isEdited = true;
        safeMessage.is_edited = true;

        // Force re-render by updating the parent component's state
        // This will trigger the realtime update and show the "edited" indicator
        if (window.updateMessageInChat) {
          window.updateMessageInChat(safeMessage.id, {
            content: editContent.trim(),
            updated_at: now
          });
        }

        toast.success('Message edited successfully');
      } catch (error) {
        console.error('Error editing message:', error);
        toast.error('Failed to edit message');
      }
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditContent(message?.content ?? '');
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setShowActions(false);

    // Trigger particle effect locally for instant feedback
    const element = document.getElementById(`message-${safeMessage.id}`);
    if (element) {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const color = isSent ? '#7c3aed' : '#555555';

      import('../../utils/particleManager').then(m => {
        m.default.spawn(x, y, color, rect.width, rect.height);
      });
    }

    if (onDelete) onDelete(safeMessage.id);
    try {
      const { error } = await supabase.from('messages').delete().eq('id', safeMessage.id);
      if (error) throw error;
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) {
      toast.error('Please select a reason');
      return;
    }
    const validReasons = ['spam', 'harassment', 'inappropriate', 'other'];
    const reason = validReasons.includes(reportReason) ? reportReason : 'other';
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: currentUser?.id,
        reported_id: safeMessage.senderId || safeMessage.sender_id,
        reason,
        details: `Reported message (ID: ${safeMessage.id}): "${(safeMessage.content ?? '').slice(0, 100)}"`
      });
      if (error) throw error;
      toast.success('Report submitted');
    } catch (err) {
      console.error('Error submitting report:', err);
      toast.error('Failed to submit report');
    }
    setShowReportModal(false);
    setReportReason('');
  };

  const formatTime = (timestamp) => {
    try {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
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

    if (absDeltaX > 50 && absDeltaX > absDeltaY * 1.5 && deltaX > 0 && !isSelectionMode) {
      onReply?.(safeMessage);
      return;
    }

    if (touchDuration > 500 && absDeltaX < 10 && absDeltaY < 10) {
      handleLongPress(e, touchEndX, touchEndY);
    }
  };

  const handleSenderAvatarClick = (e) => {
    e.stopPropagation();
    const senderId = safeMessage.senderId || safeMessage.sender_id;
    if (onSenderClick && currentUser?.id != null && senderId) {
      onSenderClick(senderId);
    }
  };

  const renderMessageContent = () => {
    if (isEditing) {
      return (
        <div className="message-edit-container">
          <textarea
            ref={(textarea) => {
              if (textarea) {
                // Auto-resize textarea
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
              }
            }}
            className="message-edit-input"
            value={editContent}
            onChange={(e) => {
              setEditContent(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveEdit();
              } else if (e.key === 'Escape') {
                cancelEdit();
              }
            }}
            autoFocus
            rows={1}
            style={{
              resize: 'none',
              minHeight: '30px',
              maxHeight: '120px',
              overflowY: 'auto'
            }}
          />
          <div className="message-edit-actions">
            <button
              className="edit-cancel-btn"
              onClick={cancelEdit}
              title="Cancel (Esc)"
            >
              ✕
            </button>
            <button
              className="edit-save-btn"
              onClick={saveEdit}
              title="Save (Enter)"
              disabled={!editContent.trim() || editContent === (safeMessage.content ?? '')}
            >
              ✓
            </button>
          </div>
        </div>
      );
    }

    const mediaPath = safeMessage.mediaPath || safeMessage.media_path;
    const mediaType = safeMessage.mediaType || safeMessage.media_type;
    const isRead = safeMessage.isRead || safeMessage.is_read;

    if (mediaPath && (mediaType === 'image' || mediaType === 'video')) {
      return (
        <MediaMessage
          message={safeMessage}
          repliedMsg={repliedMsg}
          currentUserId={currentUser?.id}
          isSender={isSent}
          time={formatTime(safeMessage.createdAt || safeMessage.created_at)}
          status={isRead ? 'read' : 'sent'}
        />
      );
    }

    if (mediaPath && (mediaType === 'voice' || mediaType === 'audio')) {
      return (
        <VoiceMessage
          message={safeMessage}
          repliedMsg={repliedMsg}
          currentUserId={currentUser?.id}
          isSender={isSent}
          time={formatTime(safeMessage.createdAt || safeMessage.created_at)}
          status={isRead ? 'read' : 'sent'}
        />
      );
    }

    return (
      <MessageBubble
        text={safeMessage.content ?? ''}
        repliedMsg={repliedMsg}
        currentUserId={currentUser?.id}
        time={formatTime(safeMessage.createdAt || safeMessage.created_at)}
        isMine={isSent}
        isDeleted={safeMessage.isDeleted || safeMessage.is_deleted}
        status={isRead ? 'read' : 'sent'}
        edited={!!(safeMessage.updatedAt || safeMessage.updated_at)}
        sender={safeMessage.sender}
        message={safeMessage} // Pass the full message object with timestamps
      />
    );
  };

  // In groups: received messages show sender avatar on left, sent messages show own avatar on right
  const showReceivedAvatar = isGroupChat && !isSent;
  const showSentAvatar = isGroupChat && isSent;

  return (
    <>
      <div
        ref={messageRef}
        id={`message-${safeMessage.id}`}
        className={`message-item ${isSent ? 'sent' : 'received'} ${isSelected ? 'selected' : ''} ${showActions ? 'highlighted' : ''} ${isGroupChat ? 'group-message' : ''} ${safeMessage.isDeleting ? 'is-deleting' : ''}`}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          if (!isTouchDevice) {
            e.preventDefault();
            if (!isSelectionMode) openContextMenu(e.clientX, e.clientY);
          }
        }}
      >
        {/* LEFT avatar — received group messages */}
        {showReceivedAvatar && (
          <button
            className="group-sender-avatar"
            onClick={handleSenderAvatarClick}
            title={`View ${senderName}'s profile`}
            aria-label={`View ${senderName}'s profile`}
          >
            {senderAvatar ? (
              <img
                src={senderAvatar}
                alt={senderName}
                className="group-sender-avatar-img"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement.querySelector('.group-sender-avatar-initial').style.display = 'flex';
                }}
              />
            ) : null}
            <span
              className="group-sender-avatar-initial"
              style={{ display: senderAvatar ? 'none' : 'flex' }}
            >
              {senderInitial}
            </span>
          </button>
        )}

        <div className={`message-content-wrapper ${isGroupChat ? 'with-avatar' : ''}`}>
          {/* Sender name — received group messages only */}
          {showReceivedAvatar && (
            <button className="group-sender-name" onClick={handleSenderAvatarClick}>
              {senderName}
            </button>
          )}
          {renderMessageContent()}
        </div>

        {/* RIGHT avatar — sent group messages (own DP) */}
        {showSentAvatar && (
          <button
            className="group-sender-avatar group-sender-avatar--self"
            onClick={(e) => {
              e.stopPropagation();
              if (currentUser?.id != null) onSenderClick?.(currentUser.id);
            }}
            title="View your profile"
            aria-label="View your profile"
          >
            {myAvatar ? (
              <img
                src={myAvatar}
                alt={myName}
                className="group-sender-avatar-img"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const initial = parent.querySelector('.group-sender-avatar-initial');
                    if (initial) initial.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <span
              className="group-sender-avatar-initial"
              style={{ display: myAvatar ? 'none' : 'flex' }}
            >
              {myInitial}
            </span>
          </button>
        )}
      </div>

      {showActions && !isSelectionMode && (
        <div className="menu-overlay" onClick={() => setShowActions(false)} />
      )}

      <DesktopContextMenu
        position={menuPos}
        isVisible={showActions && !isSelectionMode}
        isUpwards={isUpwards}
        onReply={handleReply}
        onCopy={handleCopy}
        onForward={handleForward}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSelect={onSelect}
        onReport={!isSent ? () => { setShowActions(false); setShowReportModal(true); } : undefined}
        isSent={isSent}
        onClose={() => setShowActions(false)}
      />

      {showReportModal && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Report Message</h4>
            <p>Choose a reason for your report:</p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="report-select"
            >
              <option value="">Select a reason...</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="inappropriate">Inappropriate</option>
              <option value="other">Other</option>
            </select>
            <div className="report-modal-actions">
              <button className="btn-cancel" onClick={() => setShowReportModal(false)}>Cancel</button>
              <button className="btn-report" onClick={handleReport}>Submit Report</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageItem;