import { create } from 'zustand';
import { shallow } from 'zustand/shallow';

const useChatStore = create((set, get) => ({
    // ─── STATE ───────────────────────────────────────────────────
    roomScrollPositions: {},
    chatMessagesCache: {}, // ✅ Store last few messages for instant display
    isSyncing: false,
    isSelectionMode: false,
    selectedMessageIds: new Set(),
    activeChat: null,
    activeChatId: null, // ✅ Add separate primitive value

    // ─── ACTIONS ─────────────────────────────────────────────────

    setCachedMessages: (chatId, messages) => set((state) => ({
        chatMessagesCache: {
            ...state.chatMessagesCache,
            [chatId]: messages.slice(-20) // Only cache last 20 for memory efficiency
        }
    })),

    setActiveChat: (chat) => set((state) => {
        const currentId = state.activeChatId;
        const newId = chat?.id;

        if (currentId === newId) {
            return state;
        }

        return { 
            activeChat: chat,
            activeChatId: newId 
        };
    }),

    clearActiveChat: () => set({ 
        activeChat: null,
        activeChatId: null 
    }),

    // ... rest of your actions (unchanged)
    enterSelectionMode: (firstMessageId) => {
        const ids = new Set();
        if (firstMessageId) ids.add(firstMessageId);
        set({ isSelectionMode: true, selectedMessageIds: ids });

        if (navigator.vibrate) {
            navigator.vibrate(30);
        }
    },

    toggleMessageSelection: (messageId) => {
        if (!messageId) return;
        const { selectedMessageIds } = get();
        const newSelected = new Set(selectedMessageIds);

        if (newSelected.has(messageId)) {
            newSelected.delete(messageId);
            if (newSelected.size === 0) {
                set({ selectedMessageIds: new Set(), isSelectionMode: false });
                return;
            }
        } else {
            newSelected.add(messageId);
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

// ─── OPTIMIZED SELECTORS ────────────────────────────────────────

export const selectActiveChatId = (state) => state.activeChatId; // ✅ NEW
export const selectActiveChat = (state) => state.activeChat;
export const selectRoomScrollPosition = (chatId) => (state) => state.roomScrollPositions[chatId];
export const selectIsSyncing = (state) => state.isSyncing;

export default useChatStore;