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
                const expiredMessages = await db.messages
                    .where('chatId')
                    .equals(chatId)
                    .filter(msg => msg.vanishAt && msg.vanishAt < now)
                    .toArray();

                if (expiredMessages.length > 0) {
                    console.log(`[Vanish] Cleaning up ${expiredMessages.length} expired messages in chat ${chatId}`);
                    const expiredIds = expiredMessages.map(m => m.id);
                    
                    // Delete from local DB
                    await db.messages.bulkDelete(expiredIds);

                    // Optional: Update chat list preview if the latest message was deleted
                    const remaining = await db.messages
                        .where('chatId').equals(chatId)
                        .reverse().sortBy('createdAt');
                    
                    const latestMsg = remaining[0];
                    if (latestMsg) {
                        await db.chats_list.update(chatId, {
                            lastMessage: latestMsg.content || '📎 Media',
                            lastMessageAt: latestMsg.createdAt,
                            timestamp: latestMsg.createdAt,
                        }).catch(() => {});
                    } else {
                        // If no messages left, clear preview
                        await db.chats_list.update(chatId, {
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
