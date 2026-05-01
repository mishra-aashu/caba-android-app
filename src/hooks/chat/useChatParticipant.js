import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useGroupDetails } from '../../hooks/useGroupDetails';
import useUserStore from '../../store/userStore';

/**
 * useChatParticipant
 *
 * Manages the identity and details of the other participant (User or Group).
 */
export function useChatParticipant({
  chatId,
  otherUserId,
  isGroupChat,
  currentUser,
}) {
  const location = useLocation();
  // ✅ Only subscribe to the specific chat we need
  const activeChat = useLiveQuery(() => {
    if (!chatId || chatId === 'new') return null;
    return db.chats_list.get(String(chatId));
  }, [chatId]);
  
  const { data: groupDetails } = useGroupDetails(isGroupChat ? chatId : null);

  const [otherUser, setOtherUser] = useState(() => {
    const state = location.state;

    // 1. Try location state (fastest)
    if (isGroupChat && state?.groupName) {
      return {
        id: chatId,
        name: state.groupName,
        avatar: state.groupAvatar || null,
        is_group: true,
        isGroup: true,
        member_count: state.memberCount || 0,
      };
    }

    // 2. Try global chats list
    if (activeChat) {
      const effectiveId = isGroupChat ? chatId : otherUserId;
      return {
        ...activeChat,
        ...(activeChat.otherUser || {}),
        id: effectiveId,
        is_group: !!activeChat.isGroup,
        isGroup: !!activeChat.isGroup,
        member_count:
          activeChat.member_count || activeChat.otherUser?.member_count || 0,
      };
    }

    // 3. Fallback defaults
    if (isGroupChat) {
      return {
        id: chatId,
        name: 'Group Chat',
        avatar: null,
        is_group: true,
        isGroup: true,
        member_count: 0,
      };
    }

    return null;
  });

  // Sync group details when they arrive
  useEffect(() => {
    if (isGroupChat && groupDetails) {
      const memberCount = groupDetails.group_members?.length || 0;
      const memberPreviews =
        groupDetails.group_members?.slice(0, 5).map((m) => ({
          id: m.users?.id,
          name: m.users?.name || 'Unknown',
          avatar: m.users?.avatar,
          role: m.role,
        })) || [];

      const myRole =
        groupDetails.group_members?.find((m) => m.user_id === currentUser?.id)
          ?.role || 'member';

      setOtherUser((prev) => ({
        ...(prev || {}),
        ...groupDetails,
        id: groupDetails.id,
        name: groupDetails.name,
        avatar: groupDetails.avatar_url,
        is_group: true,
        isGroup: true,
        member_count: memberCount,
        member_previews: memberPreviews,
        my_role: myRole,
        description: groupDetails.description,
      }));
    }
  }, [isGroupChat, groupDetails, currentUser?.id]);
  
  // Reset otherUser when chatId changes to prevent stale UI
  useEffect(() => {
    setOtherUser(null);
  }, [chatId, isGroupChat]);

  // Resolve DM user details
  useEffect(() => {
    let isMounted = true;

    if (!isGroupChat && otherUserId && otherUserId !== 'group') {
      useUserStore
        .getState()
        .fetchUserIfNeeded(otherUserId)
        .then((user) => {
          if (isMounted && user) {
            setOtherUser((prev) => {
              const name = activeChat?.name || user.name || 'Unknown User';
              // FIX: Spread fresh user data AFTER prev so fresh fields win
              return { ...prev, ...user, name, contact_name: activeChat?.name };
            });
          }
        })
        .catch(() => {
          if (isMounted) {
            setOtherUser((prev) => prev || {
              id: otherUserId,
              name: 'Unknown User',
              avatar: null,
            });
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [isGroupChat, otherUserId, activeChat]);

  return {
    otherUser,
    setOtherUser,
  };
}