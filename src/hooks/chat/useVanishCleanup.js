import { useEffect } from 'react';
import { db } from '../../db/db';

/**
 * useVanishCleanup
 * 
 * Background hook that periodocially checks for expired messages
 * in the local Dexie database and removes them.
 */
export function useVanishCleanup(chatId, intervalMs = 10000) {
    useEffect(() => {
        if (!chatId) return;

        const cleanup = async () => {
            try {
                const now = new Date().toISOString();
                
                // Find messages that have expired
                const allMsgs = await db.getAll('messages', { chatId: String(chatId) });
                const expiredMessages = allMsgs.filter(msg => msg.vanishAt && msg.vanishAt < now);

                if (expiredMessages.length > 0) {
                    console.log(`[Vanish] Cleaning up ${expiredMessages.length} expired messages in chat ${chatId}`);
                    for (const m of expiredMessages) {
                        await db.delete('messages', m.id);
                    }

                    // Optional: Update chat list preview if the latest message was deleted
                    const remainingRaw = await db.getAll('messages', { chatId: String(chatId) });
                    const remaining = remainingRaw.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                    
                    const latestMsg = remaining[0];
                    if (latestMsg) {
                        await db.update('chats_list', String(chatId), {
                            lastMessage: latestMsg.content || '📎 Media',
                            lastMessageAt: latestMsg.createdAt,
                            timestamp: latestMsg.createdAt,
                        }).catch(() => {});
                    } else {
                        // If no messages left, clear preview
                        await db.update('chats_list', String(chatId), {
                            lastMessage: '',
                            lastMessageAt: null,
                            timestamp: null,
                        }).catch(() => {});
                    }
                }
            } catch (error) {
                console.error('[Vanish] Cleanup error:', error);
            }
        };

        // Run immediately
        cleanup();

        // Then run periodically
        const interval = setInterval(cleanup, intervalMs);
        return () => clearInterval(interval);
    }, [chatId, intervalMs]);
}
