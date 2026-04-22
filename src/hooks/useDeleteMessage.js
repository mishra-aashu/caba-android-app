import { useSupabase } from '../contexts/SupabaseContext';
import { db } from '../db/db';
import toast from 'react-hot-toast';

/**
 * Hook to delete a message permanently
 */
export function useDeleteMessage(chatId) {
    const { supabase } = useSupabase();

    const deleteMessage = async (messageId) => {
        console.log('[useDeleteMessage] Deleting:', messageId);

        // Optimistic delete from local DB
        let previousMessage = null;
        try {
            previousMessage = await db.messages.get(messageId);
            await db.messages.delete(messageId);
            await db.messages.delete(`temp_${messageId}`);

            // Update chat list preview after deletion
            const allMessages = await db.messages.where('chatId').equals(chatId).reverse().sortBy('createdAt');
            const latestMsg = allMessages[0];
            if (latestMsg) {
                await db.chats_list.update(chatId, {
                    lastMessage: latestMsg.content || '📎 Media',
                    lastMessageAt: latestMsg.createdAt,
                    timestamp: latestMsg.createdAt,
                }).catch(() => {});
            }
        } catch (dbErr) {
            console.warn('[useDeleteMessage] Optimistic local DB delete failed:', dbErr);
        }

        try {
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', messageId);

            if (error) {
                console.error('[useDeleteMessage] Supabase error:', error);
                throw error;
            }

            // Note: Empty response is fine — row may have been deleted by the other user already
            console.log('[useDeleteMessage] Successfully deleted:', messageId);
            return messageId;

        } catch (error) {
            console.error('[useDeleteMessage] Rolling back:', error.message);
            // Rollback optimistic delete
            if (previousMessage) {
                try {
                    await db.messages.put(previousMessage);
                } catch (e) {
                    // Ignore rollback failure
                }
            }
            
            toast.error(
                error.message === 'Permission denied: cannot delete this message'
                    ? 'You can only delete your own messages'
                    : 'Failed to delete message'
            );
            throw error;
        }
    };

    return { mutateAsync: deleteMessage };
}
