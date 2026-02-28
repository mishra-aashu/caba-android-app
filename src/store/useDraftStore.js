import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * useDraftStore - Persistent store for message drafts
 * 
 * Stores unsent messages indexed by chatId.
 * Uses localStorage to persist drafts across sessions.
 */
const useDraftStore = create(
    persist(
        (set, get) => ({
            // State: { [chatId]: 'message content' }
            drafts: {},

            /**
             * Set a draft for a specific chat
             * @param {string} chatId - The ID of the chat
             * @param {string} content - The draft message content
             */
            setDraft: (chatId, content) => {
                if (!chatId) return;
                set((state) => ({
                    drafts: {
                        ...state.drafts,
                        [chatId]: content
                    }
                }));
            },

            /**
             * Get a draft for a specific chat
             * @param {string} chatId - The ID of the chat
             * @returns {string} The draft content or empty string
             */
            getDraft: (chatId) => {
                if (!chatId) return '';
                return get().drafts[chatId] || '';
            },

            /**
             * Clear a draft for a specific chat
             * @param {string} chatId - The ID of the chat
             */
            clearDraft: (chatId) => {
                if (!chatId) return;
                set((state) => {
                    const newDrafts = { ...state.drafts };
                    delete newDrafts[chatId];
                    return { drafts: newDrafts };
                });
            },
        }),
        {
            name: 'caba-message-drafts', // unique name for localStorage
            storage: createJSONStorage(() => localStorage),
        }
    )
);

export default useDraftStore;
