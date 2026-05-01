import React, { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock, AlertCircle, RefreshCw, Users, User, Trash2, Timer } from "lucide-react";
import toast from "react-hot-toast";

// Services & Utils
import { EncryptionService } from "../../services/EncryptionService";
import { formatInboxTime } from "../../utils/dateFormatter";
import { manualRetrySyncItem } from "../../db/db";
import hapticsManager from "../../utils/hapticsManager";

// Components
import EmojiRenderer from "../common/EmojiRenderer";
import CachedImage from "../common/CachedImage";
import OnlineStatusDot from "../common/OnlineStatusDot";

// Styles
import styles from "../../styles/ChatListItem.module.css";

// ══════════════════════════════════════════════════════════════
// Helper Functions
// ══════════════════════════════════════════════════════════════

/**
 * Decrypt message content if encrypted
 */
const decryptMessage = (content, chatId, otherUserId) => {
  if (!content || typeof content !== 'string') return '';
  if (!content.startsWith('\uD83D\uDD12:')) return content; // Already plaintext

  try {
    return EncryptionService.decrypt(content, chatId, otherUserId);
  } catch (err) {
    console.warn('[ChatListItem] Decryption failed:', err);
    return content; // Keep encrypted
  }
};

/**
 * Get message sender prefix
 */
const getMessagePrefix = (chat, isGroup) => {
  if (chat.isMyMessage) {
    return (
      <span className={`${styles["message-sender-prefix"]} ${styles.me}`}>
        You:{" "}
      </span>
    );
  }

  if (isGroup && chat.lastMessageSenderName) {
    return (
      <span className={styles["message-sender-prefix"]}>
        {chat.lastMessageSenderName}:{" "}
      </span>
    );
  }

  return null;
};

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════

