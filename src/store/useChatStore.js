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
  isSelectionMode: false,
  selectedMessageIds: new Set(),

  // ─── ACTIONS ──────────────────────────────────────────────────────────

  enterSelectionMode: (firstMessageId) => {
    const ids = new Set();
    if (firstMessageId) ids.add(firstMessageId);
    set({ isSelectionMode: true, selectedMessageIds: ids });
    
    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  },

  toggleMessageSelection: (messageId) => {
    console.log('toggleMessageSelection called with:', messageId);
    if (!messageId) return;
    const { selectedMessageIds } = get();
    const newSelected = new Set(selectedMessageIds);

    if (newSelected.has(messageId)) {
      newSelected.delete(messageId);
      // Auto-exit if nothing selected
      if (newSelected.size === 0) {
        console.log('Auto-exiting selection mode');
        set({ selectedMessageIds: new Set(), isSelectionMode: false });
        return;
      }
    } else {
      newSelected.add(messageId);
      // Auto-enter selection mode when first message is selected
      console.log('Auto-entering selection mode');
      set({ isSelectionMode: true, selectedMessageIds: newSelected });
      return;
    }

    set({ selectedMessageIds: newSelected });
  },

  clearSelection: () => set({ isSelectionMode: false, selectedMessageIds: new Set() }),

  setSelectionMode: (enabled) => set({ isSelectionMode: enabled }),

  getSelectedCount: () => get().selectedMessageIds.size,

  getSelectedIdsArray: () => Array.from(get().selectedMessageIds),

  isMessageSelected: (messageId) => get().selectedMessageIds.has(messageId),

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
