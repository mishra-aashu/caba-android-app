import React, { useState, useRef, useEffect, memo } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../hooks/useAuth';
import MediaMessage from './MediaMessage';
import VoiceMessage from './VoiceMessage';
import { useToggleReaction } from '../../hooks/useToggleReaction';
import ReactionPicker from './ReactionPicker';
import { getValidAvatarUrl } from '../../utils/avatarUtils';
import { formatBubbleTime } from '../../utils/dateFormatter';
import { useResolveName } from '../../hooks/useResolveName';
import {
  Check,
  CheckCheck,
  Reply,
  Heart,
  Gamepad2
} from 'lucide-react';
import { motion, useAnimation, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import MessageBubble from './MessageBubble';
import DesktopContextMenu from './DesktopContextMenu';
import toast from 'react-hot-toast';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';

const MessageItem = ({
  message,
  repliedMsg,
  currentUser,
  isSelected,
  isSelectionMode,
  onSelect,
  onReply,
  onForward,
  onMediaView,
  onMediaDownload,
  onAcceptGame,
  onRejectGame,
  onJoinGame,
  onDelete,
  isGroupChat,
  onSenderClick,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const senderId = message?.senderId || message?.sender_id;
  const resolvedSenderName = useResolveName(isGroupChat && currentUser?.id !== senderId ? senderId : null, message?.sender?.name || 'User');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message?.content ?? '');
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionPickerPos, setReactionPickerPos] = useState({ x: 0, y: 0 });
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const bubbleRef = useRef(null);
  const messageRef = useRef(null);
  const dragConstraintsRef = useRef(null);
  const dragX = useMotionValue(0);

  const safeMessage = message ?? {};
  const { mutate: toggleReaction } = useToggleReaction(safeMessage.chat_id || safeMessage.chatId);
  const { preferredEmojis, emojiStyle } = useEmojiStyle();

  useEffect(() => {
    window.handleReactionToggle = (messageId, emoji) => {
      toggleReaction({ messageId, userId: currentUser?.id, reaction: emoji });
    };
  }, [toggleReaction, currentUser?.id]);

  // Animation controls for desktop highlight animation
  const highlightControls = useAnimation();

  // Detect touch device for swipe functionality
  const isTouchDevice = typeof window !== 'undefined' &&
    (window.matchMedia?.('(hover: none)').matches || 'ontouchstart' in window);

  // Check if we're on mobile (smaller screen) for swipe to reply
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const isSent = (safeMessage.senderId || safeMessage.sender_id) === currentUser?.id;
  const isReplied = !!(safeMessage.replyTo || safeMessage.reply_to);
  const isDeleted = safeMessage.isDeleted || safeMessage.is_deleted;

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

    const handleExternalEdit = () => {
      if (isSent) handleEdit();
    };

    document.addEventListener('mousedown', handleClickOutside);
    messageRef.current?.addEventListener('triggerEdit', handleEditTrigger);
    window.addEventListener(`triggerEdit-${safeMessage.id}`, handleExternalEdit);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      messageRef.current?.removeEventListener('triggerEdit', handleEditTrigger);
      window.removeEventListener(`triggerEdit-${safeMessage.id}`, handleExternalEdit);
    };
  }, [showActions, safeMessage.id, isSent]);

  const sender = safeMessage.sender ?? {};
  // Support both standardized (full_name/avatar_url) and legacy (name/avatar) field names
  const senderName = isGroupChat && !isSent ? resolvedSenderName : (sender.full_name || sender.name || sender.username || 'User');
  const senderAvatar = getValidAvatarUrl(sender.avatar_url || sender.avatar || sender.profile_image || sender.profileImage);
  const senderInitial = (senderName || 'U').charAt(0).toUpperCase();

  const openContextMenu = (clientX, clientY) => {
    setMenuPos({ x: clientX, y: clientY });
    setShowActions(true);
  };

  const handleLongPress = (e, touchX, touchY) => {
    e.preventDefault();
    if (isSelectionMode) return;

    // Show reaction picker above the message
    const rect = bubbleRef.current?.getBoundingClientRect() || messageRef.current?.getBoundingClientRect();
    if (rect) {
      setReactionPickerPos({
        x: rect.left + rect.width / 2,
        y: rect.top
      });
      setShowReactionPicker(true);
    }

    // Also show context menu
    openContextMenu(touchX ?? e.clientX, touchY ?? e.clientY);
  };

  const handleClick = (e) => {
    if (isSelectionMode) {
      onSelect();
      return;
    }

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (!isDeleted) {
        handleReactionSelect('❤️');
        setShowHeartPop(true);
        setTimeout(() => setShowHeartPop(false), 1000);
      }
      setLastTap(0);
    } else {
      setLastTap(now);
    }
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

        // Force re-render by updating the parent component's state
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

  const handleDelete = () => {
    setShowActions(false);
    if (onDelete) onDelete(safeMessage.id);
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

  const handleReactionSelect = (reaction) => {
    toggleReaction({
      messageId: safeMessage.id,
      userId: currentUser?.id,
      reaction
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

    if (absDeltaX > 50 && absDeltaX > absDeltaY * 1.5 && !isSelectionMode) {
      if (isSent) {
        if (deltaX < 0) {
          onReply?.(safeMessage);
          return;
        }
      } else {
        if (deltaX > 0) {
          onReply?.(safeMessage);
          return;
        }
      }
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
            className="message-edit-input"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
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
            <button className="edit-cancel-btn" onClick={cancelEdit}>✕</button>
            <button className="edit-save-btn" onClick={saveEdit}>✓</button>
          </div>
        </div>
      );
    }

    const mediaPath = safeMessage.mediaPath || safeMessage.media_path;
    const mediaType = safeMessage.mediaType || safeMessage.media_type;
    const isRead = safeMessage.isRead || safeMessage.is_read;

    if (isDeleted) {
      return (
        <MessageBubble
          text="This message was deleted"
          repliedMsg={repliedMsg}
          currentUserId={currentUser?.id}
          time={formatBubbleTime(safeMessage.createdAt || safeMessage.created_at)}
          isMine={isSent}
          isDeleted={true}
          status={isRead ? 'read' : 'sent'}
          sender={safeMessage.sender}
          message={safeMessage}
        />
      );
    }

    if (mediaPath && (mediaType === 'image' || mediaType === 'video')) {
      return (
        <MediaMessage
          message={safeMessage}
          repliedMsg={repliedMsg}
          currentUserId={currentUser?.id}
          isSender={isSent}
          time={formatBubbleTime(safeMessage.createdAt || safeMessage.created_at)}
          status={isRead ? 'read' : 'sent'}
          onMediaClick={(url, msg) => onMediaView?.(url, mediaType, msg)}
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
          time={formatBubbleTime(safeMessage.createdAt || safeMessage.created_at)}
          status={isRead ? 'read' : 'sent'}
        />
      );
    }

    const msgType = safeMessage.messageType || safeMessage.message_type;
    if (msgType === 'game_invite') {
      const status = safeMessage.metadata?.status;
      const isPending = status === 'pending';
      const isReceiver = (safeMessage.receiverId || safeMessage.receiver_id) === currentUser?.id;

      return (
        <div className={`game-invite-card ${isSent ? 'sent' : 'received'}`}>
          <div className="invite-header">
            <Gamepad2 size={24} className="invite-icon" />
            <span className="invite-title">BATTLE ARENA</span>
          </div>
          <div className="invite-body">
            <h3>Truth or Dare</h3>
            <p>{safeMessage.content}</p>
          </div>
          <div className="invite-actions">
            {isReceiver && isPending ? (
              <>
                <button
                  className="game-accept-btn"
                  onClick={() => onAcceptGame?.(safeMessage)}
                >
                  ACCEPT
                </button>
                <button
                  className="game-reject-btn"
                  onClick={() => onRejectGame?.(safeMessage)}
                >
                  DECLINE
                </button>
              </>
            ) : isSent && status === 'accepted' ? (
              <div className="invite-accepted-host">
                <span className="status-label">Accepted! Join?</span>
                <button
                  className="game-join-btn"
                  onClick={() => onJoinGame?.(safeMessage)}
                >
                  YES
                </button>
              </div>
            ) : (
              <div className="invite-status-text">
                {status === 'accepted' ? 'Combat Started! 🔥' :
                  status === 'rejected' ? 'Battle Declined ❌' :
                    status === 'completed' ? 'Battle Finished 🏁' :
                      isPending ? 'Waiting for opponent...' : 'Game Ended'}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <MessageBubble
        text={safeMessage.content ?? ''}
        repliedMsg={repliedMsg}
        currentUserId={currentUser?.id}
        time={formatBubbleTime(safeMessage.createdAt || safeMessage.created_at)}
        isMine={isSent}
        isDeleted={safeMessage.isDeleted || safeMessage.is_deleted}
        status={isRead ? 'read' : 'sent'}
        edited={!!(safeMessage.is_edited || safeMessage.isEdited)}
        sender={safeMessage.sender}
        message={safeMessage}
      />
    );
  };

  const showReceivedAvatar = isGroupChat && !isSent;

  const handleDragEnd = (event, info) => {
    // Always snap back to 0 with a spring
    animate(dragX, 0, { type: 'spring', stiffness: 500, damping: 35 });

    const dragThreshold = 60;
    if (isSent) {
      if (info.offset.x <= -dragThreshold) onReply?.(safeMessage);
    } else {
      if (info.offset.x >= dragThreshold) onReply?.(safeMessage);
    }
  };

  const handleReplyWithHighlight = () => {
    if (!isMobile && !isTouchDevice) {
      highlightControls.start('highlight').then(() => {
        highlightControls.start('complete');
      });
    }
    onReply(safeMessage);
    setShowActions(false);
  };

  return (
    <>
      <div
        ref={messageRef}
        id={`message-${safeMessage.id}`}
        className={`message-item ${isSent ? 'sent' : 'received'} ${isSelected ? 'selected' : ''} ${showActions ? 'highlighted' : ''} ${isGroupChat ? 'group-message' : ''}`}
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
        {showReceivedAvatar && (
          <button className="group-sender-avatar" onClick={handleSenderAvatarClick}>
            {senderAvatar ? (
              <img src={senderAvatar} alt={senderName} className="group-sender-avatar-img" />
            ) : (
              <span className="group-sender-avatar-initial">{senderInitial}</span>
            )}
          </button>
        )}

        <div className={`message-content-wrapper ${isGroupChat ? 'with-avatar' : ''}`}>
          <div
            className="message-bubble-wrapper"
            ref={dragConstraintsRef}
            style={{ position: 'relative' }}
          >
            <motion.div
              drag="x"
              dragConstraints={{ left: isSent ? -80 : 0, right: isSent ? 0 : 80 }}
              dragElastic={0.6}
              dragMomentum={false}
              onDragEnd={handleDragEnd}
              dragDirectionLock
              style={{ position: 'relative', x: dragX }}
              whileDrag={{ cursor: 'grabbing' }}
            >
              <motion.div
                className="swipe-reply-icon"
                style={{
                  position: 'absolute',
                  left: isSent ? 'auto' : -40,
                  right: isSent ? -40 : 'auto',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  opacity: 0,
                }}
                whileDrag={{ opacity: 0.85 }}
              >
                <Reply size={18} color="#7c3aed" />
              </motion.div>

              <AnimatePresence>
                {showHeartPop && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0, y: 0 }}
                    animate={{
                      scale: [0, 1.5, 1.2],
                      opacity: [0, 1, 0.8],
                      y: [0, -40, -60]
                    }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      marginLeft: '-24px',
                      marginTop: '-24px',
                      zIndex: 1000,
                      pointerEvents: 'none'
                    }}
                  >
                    <Heart size={48} fill="#ff4d4d" color="#ff4d4d" />
                  </motion.div>
                )}
              </AnimatePresence>

              {renderMessageContent()}
            </motion.div>
          </div>
        </div>

      </div>

      {showReactionPicker && (
        <ReactionPicker
          position={reactionPickerPos}
          onSelect={handleReactionSelect}
          onClose={() => setShowReactionPicker(false)}
        />
      )}

      <DesktopContextMenu
        position={menuPos}
        isVisible={showActions && !isSelectionMode}
        onReply={handleReply}
        onReplyWithHighlight={handleReplyWithHighlight}
        onCopy={handleCopy}
        onForward={handleForward}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSelect={onSelect}
        onReport={!isSent ? () => { setShowActions(false); setShowReportModal(true); } : undefined}
        isSent={isSent}
        isDeleted={isDeleted}
        onClose={() => setShowActions(false)}
        onReactionSelect={handleReactionSelect}
        preferredEmojis={preferredEmojis}
        emojiStyle={emojiStyle}
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

export default memo(MessageItem, (prevProps, nextProps) => {
  if (prevProps.message?.id !== nextProps.message?.id) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isSelectionMode !== nextProps.isSelectionMode) return false;

  // Check for metadata changes (reactions)
  const prevMeta = JSON.stringify(prevProps.message?.metadata || {});
  const nextMeta = JSON.stringify(nextProps.message?.metadata || {});
  if (prevMeta !== nextMeta) return false;

  if (prevProps.message?.content !== nextProps.message?.content) return false;

  return true;
});
