import { useEffect, useMemo } from 'react';
import { useRealtimeTyping } from '../../hooks/useRealtimeTyping';
import usePresenceStore from '../../store/usePresenceStore';

/**
 * useChatPresence
 *
 * Consumes the global usePresenceStore (Zustand) to determine online status.
 * This is the single source of truth — GameLobbyProvider populates the store,
 * components observe it here without needing the context at all.
 */
export function useChatPresence({
    chatId,
    otherUserId,
    isGroupChat,
    currentUserId,
    onPresenceChange,
}) {
    // Typing indicators still use their own broadcast channel per chat
    const { typingUsers, sendTyping } = useRealtimeTyping(chatId, currentUserId);

    // Consume global Zustand presence store (selector to avoid re-renders for unrelated users)
    const isOnlineLive = usePresenceStore(state => state.isUserOnline(otherUserId));
    const userPresenceData = usePresenceStore(state => state.onlineUsers[String(otherUserId)]);

    // Determine presence object for the specific other user
    const otherUserPresence = useMemo(() => {
        if (isGroupChat || !otherUserId) return null;
        return isOnlineLive ? userPresenceData : null;
    }, [isGroupChat, otherUserId, isOnlineLive, userPresenceData]);

    // Notify caller when presence changes
    useEffect(() => {
        if (isGroupChat || !otherUserId) return;

        const status = { isOnline: !!otherUserPresence };
        if (otherUserPresence?.onlineAt) {
            status.lastSeen = otherUserPresence.onlineAt;
        }

        onPresenceChange?.(status);
    }, [otherUserPresence, onPresenceChange, otherUserId, isGroupChat]);

    return useMemo(() => ({
        typingUsers,
        sendTyping,
    }), [typingUsers, sendTyping]);
}
