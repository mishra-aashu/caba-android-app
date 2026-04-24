import { useEffect, useMemo, useContext } from 'react';
import { useRealtimeTyping } from '../../hooks/useRealtimeTyping';
import { GameLobbyContext } from '../../contexts/GameLobbyContext';

/**
 * useChatPresence (Refactored)
 * 
 * Now consumes the global GameLobbyContext to determine online status.
 * This ensures a single source of truth and reduces WebSocket overhead.
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
    
    // Consume global presence state
    const lobbyContext = useContext(GameLobbyContext);
    const onlineUsers = lobbyContext?.onlineUsers || [];

    // Find the specific user in the global online list
    const otherUserPresence = useMemo(() => {
        if (isGroupChat || !otherUserId) return null;
        return onlineUsers.find(u => String(u.id) === String(otherUserId));
    }, [onlineUsers, otherUserId, isGroupChat]);

    // Notify caller when presence changes
    useEffect(() => {
        if (isGroupChat || !otherUserId) return;

        const status = { isOnline: !!otherUserPresence };
        if (otherUserPresence?.onlineSince) {
            status.lastSeen = otherUserPresence.onlineSince;
        }

        onPresenceChange?.(status);
    }, [otherUserPresence, onPresenceChange, otherUserId, isGroupChat]);

    return {
        typingUsers,
        sendTyping,
    };
}
