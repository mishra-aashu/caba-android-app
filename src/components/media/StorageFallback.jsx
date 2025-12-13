import React, { useState } from 'react';
import { useStorageFallback } from '../../hooks/media/useStorageFallback';

/**
 * Storage Fallback Component
 * Provides UI for Supabase Storage operations as fallback
 */
const StorageFallback = ({ transferId, userId }) => {
  const { uploadFile, downloadFile, deleteFile } = useStorageFallback(transferId, userId);
  const [selectedFile, setSelectedFile] = useState(null);
  const [storagePath, setStoragePath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const filename = `${Date.now()}_${selectedFile.name}`;
      const result = await uploadFile(selectedFile, filename);

      setResult(result);
      if (result.success) {
        setStoragePath(result.storagePath);
      }
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!storagePath) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const result = await downloadFile(storagePath);
      setResult(result);

      if (result.success) {
        // Create download link
        const url = URL.createObjectURL(result.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = storagePath.split('/').pop();
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!storagePath) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const result = await deleteFile(storagePath);
      setResult(result);

      if (result.success) {
        setStoragePath('');
        setSelectedFile(null);
      }
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="storage-fallback">
      <h3>Storage Fallback</h3>

      <div className="storage-section">
        <h4>Upload File</h4>
        <input
          type="file"
          onChange={handleFileSelect}
          disabled={isProcessing}
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || isProcessing}
          className="btn-primary"
        >
          {isProcessing ? 'Processing...' : 'Upload to Storage'}
        </button>
      </div>

      {storagePath && (
        <div className="storage-section">
          <h4>Storage Path: {storagePath}</h4>
          <div className="storage-actions">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isProcessing}
              className="btn-secondary"
            >
              Download
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isProcessing}
              className="btn-danger"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`result ${result.success ? 'success' : 'error'}`}>
          <h4>{result.success ? 'Success' : 'Error'}</h4>
          <p>{result.success ? 'Operation completed successfully' : result.error}</p>
        </div>
      )}

      <div className="storage-info">
        <p>
          <strong>Storage Fallback:</strong> Direct Supabase Storage operations for offline users or when P2P fails.
          Files are stored in the 'media' bucket with user-specific paths.
        </p>
      </div>
    </div>
  );
};

export default StorageFallback;