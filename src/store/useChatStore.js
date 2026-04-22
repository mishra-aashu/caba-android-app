import { create } from 'zustand';

/**
 * useChatStore - Zustand store for UI state only
 *
 * Following the new architecture, message data is managed by Dexie + useLiveQuery.
 * This store only holds volatile UI state like scroll positions.
 */

const useChatStore = create((set, get) => ({
    // ─── STATE (UI ONLY) ───────────────────────────────────────────────────
    roomScrollPositions: {},
    isSyncing: false,
    isSelectionMode: false,
    selectedMessageIds: new Set(),
    activeChat: null, // Holds the currently active chat object

    // ─── ACTIONS ──────────────────────────────────────────────────────────

    setActiveChat: (chat) => set({ activeChat: chat }),

    clearActiveChat: () => set({ activeChat: null }),

    enterSelectionMode: (firstMessageId) => {
        const ids = new Set();
        if (firstMessageId) ids.add(firstMessageId);
        set({ isSelectionMode: true, selectedMessageIds: ids });

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
            if (newSelected.size === 0) {
                console.log('Auto-exiting selection mode');
                set({ selectedMessageIds: new Set(), isSelectionMode: false });
                return;
            }
        } else {
            newSelected.add(messageId);
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
                [chatId]: index,
            },
        }));
    },

    setSyncing: (status) => set({ isSyncing: status }),
}));

// ─── SELECTORS ──────────────────────────────────────────────────────────

export const selectRoomScrollPosition = (chatId) => (state) => state.roomScrollPositions[chatId];

export const selectIsSyncing = (state) => state.isSyncing;

export default useChatStore;