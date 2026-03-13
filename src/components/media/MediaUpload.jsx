import React, { useRef, useState } from 'react';
import { useMediaUpload } from '../../hooks/media/useMediaUpload';

/**
 * Media Upload Component
 * Provides UI for uploading media files with progress tracking
 */
const MediaUpload = ({
  fileType = 'image',
  userId,
  onUploadComplete,
  onUploadError,
  accept,
  multiple = false,
  className = '',
  children
}) => {
  const fileInputRef = useRef(null);
  const { uploadFile, uploads, cancelUpload, formatFileSize } = useMediaUpload();
  const [isUploading, setIsUploading] = useState(false);

  // Default accept types based on fileType
  const getAcceptTypes = () => {
    if (accept) return accept;

    const acceptTypes = {
      avatar: 'image/*',
      image: 'image/*',
      video: 'video/*',
      audio: 'audio/*',
      document: '.pdf,.doc,.docx'
    };

    return acceptTypes[fileType] || '*/*';
  };

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        const result = await uploadFile(file, fileType, userId, {
          onProgress: (progress, task) => {
            // Progress is handled by the hook
            console.log(`Upload progress for ${file.name}: ${progress}%`);
          }
        });
        return result;
      });

      const results = await Promise.all(uploadPromises);

      if (onUploadComplete) {
        onUploadComplete(multiple ? results : results[0]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (onUploadError) {
        onUploadError(error);
      }
    } finally {
      setIsUploading(false);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  };

  const handleCancel = (uploadId) => {
    cancelUpload(uploadId);
  };

  return (
    <div className={`media-upload ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptTypes()}
        multiple={multiple}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={isUploading}
      />

      {children ? (
        <div onClick={handleClick} style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}>
          {children}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={isUploading}
          className="media-upload-button"
        >
          {isUploading ? 'Uploading...' : `Upload ${fileType}`}
        </button>
      )}

      {/* Upload Progress */}
      {Array.from(uploads.entries()).map(([uploadId, upload]) => (
        <div key={uploadId} className="upload-progress-item">
          <div className="upload-info">
            <span className="upload-filename">{upload.fileName || 'Uploading...'}</span>
            <span className="upload-size">{upload.fileSize ? formatFileSize(upload.fileSize) : ''}</span>
          </div>
          <div className="upload-progress-bar">
            <div
              className="upload-progress-fill"
              style={{ width: `${upload.progress}%` }}
            />
          </div>
          <div className="upload-progress-text">{upload.progress}%</div>
          {upload.status === 'uploading' && (
            <button
              type="button"
              onClick={() => handleCancel(uploadId)}
              className="upload-cancel-button"
            >
              Cancel
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default MediaUpload;