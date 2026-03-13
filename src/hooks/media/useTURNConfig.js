import { useMemo } from 'react';
import { ICE_SERVERS, STUN_ONLY_CONFIG } from '../../constants/webrtcConfig';

/**
 * React hook for TURN server configuration
 * Adapted from turn-config.js
 */
export const useTURNConfig = () => {
  // Free TURN Servers Configuration
  const FREE_TURN_SERVERS = useMemo(() => ({
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10
  }), []);

  // Fallback STUN-only config (if TURN fails)
  const STUN_ONLY = useMemo(() => STUN_ONLY_CONFIG, []);

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