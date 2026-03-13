/**
 * Free TURN Servers Configuration
 * Updated: 2024 - Tested and Working
 */

const FREE_TURN_SERVERS = {
    iceServers: [
        // Google STUN (primary)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },

        // OpenRelay TURN (FREE - no signup required)
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },

        // Metered.ca Free TURN (limited but reliable)
        {
            urls: 'turn:a.relay.metered.ca:80',
            username: 'df4e050fc5de5dc26b25b85a',
            credential: 'Pxdp2PK0b5ZXljOm'
        },
        {
            urls: 'turn:a.relay.metered.ca:80?transport=tcp',
            username: 'df4e050fc5de5dc26b25b85a',
            credential: 'Pxdp2PK0b5ZXljOm'
        },
        {
            urls: 'turn:a.relay.metered.ca:443',
            username: 'df4e050fc5de5dc26b25b85a',
            credential: 'Pxdp2PK0b5ZXljOm'
        },
        {
            urls: 'turn:a.relay.metered.ca:443?transport=tcp',
            username: 'df4e050fc5de5dc26b25b85a',
            credential: 'Pxdp2PK0b5ZXljOm'
        },

        // Twilio STUN (public)
        { urls: 'stun:global.stun.twilio.com:3478' }
    ],
    iceCandidatePoolSize: 10
};

/**
 * Fallback STUN-only config (if TURN fails)
 */
const STUN_ONLY = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        { urls: 'stun:stun.ekiga.net' }
    ]
};

// Make globally available
window.FREE_TURN_SERVERS = FREE_TURN_SERVERS;
window.STUN_ONLY = STUN_ONLY;