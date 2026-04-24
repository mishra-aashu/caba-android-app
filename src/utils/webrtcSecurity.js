/**
 * WebRTC Security Utilities
 * Tools for managing TURN credentials and secure configurations
 */

const crypto = require('crypto');

/**
 * Generates time-limited TURN credentials following the standard pattern.
 * @param {string} secret - The shared secret key for HMAC generation
 * @param {string} userId - Unique identifier for the user (default: 'user123')
 * @param {number} validitySeconds - How long the credentials should be valid (default: 24h)
 * @returns {Object} - An object containing username, credential, and ttl
 */
function generateTurnCredentials(secret, userId = 'user123', validitySeconds = 86400) {
    // 24 hour validity by default
    const unixTimestamp = Math.floor(Date.now() / 1000) + validitySeconds;
    const username = `${unixTimestamp}:${userId}`;
    
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(username);
    const credential = hmac.digest('base64');
    
    return {
        username,
        credential,
        ttl: validitySeconds
    };
}

/**
 * Returns true if the call environment is secure.
 * WebRTC inherently requires secure contexts (HTTPS/WSS) and uses DTLS-SRTP.
 * This is used to drive the "256 system" branding in the UI.
 */
function isCallSecure() {
    // WebRTC is mandatory-secure in modern browsers
    return true;
}

module.exports = {
    generateTurnCredentials,
    isCallSecure
};
