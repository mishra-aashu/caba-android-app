import React, { useRef, useLayoutEffect, useState } from 'react';
import { Reply, Copy, Share2, Edit, Trash2, MousePointer, Flag, Heart } from 'lucide-react';
import { createPortal } from 'react-dom';
import EmojiRenderer from '../common/EmojiRenderer';

const DesktopContextMenu = ({
  position = { x: 0, y: 0 },
  isVisible,
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
  emojiStyle = 'apple',
  isDeleted = false
}) => {
  const menuRef = useRef(null);
  const [adjustedPos, setAdjustedPos] = useState(position);

  useLayoutEffect(() => {
    if (isVisible && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 10;

      let { x, y } = position;

      // Vertical correction (Prioritize staying above the bottom edge)
      if (y + menuRect.height > viewportHeight - margin) {
        y = viewportHeight - menuRect.height - margin;
      }

      // Ensure it doesn't go above the top edge
      if (y < margin) {
        y = margin;
      }

      // Horizontal correction
      if (x + menuRect.width > viewportWidth - margin) {
        x = viewportWidth - menuRect.width - margin;
      }

      // Ensure it doesn't go off left edge
      if (x < margin) {
        x = margin;
      }

      setAdjustedPos({ x, y });
    }
  }, [isVisible, position]);

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
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        top: adjustedPos.y,
        left: adjustedPos.x,
        transformOrigin: 'center center',
        zIndex: 10000,
      }}
    >
      {/* Reactions Row - Moved to TOP */}
      {!isDeleted && (
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
      )}

      {!isDeleted && <div className="menu-divider"></div>}

      {/* Actions Below Reactions */}
      <div className="menu-item" onClick={() => { onSelect(); onClose(); }}>
        <span className="icon"><MousePointer size={16} /></span>
        <span>Select</span>
      </div>

      {!isDeleted && (
        <>
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