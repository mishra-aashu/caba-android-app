import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';

/**
 * Hook to toggle a reaction on a message with Optimistic UI
 * @param {string} chatId - The ID of the current chat for cache invalidation
 * @returns {Object} - Mutation object for toggling reactions
 */
export const useToggleReaction = (chatId) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ messageId, userId, reaction }) => {
            const { data, error } = await supabase.rpc('toggle_reaction', {
                p_msg_id: messageId,
                p_user_id: userId,
                p_reaction: reaction
            });

            if (error) throw error;
            return { messageId, metadata: data };
        },

        // Optimistic UI Update
        onMutate: async ({ messageId, userId, reaction }) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['messages', chatId] });

            // Snapshot the previous value
            const previousMessages = queryClient.getQueryData(['messages', chatId]);

            // Optimistically update to the new value
            queryClient.setQueryData(['messages', chatId], (old) => {
                if (!old) return old;

                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        data: page.data.map((msg) => {
                            if (msg.id === messageId) {
                                const newMetadata = { ...(msg.metadata || {}) };
                                if (newMetadata[userId] === reaction) {
                                    delete newMetadata[userId];
                                } else {
                                    newMetadata[userId] = reaction;
                                }
                                return { ...msg, metadata: newMetadata };
                            }
                            return msg;
                        }),
                    })),
                };
            });

            // Return a context object with the snapshotted value
            return { previousMessages };
        },

        // If the mutation fails, use the context returned from onMutate to roll back
        onError: (err, variables, context) => {
            if (context?.previousMessages) {
                queryClient.setQueryData(['messages', chatId], context.previousMessages);
            }
        },

        // Always refetch after error or success to ensure sync
        onSettled: () => {
            // We don't necessarily need to refetch immediately if realtime is active,
            // but it's safer to ensure we're in sync.
            queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
        },
    });
};
