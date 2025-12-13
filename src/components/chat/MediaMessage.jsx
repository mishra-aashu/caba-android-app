import React, { useState } from 'react';

const MediaMessage = ({ message, isSent, onDownload, onView }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const getFileTypeIcon = (fileType) => {
    const icons = {
      image: 'fas fa-image',
      video: 'fas fa-video',
      audio: 'fas fa-microphone',
      document: 'fas fa-file-pdf',
      avatar: 'fas fa-user-circle'
    };
    return icons[fileType] || 'fas fa-file';
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownload = async () => {
    if (!message.media_url) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // Simulate download progress
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      await onDownload(message.media_url, message.id);

      setDownloadProgress(100);
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 1000);

    } catch (error) {
      console.error('Download failed:', error);
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const renderMediaPreview = () => {
    if (!message.media_url) {
      return (
        <div className="media-unavailable">
          <i className="fas fa-exclamation-circle"></i>
          <span>Media not available</span>
        </div>
      );
    }

    switch (message.message_type) {
      case 'image':
        return (
          <div
            className="image-preview"
            style={{ backgroundImage: `url(${message.media_url})` }}
            onClick={() => onView(message.media_url, 'image')}
          >
            <div className="image-overlay">
              <i className="fas fa-search-plus"></i>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="video-preview" onClick={() => onView(message.media_url, 'video')}>
            <div className="video-overlay">
              <i className="fas fa-play-circle"></i>
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="audio-preview">
            <i className="fas fa-music"></i>
          </div>
        );

      case 'document':
        return (
          <div className="document-preview" onClick={() => onView(message.media_url, 'document')}>
            <i className="fas fa-file-pdf"></i>
          </div>
        );

      default:
        return (
          <div className="file-preview">
            <i className="fas fa-file"></i>
          </div>
        );
    }
  };

  if (isSent) {
    // Sent media message - show preview
    return (
      <div className="media-message sent">
        <div className="media-preview">
          {renderMediaPreview()}
        </div>
        <div className="media-details">
          <div className="media-name">{message.content}</div>
          <div className="media-size">{formatFileSize(message.file_size)}</div>
        </div>
      </div>
    );
  } else {
    // Received media message - show download option
    return (
      <div className="media-message received">
        {isDownloading ? (
          <div className="download-progress-container">
            <div className="download-progress-bar">
              <div
                className="download-progress-fill"
                style={{ width: `${downloadProgress}%` }}
              ></div>
            </div>
            <div className="download-progress-text">{downloadProgress}%</div>
          </div>
        ) : (
          <div className="media-download-container">
            <div className="media-icon">
              <i className={getFileTypeIcon(message.message_type)}></i>
            </div>
            <div className="media-info">
              <div className="media-name">{message.content}</div>
              <div className="media-status">Click to download</div>
            </div>
            <button className="btn-download" onClick={handleDownload}>
              <i className="fas fa-download"></i>
            </button>
          </div>
        )}
      </div>
    );
  }
};

export default MediaMessage;