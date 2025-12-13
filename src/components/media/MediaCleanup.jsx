import React, { useEffect } from 'react';
import { useMediaCleanup } from '../../hooks/media/useMediaCleanup';

/**
 * Media Cleanup Component
 * Provides UI for media cleanup operations
 */
const MediaCleanup = ({ autoStart = false }) => {
  const {
    isRunning,
    lastCleanup,
    cleanupStats,
    startCleanup,
    stopCleanup,
    runCleanup,
    cleanupTransfer
  } = useMediaCleanup();

  useEffect(() => {
    if (autoStart && !isRunning) {
      startCleanup();
    }
  }, [autoStart, isRunning, startCleanup]);

  const handleManualCleanup = async () => {
    await runCleanup();
  };

  const handleCleanupTransfer = async (transferId) => {
    if (window.confirm('Are you sure you want to cleanup this transfer?')) {
      await cleanupTransfer(transferId);
    }
  };

  const formatLastCleanup = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="media-cleanup">
      <div className="cleanup-header">
        <h3>Media Cleanup</h3>
        <div className="cleanup-controls">
          {isRunning ? (
            <button
              type="button"
              onClick={stopCleanup}
              className="btn-secondary"
            >
              Stop Auto Cleanup
            </button>
          ) : (
            <button
              type="button"
              onClick={startCleanup}
              className="btn-primary"
            >
              Start Auto Cleanup
            </button>
          )}
          <button
            type="button"
            onClick={handleManualCleanup}
            className="btn-outline"
            disabled={isRunning}
          >
            Run Manual Cleanup
          </button>
        </div>
      </div>

      <div className="cleanup-status">
        <div className="status-item">
          <span className="status-label">Status:</span>
          <span className={`status-value ${isRunning ? 'active' : 'inactive'}`}>
            {isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Last Cleanup:</span>
          <span className="status-value">{formatLastCleanup(lastCleanup)}</span>
        </div>
      </div>

      <div className="cleanup-stats">
        <h4>Cleanup Statistics</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-number">{cleanupStats.expiredTransfers}</div>
            <div className="stat-label">Expired Transfers</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{cleanupStats.oldSignals}</div>
            <div className="stat-label">Old Signals</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{cleanupStats.offlineUsers}</div>
            <div className="stat-label">Users Marked Offline</div>
          </div>
        </div>
      </div>

      <div className="cleanup-info">
        <p>
          <strong>Auto Cleanup:</strong> Runs every 5 minutes when active, cleaning up expired transfers,
          old WebRTC signals, and marking inactive users offline.
        </p>
        <p>
          <strong>Manual Cleanup:</strong> Click "Run Manual Cleanup" to perform cleanup immediately.
        </p>
      </div>
    </div>
  );
};

export default MediaCleanup;