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
  const [editContent, setEditContent] = useState(message.content);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const bubbleRef = useRef(null);
  const messageRef = useRef(null);

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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  const isSent = message.sender_id === currentUser.id;
  const isReplied = message.reply_to;
  const isTouchDevice = window.matchMedia && window.matchMedia('(hover: none)').matches;

  // Sender info for received messages (group chat avatar on left)
  const sender = message.sender || {};
  const senderName = sender.name || sender.username || 'User';
  const senderAvatar = getValidAvatarUrl(sender.avatar || sender.profile_image);
  const senderInitial = senderName.charAt(0).toUpperCase();

  // Current user info for sent messages (group chat avatar on right)
  const myAvatar = getValidAvatarUrl(currentUser?.avatar || currentUser?.profile_image);
  const myName = currentUser?.name || currentUser?.username || 'Me';
  const myInitial = myName.charAt(0).toUpperCase();

  const handleLongPress = (e, touchX, touchY) => {
    e.preventDefault();
    if (!isSelectionMode) {
      const menuHeight = 220;
      const menuWidth = 180;
      const screenH = window.innerHeight;
      const screenW = window.innerWidth;

      let x = touchX || e.clientX;
      let y = touchY || e.clientY;

      const openUpwards = (screenH - y) < menuHeight;
      setIsUpwards(openUpwards);
      if (openUpwards) y = y - menuHeight;
      if ((screenW - x) < menuWidth) x = x - menuWidth;

      setMenuPos({ x, y });
      setShowActions(true);
    }
  };

  const handleClick = () => {
    if (isSelectionMode) onSelect();
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
          .update({ content: editContent.trim(), edited_at: new Date().toISOString() })
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

    // Trigger particle effect locally for instant feedback
    const element = document.getElementById(`message-${message.id}`);
    if (element) {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const color = isSent ? '#7c3aed' : '#555555';

      import('../../utils/particleManager').then(m => {
        m.default.spawn(x, y, color, rect.width, rect.height);
      });
    }

    if (onDelete) onDelete(message.id);
    try {
      const { error } = await supabase.from('messages').delete().eq('id', message.id);
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
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: currentUser.id,
        reported_id: message.sender_id,
        reason: reportReason,
        details: `Reported message (ID: ${message.id}): "${message.content?.slice(0, 100)}"`
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

    // Swipe right → reply
    if (absDeltaX > 50 && absDeltaX > absDeltaY * 1.5 && deltaX > 0 && !isSelectionMode) {
      onReply && onReply(message);
      return;
    }

    // Long press → context menu
    if (touchDuration > 500 && absDeltaX < 10 && absDeltaY < 10) {
      handleLongPress(e, touchEndX, touchEndY);
    }
  };

  const handleSenderAvatarClick = (e) => {
    e.stopPropagation();
    if (onSenderClick && message.sender_id) {
      onSenderClick(message.sender_id);
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
        sender={message.sender}
        message={message}
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
        id={`message-${message.id}`}
        className={`message-item ${isSent ? 'sent' : 'received'} ${isSelected ? 'selected' : ''} ${showActions ? 'highlighted' : ''} ${isGroupChat ? 'group-message' : ''} ${message.isDeleting ? 'is-deleting' : ''}`}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          if (!isTouchDevice) {
            e.preventDefault();
            if (!isSelectionMode) {
              const menuHeight = 220;
              const menuWidth = 180;
              const screenH = window.innerHeight;
              const screenW = window.innerWidth;

              let x = e.clientX;
              let y = e.clientY;

              const openUpwards = (screenH - y) < menuHeight;
              setIsUpwards(openUpwards);
              if (openUpwards) y = y - menuHeight;
              if ((screenW - x) < menuWidth) x = x - menuWidth;

              setMenuPos({ x, y });
              setShowActions(true);
            }
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
              onSenderClick && onSenderClick(currentUser.id);
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
              <option value="hate_speech">Hate Speech</option>
              <option value="inappropriate_content">Inappropriate Content</option>
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