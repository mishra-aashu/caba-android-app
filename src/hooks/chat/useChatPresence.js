import { useEffect, useRef } from 'react';
import { useRealtimeTyping } from '../../hooks/useRealtimeTyping';
import realtimeManager from '../../utils/realtimeManager';

/**
 * useChatPresence
 * 
 * Handles:
 * - Supabase Presence (online/last seen) sharded by user
 * - Typing indicators
 */
export function useChatPresence({
    chatId,
    otherUserId,
    isGroupChat,
    currentUserId,
    onPresenceChange,
}) {
    const { typingUsers, sendTyping } = useRealtimeTyping(chatId, currentUserId);
    const syncRef = useRef();

    syncRef.current = () => {
        if (isGroupChat || !otherUserId) return;

        const channelName = `presence:${otherUserId}`;
        const entry = realtimeManager.getChannel(channelName);
        if (!entry || !entry.channel) return;

        const state = entry.channel.presenceState();
        let isOnline = false;
        let lastSeen = null;

        Object.values(state).forEach(presences => {
            presences.forEach(p => {
                if (p.user_id === otherUserId) {
                    isOnline = true;
                    lastSeen = p.online_at;
                }
            });
        });

        onPresenceChange?.({ is_online: isOnline, last_seen: lastSeen });
    };

    useEffect(() => {
        if (isGroupChat || !otherUserId) return;

        const channelName = `presence:${otherUserId}`;
        realtimeManager.subscribe(channelName, {}, {
            presence: { event: 'sync', callback: () => syncRef.current() }
        });

        return () => realtimeManager.unsubscribe(channelName);
    }, [otherUserId, isGroupChat]);

    return {
        typingUsers,
        sendTyping,
    };
}
