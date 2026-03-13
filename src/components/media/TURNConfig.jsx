import React, { useState } from 'react';
import { useTURNConfig } from '../../hooks/media/useTURNConfig';

/**
 * TURN Config Component
 * Provides UI for TURN server configuration and testing
 */
const TURNConfig = () => {
  const { FREE_TURN_SERVERS, STUN_ONLY, getTURNConfig, testTURNConnectivity } = useTURNConfig();
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnectivity = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testTURNConnectivity();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="turn-config">
      <h3>TURN Server Configuration</h3>

      <div className="config-sections">
        <div className="config-section">
          <h4>FREE TURN Servers ({FREE_TURN_SERVERS.iceServers.length} servers)</h4>
          <div className="server-list">
            {FREE_TURN_SERVERS.iceServers.map((server, index) => (
              <div key={index} className="server-item">
                <strong>{server.urls}</strong>
                {server.username && (
                  <div className="server-creds">
                    User: {server.username}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="config-section">
          <h4>STUN-Only Fallback ({STUN_ONLY.iceServers.length} servers)</h4>
          <div className="server-list">
            {STUN_ONLY.iceServers.map((server, index) => (
              <div key={index} className="server-item">
                <strong>{server.urls}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="config-actions">
        <button
          type="button"
          onClick={handleTestConnectivity}
          disabled={isTesting}
          className="btn-primary"
        >
          {isTesting ? 'Testing...' : 'Test TURN Connectivity'}
        </button>
      </div>

      {testResult && (
        <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
          <h4>Test Result: {testResult.success ? 'Success' : 'Failed'}</h4>
          {testResult.details && testResult.details.length > 0 && (
            <ul>
              {testResult.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          )}
          {testResult.error && (
            <p className="error-message">{testResult.error}</p>
          )}
        </div>
      )}

      <div className="config-info">
        <p>
          <strong>TURN Configuration:</strong> Provides free TURN servers for WebRTC connections.
          TURN servers help with NAT traversal when direct P2P connections fail.
        </p>
        <p>
          <strong>Testing:</strong> The connectivity test checks if TURN servers are reachable and can provide relay candidates.
        </p>
      </div>
    </div>
  );
};

export default TURNConfig;