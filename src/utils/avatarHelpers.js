import { getDpPath } from './dpOptions';

/**
 * resolveAvatarUrl - Pure utility to resolve an avatar value
 * 
 * @param {string|number} avatarValue - The avatar value (URL, path, or ID)
 * @returns {string|null} Resolved image source
 */
export const resolveAvatarUrl = (avatarValue) => {
    if (!avatarValue) return null;

    // 1. If it's a numeric ID (predefined DP), resolve it
    if (!isNaN(parseInt(avatarValue)) && avatarValue.toString().length < 5) {
        return getDpPath(avatarValue) || null;
    }

    // 2. Return the value as is (could be a full URL, relative path, or data URI)
    return avatarValue;
};

/**
 * getChatAvatar - Resolves avatar for a chat object (handles both avatar and avatar_url)
 * 
 * @param {object} chat - The chat or group object
 * @returns {string|null} Resolved image source
 */
export const getChatAvatar = (chat) => {
    if (!chat) return null;
    
    // Check possible property names
    const avatarValue = chat.avatar || chat.avatar_url || chat.otherUser?.avatar;
    
    return resolveAvatarUrl(avatarValue);
};
