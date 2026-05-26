/**
 * idGenerators.js
 * Centralized ID generation utilities
 */

/**
 * Generates a UUID v4
 */
export const uuid = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
};

/**
 * Generates a unique call ID
 */
export const generateCallId = () => {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generates a room ID
 */
export const generateRoomId = () => {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
};

export default {
    uuid,
    generateCallId,
    generateRoomId
};
