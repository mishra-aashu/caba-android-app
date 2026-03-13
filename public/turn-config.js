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

        // Cloudflare STUN (NEW - very fast)
        { urls: 'stun:stun.cloudflare.com:3478' },

        // OpenRelay TURN (Best Free Option)
        {
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:443?transport=tcp',
                'turns:openrelay.metered.ca:443'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },

        // Metered.ca Free TURN (limited but reliable)
        {
            urls: [
                'turn:a.relay.metered.ca:80',
                'turn:a.relay.metered.ca:80?transport=tcp',
                'turn:a.relay.metered.ca:443',
                'turns:a.relay.metered.ca:443?transport=tcp'
            ],
            username: 'df4e050fc5de5dc26b25b85a',
            credential: 'Pxdp2PK0b5ZXljOm'
        },

        // Twilio STUN (very reliable)
        { urls: 'stun:global.stun.twilio.com:3478' },

        // Additional Reliable STUN Servers
        { urls: 'stun:stun.nextcloud.com:443' },
        { urls: 'stun:stun.services.mozilla.com:3478' },
        { urls: 'stun:stun.sipgate.net:3478' },
        { urls: 'stun:stun.1und1.de:3478' },
        { urls: 'stun:meet-jit-si-turnrelay.jitsi.net:443' }
    ],
    iceCandidatePoolSize: 5,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
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