/**
 * GroupListItem - Special ChatListItem for Groups
 * Shows group avatar, member names preview instead of user info
 */

import React from 'react';
import { Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchMessagesPage } from '../../hooks/useMessages';
import { getInitials } from '../../utils/stringUtils';
import { isUserOnline } from '../../utils/dateFormatter';
import { formatInboxTime } from '../../utils/dateFormatter';
import styles from '../../styles/ChatListItem.module.css';

const GroupListItem = ({ group, onClick, isActive }) => {
  const queryClient = useQueryClient();

  // ─── AGGRESSIVE PRE-FETCH ──────────────────────────────────────────────────
  const handlePrefetch = () => {
    if (group.id) {
      queryClient.prefetchInfiniteQuery({
        queryKey: ['messages', group.id],
        queryFn: ({ pageParam }) => fetchMessagesPage({ chatId: group.id, pageParam }),
        initialPageParam: null,
        staleTime: 1000 * 60 * 5,
      });
    }
  };

  // Get member preview text - "Sender: Message" format
  const getMemberPreview = () => {
    if (!group.last_message) return 'No messages yet';

    // For group messages, show sender name + message
    // Format: "Amit: Chalo kal milte hai"
    const message = group.last_message.length > 30
      ? group.last_message.substring(0, 30) + '...'
      : group.last_message;

    return message;
  };

  // Get member count text
  const getMemberCountText = () => {
    const count = group.member_count || 2;
    return `${count} ${count === 1 ? 'member' : 'members'}`;
  };

  // Format time using dayjs via formatInboxTime
  // Returns "h:mm A" for today, "Yesterday", or "DD/MM/YYYY" for older

  // Get initials from group name
  const getGroupInitials = () => {
    if (!group.name) return 'G';
    const words = group.name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return group.name.substring(0, 2).toUpperCase();
  };

  return (
    <div
      className={`${styles['chat-item']} ${isActive ? styles.active : ''} ${styles['group-item']}`}
      onClick={onClick}
      onMouseEnter={handlePrefetch}
      onPointerDown={handlePrefetch}
    >
      {/* Group Avatar */}
      <div className={styles['chat-avatar-container']}>
        {group.avatar_url ? (
          <img
            src={group.avatar_url}
            alt={group.name}
            className={styles['chat-avatar']}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className={styles['avatar-placeholder']}
          style={{
            display: group.avatar_url ? 'none' : 'flex',
            background: 'linear-gradient(135deg, #25d366, #128c7e)',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Users size={20} color="white" />
        </div>

        {/* Unread Badge on Avatar (Legacy position, but let's keep it functional) */}
        {group.unreadCount > 0 && (
          <span className={styles['unread-badge']} style={{ position: 'absolute', bottom: '-2px', right: '-2px', marginLeft: 0 }}>
            {group.unreadCount}
          </span>
        )}
      </div>

      {/* Chat Info */}
      <div className={styles['chat-info']}>
        <div className={styles['chat-header-row']}>
          <span className={styles['chat-name']}>{group.name || 'Unnamed Group'}</span>
          <span className={styles['chat-time']}>
            {formatInboxTime(group.last_message_time)}
          </span>
        </div>

        <div className={styles['chat-footer-row']}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            {/* Show member count for groups */}
            <span className={styles['member-count-badge']} style={{ marginRight: '6px' }}>
              <Users size={12} style={{ marginRight: '4px' }} />
              {getMemberCountText()}
            </span>
            <span className={styles['chat-last-message']}>
              {getMemberPreview()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupListItem;
