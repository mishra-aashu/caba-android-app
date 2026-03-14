import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { dpOptions } from '../utils/dpOptions';

/**
 * useResolveAvatar - Custom hook to resolve avatars globally
 * 
 * Logic:
 * 1. If absolute URL or path is provided as defaultAvatar, use it.
 * 2. If defaultAvatar is an ID, resolve it.
 * 3. Fallback to contact's avatar if userId is provided.
 * 
 * @param {string} userId - The user ID to resolve
 * @param {string} defaultAvatar - Fallback avatar URL/path/ID
 * @returns {string|null} Resolved avatar path/URL
 */
export const useResolveAvatar = (userId, defaultAvatar = null) => {
    const contacts = useLiveQuery(() => db.contacts.toArray()) || [];

    return useMemo(() => {
        // Normalize input
        let avatar = defaultAvatar;

        // If no avatar provided, try to find it via contact
        if (!avatar && userId) {
            const contact = contacts?.find(c => c.contact_user_id === userId);
            avatar = contact?.otherUser?.avatar;
        }

        // If we have an avatar (either passed in or from contact), check if it's an ID needing resolution
        if (avatar && !isNaN(parseInt(avatar)) && avatar.toString().length < 5) {
            const dp = dpOptions.find(dp => dp.id === parseInt(avatar));
            if (dp) return dp.path;
        }

        // Otherwise return as is (could be a full URL or null)
        return avatar;
    }, [userId, defaultAvatar, contacts]);
};

export default useResolveAvatar;
