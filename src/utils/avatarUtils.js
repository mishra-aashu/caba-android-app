import { getDpPath } from './dpOptions';

/**
 * Validate and get proper avatar URL
 * @param {string|number} avatar - Avatar value from database (id or url)
 * @returns {string|null} - Proper avatar URL or null
 */
export const getValidAvatarUrl = (avatar) => {
    if (!avatar) return null;

    // Convert to string for consistency
    const avatarStr = String(avatar).trim();

    // Skip invalid avatars
    if (avatarStr === '1' || avatarStr === '/1' ||
        avatarStr === 'null' || avatarStr === 'undefined' ||
        avatarStr === '') {
        return null;
    }

    // Check if it's a DP ID (number)
    const dpId = parseInt(avatarStr);
    if (!isNaN(dpId) && dpId >= 1) {
        // Use centralized DP options to get the path
        const path = getDpPath(dpId);
        if (path) return path;
    }

    // Check if it's already a valid URL/path
    if (avatarStr.startsWith('http') || avatarStr.startsWith('/assets/')) {
        return avatarStr;
    }

    // Handle legacy relative paths by adding a leading slash if missing
    if (avatarStr.startsWith('assets/')) {
        return '/' + avatarStr;
    }

    // For other values, return as is (could be a media ID or relative path)
    return avatarStr;
};
