import { create } from 'zustand';
import { dbToFrontend } from '../utils/dbFieldMapping';

const useUserStore = create((set, get) => ({
    users: {}, // Map of userId -> userObject

    setUser: (user) => {
        if (!user || !user.id) return;
        const formattedUser = dbToFrontend(user);
        set((state) => ({
            users: {
                ...state.users,
                [user.id]: formattedUser
            }
        }));
    },

    setUsers: (usersList) => {
        if (!Array.isArray(usersList)) return;
        const newUsers = {};
        usersList.forEach(user => {
            if (user && user.id) {
                newUsers[user.id] = dbToFrontend(user);
            }
        });
        set((state) => ({
            users: {
                ...state.users,
                ...newUsers
            }
        }));
    },

    getUser: (userId) => {
        return get().users[userId];
    }
}));

export default useUserStore;
