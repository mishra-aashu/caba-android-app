import { create } from 'zustand';

/**
 * useChatStore - Zustand store for UI state only
 * 
 * Following the new architecture, message data is managed by TanStack Query.
 * This store only holds volatile UI state like scroll positions.
 */

const useChatStore = create((set, get) => ({
  // ─── STATE (UI ONLY) ───────────────────────────────────────────────────
  roomScrollPositions: {}, // Format: { [chatId]: index }
  isSyncing: false,

  // ─── ACTIONS ──────────────────────────────────────────────────────────

  /**
   * Save the scroll position for a specific chat room
   * @param {string} chatId 
   * @param {number} index 
   */
  saveScrollPosition: (chatId, index) => {
    if (!chatId) return;
    set((state) => ({
      roomScrollPositions: {
        ...state.roomScrollPositions,
        [chatId]: index
      }
    }));
  },

  setSyncing: (status) => set({ isSyncing: status }),
}));

// ─── SELECTORS ──────────────────────────────────────────────────────────

/**
 * Select the scroll position for a specific chatId
 */
export const selectRoomScrollPosition = (chatId) => (state) => state.roomScrollPositions[chatId];

/**
 * Select the sync status
 */
export const selectIsSyncing = (state) => state.isSyncing;

export default useChatStore;
