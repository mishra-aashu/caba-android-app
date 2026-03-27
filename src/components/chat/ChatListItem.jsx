import React, { memo } from "react";
import { Timer, Users, User, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMessagesPage } from "../../hooks/useMessages";
import { formatLastSeen, formatTime } from "../../utils/dateFormatter";
import { useResolveName } from "../../hooks/useResolveName";
import { useResolveAvatar } from "../../hooks/useResolveAvatar";
import EmojiRenderer from "../common/EmojiRenderer";
import CachedImage from "../common/CachedImage";
import styles from "../../styles/ChatListItem.module.css";

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
}) => {
  if (!chat) return null;
  const {
    name,
    avatar,
    lastMessage,
    timestamp,
    unreadCount,
    is_online,
    last_seen,
    isGroup,
    member_count,
    member_preview,
    is_vanish_enabled,
  } = chat;

  const queryClient = useQueryClient();

  // Use passed data instead of re-calculating (Resolving in parent is MUCH faster for lists)
  const resolvedName = name || "Unknown";
  const resolvedAvatar = avatar;

  const [imgError, setImgError] = React.useState(false);

  // ─── AGGRESSIVE PRE-FETCH ──────────────────────────────────────────────────
  // Pre-loading data on 'hover' or 'touch start' (pointer down) ensures that
  // by the time the click is complete and navigation finishes, the data
  // is already in the cache. This is the 'Full Proof' secret to instant feel.
  const handlePrefetch = () => {
    if (chat.id) {
      queryClient.prefetchInfiniteQuery({
        queryKey: ["messages", chat.id],
        queryFn: ({ pageParam }) =>
          fetchMessagesPage({ chatId: chat.id, pageParam }),
        initialPageParam: null,
        staleTime: 1000 * 60 * 5,
      });
    }
  };

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

  return (
    <div
      className={`${styles["chat-item"]} ${isActive ? styles.active : ""} ${isGroup ? styles["group-item"] : ""} ${is_vanish_enabled ? styles["vanish-mode"] : ""} ${isSelected ? styles.selected : ""} ${selectionMode ? styles["selection-mode"] : ""} native-touch`}
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
      onMouseEnter={handlePrefetch}
      onPointerDown={handlePrefetch}
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
      <div className={styles["chat-avatar-container"]}>
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
      </div>

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
            {is_vanish_enabled && (
              <Timer size={14} className={styles["vanish-icon"]} />
            )}
          </div>
          <span className={styles["chat-time"]}>{displayTime}</span>
        </div>

        <div className={styles["chat-footer-row"]}>
          <p className={styles["chat-last-message"]}>
            {messagePrefix}
            <EmojiRenderer text={lastMessage} />
          </p>

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
    prevProps.chat.is_online === nextProps.chat.is_online &&
    prevProps.chat.name === nextProps.chat.name &&
    prevProps.chat.avatar === nextProps.chat.avatar
  );
});
