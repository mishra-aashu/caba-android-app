import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { resolveAvatarUrl } from '../utils/avatarHelpers';

/**
 * useResolveAvatar - Custom hook to resolve avatars globally
 * 
 * Logic:
 * 1. If absolute URL or path is provided as defaultAvatar, resolve it (handles IDs).
 * 2. Fallback to contact's avatar if userId is provided.
 */
export const useResolveAvatar = (userId, defaultAvatar = null) => {
    const contacts = useLiveQuery(() => db.contacts.toArray()) || [];

    return useMemo(() => {
        // 1. Try to resolve the provided avatar first (handles IDs and URLs)
        let resolved = resolveAvatarUrl(defaultAvatar);
        if (resolved) return resolved;

        // 2. If nothing directly provided, try to find it via contact
        if (userId) {
            const contact = contacts?.find(c => c.contact_user_id === userId);
            const contactAvatar = contact?.otherUser?.avatar;
            if (contactAvatar) {
                return resolveAvatarUrl(contactAvatar);
            }
        }

        return null;
    }, [userId, defaultAvatar, contacts]);
};

export default useResolveAvatar;
