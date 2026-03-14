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
        } catch (dbErr) {
            console.warn('[useDeleteMessage] Optimistic local DB delete failed:', dbErr);
        }

        try {
            // ── Step 1: Call Supabase with verification (Hard Delete) ──
            const { data, error } = await supabase
                .from('messages')
                .delete()
                .eq('id', messageId)
                .select('id');

            if (error) {
                console.error('[useDeleteMessage] Supabase error:', error);
                throw error;
            }

            // ── Step 2: RLS silent block detection ──
            if (!data || data.length === 0) {
                // Double-check: is the row actually still there?
                const { data: check } = await supabase
                    .from('messages')
                    .select('id')
                    .eq('id', messageId)
                    .maybeSingle();

                if (check) {
                    console.error('[useDeleteMessage] Row still exists — RLS blocked delete');
                    throw new Error('Permission denied: cannot delete this message');
                }
                console.log('[useDeleteMessage] Row already gone (deleted by someone else)');
            }

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
