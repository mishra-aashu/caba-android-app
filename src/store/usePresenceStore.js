import { create } from 'zustand';

/**
 * usePresenceStore
 * 
 * Central store for tracking real-time user status.
 */
const usePresenceStore = create((set, get) => ({
    // Map of userId -> { id, name, avatar, onlineAt, isOnline }
    onlineUsers: {},
    
    setOnlineUsers: (usersMap) => set({ onlineUsers: usersMap }),
    
    updateUser: (userId, data) => set((state) => ({
        onlineUsers: {
            ...state.onlineUsers,
            [userId]: { ...state.onlineUsers[userId], ...data, isOnline: true }
        }
    })),
    
    removeUser: (userId) => set((state) => {
        const newUsers = { ...state.onlineUsers };
        if (newUsers[userId]) {
            newUsers[userId].isOnline = false;
            // We keep the metadata but mark as offline
        }
        return { onlineUsers: newUsers };
    }),

    isUserOnline: (userId) => {
        const user = get().onlineUsers[userId];
        return user?.isOnline || false;
    }
}));

export default usePresenceStore;
