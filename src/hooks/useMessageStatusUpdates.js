import { useEffect } from 'react';
import { realtimeManager } from '../utils/realtimeManager';

/**
 * Hook to subscribe to message status updates (is_read, etc.)
 */
export const useMessageStatusUpdates = (chatId, onStatusUpdate) => {
    useEffect(() => {
        if (!chatId) return;

        console.log(`🔌 Consolidating message status updates for chat: ${chatId}`);
        const channelName = `message_status_${chatId}`;

        realtimeManager.subscribe(
            channelName,
            {},
            {
                postgres_changes: [
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'messages',
                        filter: `chat_id=eq.${chatId}`,
                        handler: (payload) => {
                            console.log('⚡ Message status update received:', payload);
                            onStatusUpdate(payload.new);
                        }
                    }
                ]
            }
        );

        return () => {
            console.log(`🔌 Cleaning up status updates for: ${chatId}`);
            realtimeManager.unsubscribe(channelName);
        };
    }, [chatId, onStatusUpdate]);
};