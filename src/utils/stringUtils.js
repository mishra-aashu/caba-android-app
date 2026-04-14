import { dpOptions } from './dpOptions';

export const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Resolves avatar path from database value (ID or URL)
 * @param {string|number} avatar - Avatar ID or direct URL
 * @returns {string|null} Resolved image path
 */
export const getAvatarPath = (avatar) => {
    if (!avatar) return null;
    
    // If it's a numeric ID (either as string or number)
    const avatarId = parseInt(avatar);
    if (!isNaN(avatarId) && avatarId.toString().length < 5) {
        const dp = dpOptions.find(dp => dp.id === avatarId);
        return dp ? dp.path : null;
    }
    
    // Fallback to direct URL/path
    // If it's a literal placeholder like "user" that isn't a valid path, return null
    if (typeof avatar === 'string' && !avatar.includes('/') && !avatar.includes('.')) {
        return null;
    }
    
    return avatar;
};