/**
 * updateUtils.js
 * 
 * Helpers for persistent update dismissal and version comparison.
 */

const DISMISS_KEY_PREFIX = 'update_dismissed_';

/**
 * Sets a dismissal timestamp for a specific update version.
 * Defaults to 24 hours.
 */
export const setUpdateDismissed = (type, version, hours = 24) => {
    const key = `${DISMISS_KEY_PREFIX}${type}_${version}`;
    const until = Date.now() + hours * 60 * 60 * 1000;
    localStorage.setItem(key, until.toString());
};

/**
 * Checks if a specific update version is currently dismissed.
 */
export const isUpdateDismissed = (type, version) => {
    const key = `${DISMISS_KEY_PREFIX}${type}_${version}`;
    const until = localStorage.getItem(key);
    if (!until) return false;
    
    if (Date.now() > parseInt(until, 10)) {
        localStorage.removeItem(key);
        return false;
    }
    return true;
};

/**
 * Clears dismissal for an update (e.g. after successful update).
 */
export const clearUpdateDismissal = (type, version) => {
    const key = `${DISMISS_KEY_PREFIX}${type}_${version}`;
    localStorage.removeItem(key);
};
