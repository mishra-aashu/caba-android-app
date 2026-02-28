import { create } from 'zustand';
import { dbToFrontend } from '../utils/dbFieldMapping';
import { supabase } from '../config/supabase';

// Helper to fetch user from DB
const fetchUserFromDb = async (userId) => {
    if (!userId) return null;
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, avatar, is_online, last_seen, emoji_style, public_key, about, phone, email')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data ? dbToFrontend(data) : null;
    } catch (err) {
        console.error(`Error fetching user ${userId}:`, err);
        return null;
    }
};

const useUserStore = create((set, get) => ({
    users: {}, // Cache of user objects: { userId: userData }
    lastFetched: {}, // { userId: timestamp }
    pendingFetches: {}, // { userId: Promise } - deduplicate inflight requests

    setUser: (user) => {
        if (!user || !user.id) return;
        const formattedUser = dbToFrontend(user);
        set((state) => ({
            users: { ...state.users, [user.id]: formattedUser },
            lastFetched: { ...state.lastFetched, [user.id]: Date.now() }
        }));
    },

    setUsers: (usersList) => {
        if (!Array.isArray(usersList)) return;
        const newUsers = {};
        const newTimestamps = {};
        const now = Date.now();

        usersList.forEach(user => {
            if (user && user.id) {
                newUsers[user.id] = dbToFrontend(user);
                newTimestamps[user.id] = now;
            }
        });

        set((state) => ({
            users: { ...state.users, ...newUsers },
            lastFetched: { ...state.lastFetched, ...newTimestamps }
        }));
    },

    getUser: (userId) => get().users[userId] || null,

    // Root fix: Unified fetch-if-needed logic
    fetchUserIfNeeded: async (userId, force = false) => {
        if (!userId) return null;

        const state = get();
        const now = Date.now();
        const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

        // 1. Check if already fetching
        if (state.pendingFetches[userId]) {
            return state.pendingFetches[userId];
        }

        // 2. Check if cached and not stale
        if (!force && state.users[userId] && (now - (state.lastFetched[userId] || 0) < CACHE_TTL)) {
            return state.users[userId];
        }

        // 3. Trigger new fetch
        const fetchPromise = (async () => {
            try {
                const userData = await fetchUserFromDb(userId);
                if (userData) {
                    get().setUser(userData);
                }
                return userData;
            } finally {
                // Clean up pending fetch state
                set((state) => {
                    const newPending = { ...state.pendingFetches };
                    delete newPending[userId];
                    return { pendingFetches: newPending };
                });
            }
        })();

        set((state) => ({
            pendingFetches: { ...state.pendingFetches, [userId]: fetchPromise }
        }));

        return fetchPromise;
    }
}));

export default useUserStore;
