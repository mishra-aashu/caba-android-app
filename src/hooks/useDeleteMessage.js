import { useCallback, useMemo } from 'react';
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

        // [FIX] Temp messages (temp_... or numeric-only IDs) are local-only.
        // Sending them to Supabase causes a 400: invalid UUID syntax.
        const isLocalOnly = !messageId ||
            String(messageId).startsWith('temp_') ||
            /^\d+$/.test(String(messageId));

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

        // [FIX] Skip server call for local-only temp messages — they don't exist in Supabase
        if (isLocalOnly) {
            console.log('[useDeleteMessage] Temp message deleted locally only:', messageId);
            return messageId;
        }

        try {
            // [SIGNAL DELETE] Instead of Hard-Delete, we mark it as deleted.
            // This signals the other user to delete it from their Dexie too.
            const { error } = await supabase
                .from('messages')
                .update({ 
                    is_deleted: true,
                    content: '🚫 This message was deleted',
                    media_path: null,
                    media_url: null 
                })
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

    const mutateAsync = useCallback(deleteMessage, [chatId, supabase]);

    return useMemo(() => ({ mutateAsync }), [mutateAsync]);
}
