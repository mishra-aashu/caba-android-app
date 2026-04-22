import React, { memo } from "react";
import { motion } from "framer-motion";
import { Clock, AlertCircle, RefreshCw, Users, User, Trash2, Timer } from "lucide-react";
import { fetchMessagesPage } from "../../hooks/useMessages";
import { formatLastSeen, formatTime } from "../../utils/dateFormatter";
import { useResolveName } from "../../hooks/useResolveName";
import { useResolveAvatar } from "../../hooks/useResolveAvatar";
import { manualRetrySyncItem } from "../../db/db";
import toast from "react-hot-toast";
import EmojiRenderer from "../common/EmojiRenderer";
import CachedImage from "../common/CachedImage";
import OnlineStatusDot from "../common/OnlineStatusDot";
import styles from "../../styles/ChatListItem.module.css";
import { EncryptionService } from "../../services/EncryptionService";

import hapticsManager from "../../utils/hapticsManager";

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
  if (!chat) return null;
  const {
    name,
    avatar,
    lastMessage,
    timestamp,
    unreadCount,
    isOnline,
    lastSeen,
    isGroup,
    memberCount,
    memberPreview,
    isVanishEnabled,
  } = chat;


  // Use passed data instead of re-calculating (Resolving in parent is MUCH faster for lists)
  const resolvedName = name || "Unknown";
  const resolvedAvatar = avatar;

  // FALLBACK: On-the-fly decryption for chat list preview
  // This handles cases where encrypted text might have reached the DB
  const displayMessage = React.useMemo(() => {
    if (!lastMessage) return "";
    return EncryptionService.decrypt(
        lastMessage, 
        chat.id, 
        chat.otherUserId || chat.metadata?.otherUserId
    );
  }, [lastMessage, chat.id, chat.otherUserId, chat.metadata]);

  const [imgError, setImgError] = React.useState(false);


  // Format time using our helper or fallback
  // If user is online, show 'Online', otherwise show last seen if available, else message timestamp
  const displayTime = formatTime(timestamp);

  // Determine message prefix (You: or Name:)
  const messagePrefix = chat.isMyMessage ? (
    <span className={`${styles["message-sender-prefix"]} ${styles.me}`}>
      You:{" "}
    </span>
  ) : isGroup && chat.lastMessageSenderName ? (
    <span className={styles["message-sender-prefix"]}>
      {chat.lastMessageSenderName}:{" "}
    </span>
  ) : null;

  const handleRetry = async (e) => {
    e.stopPropagation();
    try {
      await manualRetrySyncItem(chat.id);
      toast.success("Retrying sync...");
      if (navigator.onLine) {
        window.dispatchEvent(new Event("online"));
      }
    } catch (err) {
      console.error("Retry failed:", err);
      toast.error("Failed to retry");
    }
  };

  const isSyncing = chat.status === "pending" || chat.status === "sending" || (String(chat.id).startsWith("tmp_") && !chat.status);
  const isFailed = chat.status === "failed";

  return (
    <div
      className={`${styles["chat-item"]} ${isActive ? styles.active : ""} ${isGroup ? styles["group-item"] : ""} ${isVanishEnabled ? styles["vanish-mode"] : ""} ${isSelected ? styles.selected : ""} ${selectionMode ? styles["selection-mode"] : ""} ${isFailed ? styles.failed : ""} native-touch`}
      onClick={(e) => {
        if (selectionMode) {
          onSelect(chat.id);
        } else {
          onClick();
        }
      }}
      onContextMenu={(e) => onContextMenu && onContextMenu(e, chat)}
      onTouchStart={() => {
        if (isMobile && onLongPressStart) {
          hapticsManager.impact("Medium");
          onLongPressStart(chat.id);
        }
      }}
      onTouchEnd={() => isMobile && onLongPressEnd && onLongPressEnd()}
      onTouchMove={() => isMobile && onLongPressMove && onLongPressMove()}
    >
      {selectionMode && (
        <div className={styles["selection-checkbox"]}>
          <div
            className={`${styles.checkbox} ${isSelected ? styles.checked : ""}`}
          >
            {isSelected && <span>✓</span>}
          </div>
        </div>
      )}
      <motion.div
        className={styles["chat-avatar-container"]}
        whileHover={{ scale: 1.05, filter: "brightness(1.15)" }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        onClick={(e) => {
          e.stopPropagation();
          if (resolvedAvatar && !imgError) {
            onAvatarClick && onAvatarClick(resolvedAvatar, resolvedName);
          }
        }}
      >
        {resolvedAvatar && !imgError ? (
          <CachedImage
            src={resolvedAvatar}
            alt={resolvedName}
            className={styles["chat-avatar"]}
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className={
              isGroup
                ? styles["group-avatar-fallback"]
                : styles["avatar-fallback"]
            }
          >
            {isGroup ? <Users size={24} /> : <User size={24} />}
          </div>
        )}

        {/* Sync Status Overlay */}
        {(isSyncing || isFailed) && (
          <div className={styles["sync-status-overlay"]}>
            {isSyncing ? <Clock size={16} className={styles["spin-slow"]} /> : <AlertCircle size={16} color="#ff4b4b" />}
          </div>
        )}

        {/* Real-time Online Indicator */}
        {!isGroup && chat.id && !isSyncing && !isFailed && (
          <OnlineStatusDot userId={chat.metadata?.otherUserId || chat.id} />
        )}
      </motion.div>

      <div className={styles["chat-info"]}>
        <div className={styles["chat-header-row"]}>
          <div className={styles["chat-name"]}>
            {isGroup && (
              <span className={styles["group-indicator"]} title="Group Chat">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={styles["group-icon"]}
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                </svg>
              </span>
            )}
            {resolvedName}
            {isVanishEnabled && (
              <Timer size={14} className={styles["vanish-icon"]} />
            )}
            {isFailed && <span className={styles["failed-label"]}> (Failed)</span>}
          </div>
          <span className={styles["chat-time"]}>{displayTime}</span>
        </div>

        <div className={styles["chat-footer-row"]}>
          <p className={styles["chat-last-message"]}>
            {messagePrefix}
            <EmojiRenderer text={displayMessage} />
          </p>

          <div className={styles["chat-list-actions"]}>
            {isFailed && (
              <button className={styles["inline-retry-btn"]} onClick={handleRetry} title="Retry">
                <RefreshCw size={14} />
              </button>
            )}

            {unreadCount > 0 && !selectionMode && (
              <span className={styles["unread-badge"]}>{unreadCount}</span>
            )}

            {!isMobile && !selectionMode && (
              <button
                className={styles["hover-delete-btn"]}
                onClick={(e) => {
                  e.stopPropagation();
                  onContextMenu(e, chat); // Trigger context menu or direct delete modal
                }}
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

export default memo(ChatListItem, (prevProps, nextProps) => {
  return (
    prevProps.isActive === nextProps.isActive &&
    prevProps.selectionMode === nextProps.selectionMode &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isMobile === nextProps.isMobile &&
    // Shallow check for chat object properties that affect UI
    prevProps.chat.id === nextProps.chat.id &&
    prevProps.chat.lastMessage === nextProps.chat.lastMessage &&
    prevProps.chat.timestamp === nextProps.chat.timestamp &&
    prevProps.chat.unreadCount === nextProps.chat.unreadCount &&
    prevProps.chat.isOnline === nextProps.chat.isOnline &&
    prevProps.chat.name === nextProps.chat.name &&
    prevProps.chat.avatar === nextProps.chat.avatar
  );
});
