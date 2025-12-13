import React, { useState, useRef } from 'react';
import { useP2PTransfer } from '../../hooks/media/useP2PTransfer';

/**
 * P2P Transfer Component
 * Provides UI for peer-to-peer file transfers
 */
const P2PTransfer = ({ transferId, roomId, userId, receiverId, onTransferComplete }) => {
  const fileInputRef = useRef(null);
  const { sendFile, receiveFile, cleanup, isConnected, transferProgress } = useP2PTransfer(transferId, roomId, userId);

  const [isTransferring, setIsTransferring] = useState(false);
  const [transferMode, setTransferMode] = useState('send'); // 'send' or 'receive'
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSendFile = async () => {
    if (!selectedFile) return;

    setIsTransferring(true);
    try {
      const result = await sendFile(selectedFile, receiverId, (progress) => {
        console.log('P2P transfer progress:', progress);
      });

      if (result.success && onTransferComplete) {
        onTransferComplete(result);
      }
    } catch (error) {
      console.error('P2P send error:', error);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleReceiveFile = async () => {
    setIsTransferring(true);
    try {
      const result = await receiveFile((progress) => {
        console.log('P2P receive progress:', progress);
      });

      if (result.success && onTransferComplete) {
        onTransferComplete(result);
      }
    } catch (error) {
      console.error('P2P receive error:', error);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCleanup = () => {
    cleanup();
    setSelectedFile(null);
    setIsTransferring(false);
  };

  return (
    <div className="p2p-transfer">
      <div className="transfer-header">
        <h3>P2P File Transfer</h3>
        <div className="transfer-mode">
          <button
            type="button"
            className={transferMode === 'send' ? 'active' : ''}
            onClick={() => setTransferMode('send')}
            disabled={isTransferring}
          >
            Send File
          </button>
          <button
            type="button"
            className={transferMode === 'receive' ? 'active' : ''}
            onClick={() => setTransferMode('receive')}
            disabled={isTransferring}
          >
            Receive File
          </button>
        </div>
      </div>

      <div className="transfer-status">
        <div className="status-item">
          <span className="status-label">Connection:</span>
          <span className={`status-value ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {isTransferring && (
          <div className="status-item">
            <span className="status-label">Progress:</span>
            <span className="status-value">{transferProgress}%</span>
          </div>
        )}
      </div>

      {transferMode === 'send' && (
        <div className="send-section">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={isTransferring}
          />

          {!selectedFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isTransferring}
              className="btn-primary"
            >
              Select File to Send
            </button>
          ) : (
            <div className="file-info">
              <div className="file-details">
                <strong>{selectedFile.name}</strong>
                <span>({Math.round(selectedFile.size / 1024)} KB)</span>
              </div>
              <div className="file-actions">
                <button
                  type="button"
                  onClick={handleSendFile}
                  disabled={isTransferring || !isConnected}
                  className="btn-primary"
                >
                  {isTransferring ? 'Sending...' : 'Send File'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  disabled={isTransferring}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {transferMode === 'receive' && (
        <div className="receive-section">
          <p>Waiting for file transfer from peer...</p>
          <button
            type="button"
            onClick={handleReceiveFile}
            disabled={isTransferring || !isConnected}
            className="btn-primary"
          >
            {isTransferring ? 'Receiving...' : 'Start Receiving'}
          </button>
        </div>
      )}

      <div className="transfer-controls">
        <button
          type="button"
          onClick={handleCleanup}
          className="btn-outline"
        >
          Cleanup Connection
        </button>
      </div>

      <div className="transfer-info">
        <p>
          <strong>P2P Transfer:</strong> Files are uploaded to Supabase first, then metadata is sent via WebRTC DataChannel.
          The receiver downloads the file from Supabase using the received metadata.
        </p>
      </div>
    </div>
  );
};

export default P2PTransfer;