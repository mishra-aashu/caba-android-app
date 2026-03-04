import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';

/**
 * useResolveName - Custom hook to resolve saved contact names globally
 * 
 * It looks up a userId in the user's saved contacts list.
 * If found, returns the saved contact name.
 * If not, returns the defaultName (usually the global username) or 'Unknown'.
 * 
 * @param {string} userId - The ID of the user to resolve
 * @param {string} defaultName - Optional fallback name (e.g. global username)
 * @returns {string} The resolved name
 */
export const useResolveName = (userId, defaultName = null) => {
    const { contacts } = useData();

    return useMemo(() => {
        if (!userId) return defaultName || 'Unknown';

        // Search for a contact matching this user ID
        const contact = contacts?.find(c => c.contact_user_id === userId);

        if (contact && contact.contact_name) {
            return contact.contact_name;
        }

        return defaultName || 'Unknown';
    }, [userId, defaultName, contacts]);
};

export default useResolveName;