const ChatListItem = ({
  chat,
  onClick,
  isActive,
  onLongPressStart,
  onLongPressEnd,
  onLongPressMove,
  onContextMenu,
  selectionMode,
  isSelected,
  onSelect,
  isMobile,
  onAvatarClick,
}) => {
  // ──────────────────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────────────────

  if (!chat?.id) {
    console.warn('[ChatListItem] Invalid chat data:', chat);
    return null;
  }

  // ──────────────────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────────────────

  const [imgError, setImgError] = useState(false);

  // ──────────────────────────────────────────────────────────
  // Destructure Chat Data
  // ──────────────────────────────────────────────────────────

  const {
    id,
    name = "Unknown",
    avatar,
    lastMessage,
    timestamp,
    unreadCount = 0,
    isOnline,
    lastSeen,
    isGroup,
    memberCount,
    isVanishEnabled,
    status,
    otherUserId,
    metadata,
  } = chat;

  // ──────────────────────────────────────────────────────────
  // Computed Values
  // ──────────────────────────────────────────────────────────

  // Decrypt message content
  const displayMessage = useMemo(() => {
    const userId = otherUserId || metadata?.otherUserId;
    return decryptMessage(lastMessage, id, userId);
  }, [lastMessage, id, otherUserId, metadata]);

  // Format timestamp
  const displayTime = useMemo(() => {
    return formatInboxTime(timestamp);
  }, [timestamp]);

  // Message prefix
  const messagePrefix = useMemo(() => {
    return getMessagePrefix(chat, isGroup);
  }, [chat, isGroup]);

  // Sync status
  const isSyncing = useMemo(() => {
    return status === "pending" || 
           status === "sending" || 
           (String(id).startsWith("tmp_") && !status);
  }, [id, status]);

  const isFailed = status === "failed";

  // Avatar fallback
  const showAvatar = avatar && !imgError;

  // ──────────────────────────────────────────────────────────
  // Event Handlers
  // ──────────────────────────────────────────────────────────

  const handleClick = (e) => {
    if (selectionMode) {
      e.stopPropagation();
      onSelect?.(id);
    } else {
      onClick?.(chat);
    }
  };

  const handleAvatarClick = (e) => {
    e.stopPropagation();
    if (showAvatar) {
      onAvatarClick?.(avatar, name);
    }
  };

  const handleRetry = async (e) => {
    e.stopPropagation();
    
    try {
      await manualRetrySyncItem(id);
      toast.success("Retrying sync...");
      
      // Trigger network check
      if (navigator.onLine) {
        window.dispatchEvent(new Event("online"));
      }
    } catch (err) {
      console.error('[ChatListItem] Retry failed:', err);
      toast.error("Failed to retry");
    }
  };

  const handleContextMenuClick = (e) => {
    e.preventDefault();
    onContextMenu?.(e, chat);
  };

  const handleTouchStart = () => {
    if (isMobile && onLongPressStart) {
      hapticsManager.impact("Medium");
      onLongPressStart(id);
    }
  };

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────

  return (
    <div
      className={`
        ${styles["chat-item"]} 
        ${isActive ? styles.active : ""} 
        ${isGroup ? styles["group-item"] : ""} 
        ${isVanishEnabled ? styles["vanish-mode"] : ""} 
        ${isSelected ? styles.selected : ""} 
        ${selectionMode ? styles["selection-mode"] : ""} 
        ${isFailed ? styles.failed : ""}
        native-touch
      `}
      onClick={handleClick}
      onContextMenu={handleContextMenuClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={() => isMobile && onLongPressEnd?.()}
      onTouchMove={() => isMobile && onLongPressMove?.()}
      role="button"
      tabIndex={0}
      aria-selected={isActive}
      aria-label={`Chat with ${name}${unreadCount > 0 ? `, ${unreadCount} unread messages` : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e);
        }
      }}
    >
      {/* Selection Checkbox */}
      {selectionMode && (
        <div className={styles["selection-checkbox"]} aria-hidden="true">
          <div className={`${styles.checkbox} ${isSelected ? styles.checked : ""}`}>
            {isSelected && <span aria-label="Selected">✓</span>}
          </div>
        </div>
      )}

      {/* Avatar */}
      <motion.div
        className={styles["chat-avatar-container"]}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        onClick={handleAvatarClick}
        role="img"
        aria-label={`${name}'s avatar`}
      >
        {showAvatar ? (
          <CachedImage
            src={avatar}
            alt={name}
            className={styles["chat-avatar"]}
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className={isGroup ? styles["group-avatar-fallback"] : styles["avatar-fallback"]}
            aria-label={isGroup ? "Group avatar" : "User avatar"}
          >
            {isGroup ? <Users size={24} /> : <User size={24} />}
          </div>
        )}

        {/* Sync Status Overlay */}
        {(isSyncing || isFailed) && (
          <div className={styles["sync-status-overlay"]} aria-label={isSyncing ? "Syncing" : "Sync failed"}>
            {isSyncing ? (
              <Clock size={16} className={styles["spin-slow"]} />
            ) : (
              <AlertCircle size={16} color="#ff4b4b" />
            )}
          </div>
        )}

        {/* Online Status */}
        {!isGroup && !isSyncing && !isFailed && (
          <OnlineStatusDot userId={metadata?.otherUserId || otherUserId} />
        )}
      </motion.div>

      {/* Chat Info */}
      <div className={styles["chat-info"]}>
        {/* Header Row */}
        <div className={styles["chat-header-row"]}>
          <div className={styles["chat-name"]}>
            {/* Group Indicator */}
            {isGroup && (
              <span className={styles["group-indicator"]} title="Group Chat" aria-label="Group">
                <Users size={14} />
              </span>
            )}

            {/* Chat Name */}
            <span>{name}</span>

            {/* Vanish Mode Indicator */}
            {isVanishEnabled && (
              <Timer size={14} className={styles["vanish-icon"]} title="Vanish mode enabled" />
            )}

            {/* Failed Status */}
            {isFailed && (
              <span className={styles["failed-label"]} aria-label="Failed to send"> (Failed)</span>
            )}
          </div>

          {/* Timestamp */}
          <time className={styles["chat-time"]} dateTime={timestamp}>
            {displayTime}
          </time>
        </div>

        {/* Footer Row */}
        <div className={styles["chat-footer-row"]}>
          {/* Last Message */}
          <p className={styles["chat-last-message"]}>
            {messagePrefix}
            <EmojiRenderer text={displayMessage} />
          </p>

          {/* Actions */}
          <div className={styles["chat-list-actions"]}>
            {/* Retry Button */}
            {isFailed && (
              <button
                className={styles["inline-retry-btn"]}
                onClick={handleRetry}
                title="Retry sending"
                aria-label="Retry"
              >
                <RefreshCw size={14} />
              </button>
            )}

            {/* Unread Badge */}
            {unreadCount > 0 && !selectionMode && (
              <span className={styles["unread-badge"]} aria-label={`${unreadCount} unread`}>
                {unreadCount}
              </span>
            )}

            {/* Desktop Delete Button */}
            {!isMobile && !selectionMode && (
              <button
                className={styles["hover-delete-btn"]}
                onClick={handleContextMenuClick}
                aria-label="Delete chat"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// Memoization with Deep Comparison
// ══════════════════════════════════════════════════════════════

export default memo(ChatListItem, (prevProps, nextProps) => {
  // Fast path: Reference equality
  if (prevProps.chat === nextProps.chat) return true;

  // Compare chat properties that affect rendering
  const chatEqual = 
    prevProps.chat.id === nextProps.chat.id &&
    prevProps.chat.lastMessage === nextProps.chat.lastMessage &&
    prevProps.chat.timestamp === nextProps.chat.timestamp &&
    prevProps.chat.unreadCount === nextProps.chat.unreadCount &&
    prevProps.chat.isOnline === nextProps.chat.isOnline &&
    prevProps.chat.name === nextProps.chat.name &&
    prevProps.chat.avatar === nextProps.chat.avatar &&
    prevProps.chat.status === nextProps.chat.status;

  // Compare other props
  const propsEqual =
    prevProps.isActive === nextProps.isActive &&
    prevProps.selectionMode === nextProps.selectionMode &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isMobile === nextProps.isMobile;

  return chatEqual && propsEqual;
});