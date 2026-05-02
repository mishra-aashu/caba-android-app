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
 * @param {object} [contact] - Optional contact object to look for avatar
 * @returns {string|null} Resolved image source
 */
export const getChatAvatar = (chat, contact = null) => {
    if (!chat) return null;
    
    // Check possible property names in order of priority:
    // 1. Contact's custom avatar (most specific)
    // 2. Chat's avatar (stored in chat list)
    // 3. Chat's avatar_url
    // 4. otherUser data if present
    const avatarValue = contact?.contactAvatar || 
                       chat.avatar || 
                       chat.avatar_url || 
                       chat.otherUser?.avatar;
    
    return resolveAvatarUrl(avatarValue);
};
