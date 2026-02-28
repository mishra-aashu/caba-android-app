import React from 'react';
import { Reply, Copy, Share2, Edit, Trash2, MousePointer, Flag, Heart } from 'lucide-react';
import { createPortal } from 'react-dom';
import EmojiRenderer from '../common/EmojiRenderer';

const DesktopContextMenu = ({
  position,
  isVisible,
  isUpwards,
  onReply,
  onReplyWithHighlight,
  onCopy,
  onForward,
  onEdit,
  onDelete,
  onSelect,
  onReport,
  isSent,
  onClose,
  onReactionSelect,
  preferredEmojis = [],
  emojiStyle = 'apple'
}) => {
  if (!isVisible) return null;

  const handleReplyClick = () => {
    if (onReplyWithHighlight) {
      onReplyWithHighlight();
    } else {
      onReply();
    }
    onClose();
  };

  // Determine the actual emojis to display
  const emojisToDisplay = preferredEmojis && preferredEmojis.length > 0
    ? preferredEmojis
    : ['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏'];

  const menuContent = (
    <div
      className="context-menu"
      style={{
        top: position.y,
        left: position.x,
        transformOrigin: isUpwards ? 'bottom left' : 'top left'
      }}
    >
      {/* Reactions Row - Moved to TOP */}
      <div className="menu-reactions-row">
        {emojisToDisplay.map((emoji) => (
          <button
            key={emoji}
            className="menu-reaction-btn"
            onClick={() => {
              onReactionSelect(emoji);
              onClose();
            }}
            title={`React with ${emoji}`}
          >
            <EmojiRenderer
              text={emoji}
              styleOverride={emojiStyle}
              className={emojiStyle === 'native' ? 'native-emoji' : 'custom-emoji-img'}
            />
          </button>
        ))}
      </div>

      <div className="menu-divider"></div>

      {/* Actions Below Reactions */}
      <div className="menu-item" onClick={() => { onSelect(); onClose(); }}>
        <span className="icon"><MousePointer size={16} /></span>
        <span>Select</span>
      </div>

      <div className="menu-item" onClick={handleReplyClick}>
        <span className="icon"><Reply size={16} /></span>
        <span>Reply</span>
      </div>

      <div className="menu-item" onClick={() => { onCopy(); onClose(); }}>
        <span className="icon"><Copy size={16} /></span>
        <span>Copy</span>
      </div>

      <div className="menu-item" onClick={() => { onForward(); onClose(); }}>
        <span className="icon"><Share2 size={16} /></span>
        <span>Forward</span>
      </div>

      {isSent && (
        <>
          <div className="menu-item" onClick={() => { onEdit(); onClose(); }}>
            <span className="icon"><Edit size={16} /></span>
            <span>Edit</span>
          </div>

          <div className="menu-item delete" onClick={() => { onDelete(); onClose(); }}>
            <span className="icon"><Trash2 size={16} /></span>
            <span>Delete</span>
          </div>
        </>
      )}

      {!isSent && onReport && (
        <>
          <div className="menu-divider"></div>
          <div className="menu-item" onClick={() => { onReport(); onClose(); }}>
            <span className="icon"><Flag size={16} /></span>
            <span>Report</span>
          </div>
        </>
      )}
    </div>
  );

  return createPortal(menuContent, document.body);
};

export default DesktopContextMenu;