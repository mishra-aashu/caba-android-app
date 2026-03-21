import React, { useRef, useLayoutEffect, useState, useEffect, useCallback } from 'react';
import { Reply, Copy, Share2, Edit, Trash2, MousePointer, Flag } from 'lucide-react';
import { createPortal } from 'react-dom';
import EmojiRenderer from '../common/EmojiRenderer';
import styles from './DesktopContextMenu.module.css';

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
  isDeleted = false,
}) => {
  const menuRef = useRef(null);
  // [FIX #5] Start with visibility hidden to prevent flicker
  // Menu renders invisible, useLayoutEffect calculates position, then shows
  const [adjustedPos, setAdjustedPos] = useState({ x: -9999, y: -9999 });
  const [isPositioned, setIsPositioned] = useState(false);

  // [FIX #5] Calculate position BEFORE paint
  useLayoutEffect(() => {
    if (!isVisible || !menuRef.current) {
      setIsPositioned(false);
      return;
    }

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth <= 768;
    const margin = isMobile ? 16 : 10;
    const bottomMargin = isMobile ? 24 : 10;

    let { x, y } = position;

    // Vertical: ensure it doesn't go off bottom
    if (y + menuRect.height > viewportHeight - bottomMargin) {
      y = viewportHeight - menuRect.height - bottomMargin;
    }
    // Ensure it doesn't go off top
    if (y < margin) y = margin;

    // Horizontal: prefer right of click, push left if overflows
    if (x + menuRect.width > viewportWidth - margin) {
      x = viewportWidth - menuRect.width - margin;
    }
    // Ensure it doesn't go off left
    if (x < margin) x = margin;

    setAdjustedPos({ x, y });
    setIsPositioned(true);
  }, [isVisible, position]);

  // [FIX #2] Escape key handler
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isVisible, onClose]);

  // [FIX #4] Close on scroll — menu becomes disconnected from message
  useEffect(() => {
    if (!isVisible) return;

    const handleScroll = () => {
      onClose?.();
    };

    // Use capture to catch scroll on any element
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isVisible, onClose]);

  // [FIX #7] Safe handler wrapper — prevents crash if handler is undefined
  const safeCall = useCallback((handler) => {
    return () => {
      handler?.();
      onClose?.();
    };
  }, [onClose]);

  if (!isVisible) return null;

  const handleReplyClick = () => {
    if (onReplyWithHighlight) {
      onReplyWithHighlight();
    } else {
      onReply?.();
    }
    onClose?.();
  };

  const emojisToDisplay = preferredEmojis?.length > 0
    ? preferredEmojis
    : ['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏'];

  const menuContent = (
    <>
      {/* [FIX #1] Overlay backdrop — clicking outside closes the menu */}
      <div
        className={styles['menu-overlay']}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose?.();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose?.();
        }}
      />

      <div
        ref={menuRef}
        className={styles['context-menu']}
        // [FIX #10] Accessibility
        role="menu"
        aria-label="Message actions"
        style={{
          position: 'fixed',
          top: adjustedPos.y,
          left: adjustedPos.x,
          zIndex: 10000,
          // [FIX #5] Prevent flicker — hidden until positioned
          opacity: isPositioned ? 1 : 0,
          pointerEvents: isPositioned ? 'auto' : 'none',
        }}
      >
        {/* ── Reactions Row ── */}
        {!isDeleted && (
          <div className={styles['menu-reactions-row']}>
            {emojisToDisplay.map((emoji) => (
              <button
                key={emoji}
                className={styles['menu-reaction-btn']}
                role="menuitem"
                aria-label={`React with ${emoji}`}
                onClick={() => {
                  onReactionSelect?.(emoji);
                  onClose?.();
                }}
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

        {!isDeleted && <div className={styles['menu-divider']} />}

        {/* ── Select — always available ── */}
        <div className={styles['menu-item']} role="menuitem" onClick={safeCall(onSelect)}>
          <span className={styles.icon}><MousePointer size={16} /></span>
          <span>Select</span>
        </div>

        {!isDeleted && (
          <>
            {/* ── Reply ── */}
            <div className={styles['menu-item']} role="menuitem" onClick={handleReplyClick}>
              <span className={styles.icon}><Reply size={16} /></span>
              <span>Reply</span>
            </div>

            {/* ── Copy ── */}
            <div className={styles['menu-item']} role="menuitem" onClick={safeCall(onCopy)}>
              <span className={styles.icon}><Copy size={16} /></span>
              <span>Copy</span>
            </div>

            {/* ── Forward ── */}
            <div className={styles['menu-item']} role="menuitem" onClick={safeCall(onForward)}>
              <span className={styles.icon}><Share2 size={16} /></span>
              <span>Forward</span>
            </div>

            {/* [FIX #3] Edit — ONLY for sender's own messages */}
            {isSent && onEdit && (
              <div className={styles['menu-item']} role="menuitem" onClick={safeCall(onEdit)}>
                <span className={styles.icon}><Edit size={16} /></span>
                <span>Edit</span>
              </div>
            )}

            {/* [FIX #6] Delete — different label for sent vs received */}
            {isSent ? (
              <div
                className={`${styles['menu-item']} ${styles.delete}`}
                role="menuitem"
                onClick={safeCall(onDelete)}
              >
                <span className={styles.icon}><Trash2 size={16} /></span>
                <span>Delete</span>
              </div>
            ) : (
              <div
                className={`${styles['menu-item']} ${styles.delete}`}
                role="menuitem"
                onClick={safeCall(onDelete)}
              >
                <span className={styles.icon}><Trash2 size={16} /></span>
                <span>Delete for me</span>
              </div>
            )}
          </>
        )}

        {/* If deleted message — still allow delete for cleanup */}
        {isDeleted && (
          <div
            className={`${styles['menu-item']} ${styles.delete}`}
            role="menuitem"
            onClick={safeCall(onDelete)}
          >
            <span className={styles.icon}><Trash2 size={16} /></span>
            <span>Delete</span>
          </div>
        )}

        {/* ── Report — only for received messages ── */}
        {!isSent && onReport && (
          <>
            <div className={styles['menu-divider']} />
            <div className={styles['menu-item']} role="menuitem" onClick={safeCall(onReport)}>
              <span className={styles.icon}><Flag size={16} /></span>
              <span>Report</span>
            </div>
          </>
        )}
      </div>
    </>
  );

  return createPortal(menuContent, document.body);
};

export default DesktopContextMenu;