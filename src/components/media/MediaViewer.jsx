import React, { useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useMediaViewer } from '../../hooks/media/useMediaViewer';
import './MediaViewer.css';

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
  const transformWrapperRef = useRef(null);

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

  // Secure download function
  const handleSecureDownload = async (imageUrl, fileName) => {
    try {
      // Generate custom filename
      const timestamp = Date.now();
      const extension = fileName?.split('.').pop() || 'jpg';
      const customFileName = `CaBa_Media_${timestamp}.${extension}`;
      
      // Fetch image as blob
      const response = await fetch(imageUrl, { mode: 'cors' });
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      
      // Create temporary local link
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = customFileName;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to original method
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = fileName || 'image.jpg';
      link.click();
    }
  };

  // Share function
  const handleShare = async () => {
    if (navigator.share && currentMedia?.media?.objectUrl) {
      try {
        await navigator.share({
          title: currentMedia.fileInfo?.file_name || 'Shared Media',
          url: currentMedia.media.objectUrl
        });
      } catch (error) {
        console.log('Share cancelled or failed:', error);
      }
    }
  };

  // Fullscreen function
  const handleFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    }
  };

  const renderMediaContent = () => {
    if (!currentMedia?.media) return null;

    const { fileInfo, objectUrl } = currentMedia.media;

    switch (fileInfo.file_type) {
      case 'image':
      case 'avatar':
        return (
          <TransformWrapper
            ref={transformWrapperRef}
            initialScale={1}
            minScale={0.5}
            maxScale={5}
            centerOnInit={true}
            wheel={{ step: 0.1 }}
            pinch={{ step: 5 }}
            doubleClick={{ mode: 'reset' }}
          >
            {({ zoomIn, zoomOut, resetTransform, scale }) => (
              <>
                <TransformComponent>
                  <img
                    src={objectUrl}
                    alt={fileInfo.file_name}
                    className="viewer-image"
                    onLoad={() => console.log('Image loaded')}
                    onError={() => console.error('Image failed to load')}
                  />
                </TransformComponent>
                
                {/* Zoom controls in BOTTOM FOOTER */}
                <div className="viewer-controls-footer">
                  <div className="zoom-indicator">
                    {Math.round(scale * 100)}%
                  </div>
                  <button 
                    className="control-btn"
                    onClick={() => zoomIn()}
                    title="Zoom In"
                  >
                    <i className="fas fa-search-plus"></i>
                  </button>
                  <button 
                    className="control-btn"
                    onClick={() => zoomOut()}
                    title="Zoom Out"
                  >
                    <i className="fas fa-search-minus"></i>
                  </button>
                  <button 
                    className="control-btn"
                    onClick={resetTransform}
                    title="Reset"
                  >
                    <i className="fas fa-compress"></i>
                  </button>
                  <button 
                    className="control-btn"
                    onClick={() => resetTransform()}
                    title="100%"
                  >
                    <i className="fas fa-expand"></i>
                  </button>
                  <button 
                    className="control-btn"
                    onClick={handleShare}
                    title="Share"
                  >
                    <i className="fas fa-share"></i>
                  </button>
                  <button 
                    className="control-btn"
                    onClick={handleFullscreen}
                    title="Fullscreen"
                  >
                    <i className="fas fa-expand-arrows-alt"></i>
                  </button>
                  <button 
                    className="control-btn"
                    onClick={() => handleSecureDownload(objectUrl, fileInfo.file_name)}
                    title="Download"
                  >
                    <i className="fas fa-download"></i>
                  </button>
                </div>
              </>
            )}
          </TransformWrapper>
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
    <div className="media-viewer-container">
      {/* ZONE 1: TOP HEADER - ONLY User Info (Left) and Close (Right) */}
      <div className="viewer-header">
        <div className="user-info">
          <div className="avatar">
            <i className="fas fa-user"></i>
          </div>
          <div className="details">
            <span className="name">
              {currentMedia?.fileInfo?.file_name || 'Media File'}
            </span>
            <span className="time">
              {currentMedia?.fileInfo ? formatFileSize(currentMedia.fileInfo.file_size) : ''}
            </span>
          </div>
        </div>
        <button className="close-btn" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      {/* ZONE 2: MIDDLE BODY - Only Image and react-zoom-pan-pinch */}
      <div className="viewer-body">
        {isLoading && (
          <div className="media-viewer-loading">
            <div className="viewer-spinner"></div>
            <p>Loading...</p>
          </div>
        )}

        {error && (
          <div className="media-viewer-error">
            <i className="fas fa-exclamation-circle"></i>
            <p>{error}</p>
          </div>
        )}

        <div className="media-content">
          {renderMediaContent()}
        </div>
      </div>

      {/* ZONE 3: BOTTOM FOOTER - ALL Action Controls go here! */}
      <div className="viewer-controls-footer">
        {/* Zoom controls will be rendered inside TransformWrapper for images */}
      </div>
    </div>
  );
};

export default MediaViewer;