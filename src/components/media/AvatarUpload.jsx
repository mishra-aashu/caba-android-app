import React, { useRef, useState, useEffect } from 'react';
import { useAvatarUpload } from '../../hooks/media/useAvatarUpload';

/**
 * Avatar Upload Component
 * Provides UI for uploading and displaying profile avatars
 */
const AvatarUpload = ({ onAvatarUpdate, className = '' }) => {
  const fileInputRef = useRef(null);
  const { uploadAvatar, getCurrentUserAvatar, isUploading, uploadProgress } = useAvatarUpload();
  const [currentAvatar, setCurrentAvatar] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    loadCurrentAvatar();
  }, []);

  const loadCurrentAvatar = async () => {
    const avatarUrl = await getCurrentUserAvatar();
    setCurrentAvatar(avatarUrl);
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Create preview
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      const result = await uploadAvatar(file);

      // Update current avatar
      setCurrentAvatar(result.storageUrl);
      setPreviewUrl(null);

      if (onAvatarUpdate) {
        onAvatarUpdate(result);
      }

      // Clean up preview URL
      URL.revokeObjectURL(preview);

    } catch (error) {
      console.error('Avatar upload error:', error);
      setPreviewUrl(null);
      URL.revokeObjectURL(preview);
      alert('Failed to upload avatar: ' + error.message);
    }

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  };

  const displayUrl = previewUrl || currentAvatar;

  return (
    <div className={`avatar-upload ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={isUploading}
      />

      <div className="avatar-container" onClick={handleClick}>
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Profile Avatar"
            className="avatar-image"
          />
        ) : (
          <div className="avatar-placeholder">
            <i className="fas fa-user"></i>
          </div>
        )}

        {isUploading && (
          <div className="avatar-upload-overlay">
            <div className="upload-spinner"></div>
            <div className="upload-progress">{uploadProgress}%</div>
          </div>
        )}

        <div className="avatar-upload-hint">
          <i className="fas fa-camera"></i>
          <span>Click to upload</span>
        </div>
      </div>

      <div className="avatar-info">
        <p>Upload a profile picture. Supported formats: JPEG, PNG, WebP. Max size: 5MB.</p>
        {isUploading && (
          <div className="upload-status">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span>Uploading... {uploadProgress}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarUpload;