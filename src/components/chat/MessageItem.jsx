import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
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
}) => {
  const [showActions, setShowActions] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [isUpwards, setIsUpwards] = useState(false);
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
    
    // OPTIMISTIC UPDATE: Remove message from UI immediately
    const previousMessage = message;
    if (onDelete) {
      onDelete(message.id);
    }
    
    try {
      // Now make the API call
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', message.id);

      if (error) throw error;
      
      toast.success('Message deleted');
      
    } catch (error) {
      console.error('Error deleting message:', error);
      
      // ROLLBACK: If deletion fails, show error but don't restore message
      // (since we already removed it from UI for better UX)
      toast.error('Failed to delete message');
    }
  };

  const formatTime = (timestamp) => {
    try {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Error formatting time:', error);
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

  // Agar message type 'game_invite' hai, toh ye Special Card dikhao
  if (message.type === 'game_invite') {
      const handleAcceptInvitation = async () => {
      try {
        // Update invitation status to accepted
        const { error: inviteError } = await supabase
          .from('game_invitations')
          .update({ status: 'accepted' })
          .eq('id', message.game_invitation_id);

        if (inviteError) throw inviteError;

        // Update message status to accepted
        const { error: messageError } = await supabase
          .from('messages')
          .update({ status: 'accepted' })
          .eq('id', message.id);

        if (messageError) throw messageError;

        toast.success('Game invitation accepted!');
        
        // Immediately open the game with the partner
        if (onAcceptGame) {
          onAcceptGame(message.id, message.game_room_id);
        }
      } catch (error) {
        console.error('Error accepting invitation:', error);
        toast.error('Failed to accept invitation');
      }
    };

    const handleRejectInvitation = async () => {
      try {
        // Update invitation status to rejected
        const { error: inviteError } = await supabase
          .from('game_invitations')
          .update({ status: 'rejected' })
          .eq('id', message.game_invitation_id);

        if (inviteError) throw inviteError;

        // Update message status to rejected
        const { error: messageError } = await supabase
          .from('messages')
          .update({ status: 'rejected' })
          .eq('id', message.id);

        if (messageError) throw messageError;

        toast.success('Game invitation rejected');
      } catch (error) {
        console.error('Error rejecting invitation:', error);
        toast.error('Failed to reject invitation');
      }
    };

    return (
      <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 w-64 shadow-lg">
          
          {/* Header */}
          <div className="flex items-center gap-3 mb-3 border-b border-gray-700 pb-2">
            <span className="text-2xl">🎮</span>
            <div>
              <h3 className="font-bold text-white text-sm">Truth or Dare</h3>
              <p className="text-xs text-gray-400">
                {message.status === 'pending' ? 'Game invitation' : 'Game started!'}
              </p>
            </div>
          </div>

          {/* Invitation Content */}
          <div className="text-xs text-gray-300 mb-3">
            {message.content}
          </div>

          {/* Actions - Logic:
              1. Agar status 'pending' hai aur main receiver hu -> Accept/Reject buttons.
              2. Agar status 'accepted' hai -> 'Join Game' button.
          */}
          {message.status === 'pending' ? (
            isSent ? (
              <div className="text-xs text-yellow-500 italic">Waiting for response...</div>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={handleAcceptInvitation}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                >
                  <UserCheck size={14} /> Accept
                </button>
                <button 
                  onClick={handleRejectInvitation}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                >
                  <UserX size={14} /> Reject
                </button>
              </div>
            )
          ) : message.status === 'accepted' ? (
             <button 
               onClick={() => {
                 // Start the game
                 if (onAcceptGame) {
                   onAcceptGame(message.id, message.game_room_id);
                 }
               }}
               className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-bold animate-pulse"
             >
               Start Truth or Dare 🚀
             </button>
          ) : (
             <div className="text-red-400 text-xs">Invitation rejected</div>
          )}

        </div>
      </div>
    );
  }

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
              // Smart positioning logic
              const menuHeight = 220; // Estimated menu height
              const menuWidth = 180;
              const screenH = window.innerHeight;
              const screenW = window.innerWidth;

              let x = e.clientX;
              let y = e.clientY;

              // Vertical logic (upwards or downwards)
              const openUpwards = (screenH - y) < menuHeight;
              setIsUpwards(openUpwards);

              if (openUpwards) {
                y = y - menuHeight; // Shift up
              }

              // Horizontal logic (left or right)
              if ((screenW - x) < menuWidth) {
                x = x - menuWidth;
              }

              setMenuPos({ x, y });
              setShowActions(true);
            }
          }
        }}
      >
        <div className="message-content-wrapper">
          {renderMessageContent()}
        </div>
      </div>

      {/* Menu Overlay - Click to close */}
      {showActions && !isSelectionMode && !isTouchDevice && (
        <div
          className="menu-overlay"
          onClick={() => setShowActions(false)}
        />
      )}

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