import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../contexts/SupabaseContext';
import { db } from '../db/db';
import toast from 'react-hot-toast';

/**
 * Hook to delete a message permanently
 */
export function useDeleteMessage(chatId) {
    const { supabase } = useSupabase();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (messageId) => {
            console.log('[useDeleteMessage] Deleting:', messageId);

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
                // If check is null, someone else already deleted it — that's fine
                console.log('[useDeleteMessage] Row already gone (deleted by someone else)');
            }

            // ── Step 3: Clean local DB ──
            try {
                await db.messages.delete(messageId);
                await db.messages.delete(`temp_${messageId}`);
            } catch (dbErr) {
                console.warn('[useDeleteMessage] Local DB cleanup failed:', dbErr);
                // Non-critical — don't throw
            }

            return messageId;
        },

        // ── Optimistic Update ──
        onMutate: async (messageId) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['messages', chatId] });

            // Snapshot for rollback
            const previousData = queryClient.getQueryData(['messages', chatId]);

            // Optimistic removal
            queryClient.setQueryData(['messages', chatId], (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        data: page.data.filter(msg =>
                            msg.id !== messageId &&
                            msg.tempId !== messageId
                        ),
                    })),
                };
            });

            return { previousData };
        },

        // ── Rollback on failure ──
        onError: (error, messageId, context) => {
            console.error('[useDeleteMessage] Rolling back:', error.message);

            if (context?.previousData) {
                queryClient.setQueryData(['messages', chatId], context.previousData);
            }

            toast.error(
                error.message === 'Permission denied: cannot delete this message'
                    ? 'You can only delete your own messages'
                    : 'Failed to delete message'
            );
        },

        // ── Success ──
        onSuccess: (deletedId) => {
            console.log('[useDeleteMessage] Successfully deleted:', deletedId);
            // Let realtime or manual invalidation handle the rest if needed
            // queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
        },
    });
}
