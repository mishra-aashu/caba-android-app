import { useMemo } from 'react';

/**
 * React hook for TURN server configuration
 * Adapted from turn-config.js
 */
export const useTURNConfig = () => {
  // Free TURN Servers Configuration
  const FREE_TURN_SERVERS = useMemo(() => ({
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
  }), []);

  // Fallback STUN-only config (if TURN fails)
  const STUN_ONLY = useMemo(() => ({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.ekiga.net' }
    ]
  }), []);

  /**
   * Get TURN config for WebRTC
   */
  const getTURNConfig = (useFallback = false) => {
    return useFallback ? STUN_ONLY : FREE_TURN_SERVERS;
  };

  /**
   * Test TURN server connectivity
   */
  const testTURNConnectivity = async () => {
    try {
      const pc = new RTCPeerConnection(FREE_TURN_SERVERS);
      const testResult = { success: false, details: [] };

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          pc.close();
          resolve({ ...testResult, success: false, error: 'Timeout' });
        }, 10000);

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const type = event.candidate.type;
            testResult.details.push(`Found ${type} candidate`);
            if (type === 'relay') {
              testResult.success = true;
              clearTimeout(timeout);
              pc.close();
              resolve(testResult);
            }
          }
        };

        pc.createDataChannel('test');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return {
    FREE_TURN_SERVERS,
    STUN_ONLY,
    getTURNConfig,
    testTURNConnectivity
  };
};