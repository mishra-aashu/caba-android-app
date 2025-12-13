import React, { useEffect, useRef, useState } from 'react';
import { useMediaViewer } from '../../hooks/media/useMediaViewer';

/**
 * Media Viewer Component
 * Modal component for viewing media files
 */
const MediaViewer = ({ isOpen, onClose, mediaId, fileInfo, options = {} }) => {
  const {
    currentMedia,
    isLoading,
    error,
    openMedia,
    closeMedia,
    downloadCurrent,
    formatFileSize,
    formatTime
  } = useMediaViewer();

  const [videoControls, setVideoControls] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (isOpen && mediaId) {
      openMedia(mediaId, fileInfo, options);
    } else if (!isOpen) {
      closeMedia();
    }
  }, [isOpen, mediaId, fileInfo, options, openMedia, closeMedia]);

  useEffect(() => {
    // Handle ESC key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderMediaContent = () => {
    if (!currentMedia?.media) return null;

    const { fileInfo, objectUrl } = currentMedia.media;

    switch (fileInfo.file_type) {
      case 'image':
      case 'avatar':
        return (
          <img
            src={objectUrl}
            alt={fileInfo.file_name}
            className="media-viewer-image"
            onLoad={() => console.log('Image loaded')}
            onError={() => console.error('Image failed to load')}
          />
        );

      case 'video':
        return (
          <div className="media-viewer-video-container">
            <video
              ref={videoRef}
              src={objectUrl}
              controls
              className="media-viewer-video"
              autoPlay={false}
              onLoadedData={() => console.log('Video loaded')}
              onError={() => console.error('Video failed to load')}
            />
            {videoControls && (
              <div className="media-viewer-controls">
                {videoControls}
              </div>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="media-viewer-audio-container">
            <div className="audio-icon">
              <i className="fas fa-music"></i>
            </div>
            <div className="audio-info">
              <h3>{fileInfo.file_name}</h3>
              <p>{formatFileSize(fileInfo.file_size)}</p>
            </div>
            <audio
              src={objectUrl}
              controls
              className="media-viewer-audio"
              onLoadedData={() => console.log('Audio loaded')}
              onError={() => console.error('Audio failed to load')}
            />
          </div>
        );

      case 'document':
        if (fileInfo.mime_type === 'application/pdf') {
          return (
            <iframe
              src={objectUrl}
              className="media-viewer-pdf"
              title={fileInfo.file_name}
            />
          );
        } else {
          return (
            <div className="media-viewer-document-container">
              <div className="document-preview">
                <i className="fas fa-file-alt fa-5x"></i>
                <h3>{fileInfo.file_name}</h3>
                <p>{formatFileSize(fileInfo.file_size)}</p>
                <button
                  className="btn-primary"
                  onClick={downloadCurrent}
                >
                  <i className="fas fa-download"></i> Download
                </button>
              </div>
            </div>
          );
        }

      default:
        return (
          <div className="media-viewer-error">
            <i className="fas fa-exclamation-circle"></i>
            <p>Unsupported media type</p>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="media-viewer-overlay" onClick={handleOverlayClick}>
      <div className="media-viewer-content">
        <div className="media-viewer-header">
          <button className="media-viewer-close" onClick={onClose} title="Close">
            <i className="fas fa-times"></i>
          </button>
          <div className="media-viewer-info">
            {currentMedia?.fileInfo && (
              <>
                <span className="media-filename">{currentMedia.fileInfo.file_name}</span>
                <span className="media-filesize">
                  {formatFileSize(currentMedia.fileInfo.file_size)}
                </span>
              </>
            )}
          </div>
          {currentMedia?.fileInfo?.file_type !== 'avatar' && !options.hideDownload && (
            <button className="media-viewer-download" onClick={downloadCurrent} title="Download">
              <i className="fas fa-download"></i>
            </button>
          )}
        </div>

        <div className="media-viewer-body">
          {isLoading && (
            <div className="media-viewer-loading">
              <div className="spinner"></div>
              <p>Loading...</p>
            </div>
          )}

          {error && (
            <div className="media-viewer-error">
              <i className="fas fa-exclamation-circle"></i>
              <p>{error}</p>
            </div>
          )}

          <div className="media-viewer-container">
            {renderMediaContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaViewer;