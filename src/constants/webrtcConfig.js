// Centralized WebRTC/ICE server configuration
// Consolidates STUN/TURN servers from multiple services and hooks

export const ICE_SERVERS = [
    // Google STUN servers (Fast & Free)
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

    // Additional free fallback STUN servers
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.ekiga.net' }
];

export const WEBRTC_CONFIG = {
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10
};

export const STUN_ONLY_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        { urls: 'stun:stun.ekiga.net' }
    ]
};
