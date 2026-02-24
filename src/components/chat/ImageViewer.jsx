import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, RotateCcw, ZoomIn, ZoomOut, Maximize2, Minimize2, Fullscreen } from 'lucide-react';
import { getValidAvatarUrl } from '../../utils/avatarUtils';
import './ImageViewer.css';

const ImageViewer = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  message,
  onDownload 
}) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const imageContainerRef = useRef(null);
  const viewerRef = useRef(null);
  const lastTouchDistance = useRef(0);

  // Handler functions - defined before useEffect to avoid hoisting issues
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.max(prev - 0.5, 0.5);
      if (newZoom < 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      // Secure download - fetch as blob to hide URL
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // Create object URL
      const url = window.URL.createObjectURL(blob);
      
      // Create hidden link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `CaBa_Media_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to simple download
      if (onDownload) {
        onDownload(imageUrl, message);
      } else {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `image_${Date.now()}.jpg`;
        link.target = '_blank';
        link.click();
      }
    }
  }, [imageUrl, message, onDownload]);

  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'CaBa Media',
          text: 'Check out this amazing media!',
          url: imageUrl
        });
      } else {
        // Fallback - copy to clipboard
        await navigator.clipboard.writeText(imageUrl);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.log('Share cancelled or failed:', error);
    }
  }, [imageUrl]);

  const handleFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement) {
        viewerRef.current?.requestFullscreen().catch(err => {
          console.error('Fullscreen failed:', err);
        });
      } else {
        document.exitFullscreen().catch(err => {
          console.error('Exit fullscreen failed:', err);
        });
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  // Touch zoom handlers
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (lastTouchDistance.current) {
        const scale = distance / lastTouchDistance.current;
        if (scale > 1.1) {
          handleZoomIn();
          lastTouchDistance.current = distance;
        } else if (scale < 0.9) {
          handleZoomOut();
          lastTouchDistance.current = distance;
        }
      }
      lastTouchDistance.current = distance;
    }
  }, []);

  // Reset state when image changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setRotation(0);
      setIsImageLoaded(false);
      setIsDragging(false);
    }
  }, [isOpen, imageUrl]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case 'r':
        case 'R':
          handleRotate();
          break;
        case '0':
          handleReset();
          break;
        case 'f':
        case 'F':
          handleFullscreen();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setPosition(prev => ({ ...prev, y: prev.y + 50 }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setPosition(prev => ({ ...prev, y: prev.y - 50 }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setPosition(prev => ({ ...prev, x: prev.x + 50 }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setPosition(prev => ({ ...prev, x: prev.x - 50 }));
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleZoomIn, handleZoomOut, handleRotate, handleReset, handleFullscreen]);

  // Handle wheel zoom
  useEffect(() => {
    const handleWheel = (e) => {
      if (!isOpen) return;
      e.preventDefault();
      
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    };

    const container = imageContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [isOpen]);

  // Prevent body scroll when viewer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Mouse drag handlers with GPU acceleration
  const handleMouseDown = useCallback((e) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      const startX = e.clientX - position.x;
      const startY = e.clientY - position.y;

      const handleMouseMove = (e) => {
        if (zoom > 1) {
          setPosition({
            x: (e.clientX - startX),
            y: (e.clientY - startY),
          });
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  }, [zoom, position]);

  // Animation variants with GPU acceleration
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } }
  };

  const imageVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.5,
      rotate: -10
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      rotate: 0,
      transition: { 
        type: 'spring',
        stiffness: 400,
        damping: 35,
        mass: 1
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.5,
      rotate: 10,
      transition: { duration: 0.15 }
    }
  };

  const buttonVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.15 },
    tap: { scale: 0.9 }
  };

  // Get sender info
  const senderName = message?.sender?.name || 'Unknown';
  const senderAvatar = message?.sender?.avatar || message?.sender?.profile_image || null;
  const validSenderAvatar = getValidAvatarUrl(senderAvatar);
  const messageTime = message?.createdAt || message?.created_at 
    ? new Date(message.createdAt || message.created_at).toLocaleString() 
    : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          ref={viewerRef}
          className="image-viewer-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          style={{ willChange: 'opacity' }}
        >
          {/* Top Bar - All Actions */}
          <motion.div 
            className="image-viewer-header"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{ willChange: 'transform, opacity' }}
          >
            {/* Left Side - Sender Info */}
            <div className="viewer-sender-info">
              {validSenderAvatar ? (
                <img src={validSenderAvatar} alt={senderName} className="viewer-sender-avatar" />
              ) : (
                <div className="viewer-sender-avatar viewer-sender-avatar-placeholder">
                  {senderName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="viewer-sender-details">
                <span className="viewer-sender-name">{senderName}</span>
                {messageTime && (
                  <span className="viewer-message-time">{messageTime}</span>
                )}
              </div>
            </div>

            {/* Right Side - Only Close Button */}
            <div className="viewer-actions">
              {/* Close */}
              <motion.button
                className="viewer-action-btn viewer-close-btn"
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                onClick={onClose}
                title="Close (Esc)"
              >
                <X size={26} />
              </motion.button>
            </div>
          </motion.div>

          {/* Image Container with GPU acceleration */}
          <div 
            ref={imageContainerRef}
            className="image-viewer-content"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            style={{ 
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              willChange: 'transform'
            }}
          >
            {!isImageLoaded && (
              <div className="image-viewer-loading">
                <div className="viewer-spinner"></div>
              </div>
            )}
            
            <motion.img
              src={imageUrl}
              alt="Full screen media"
              className="viewer-image"
              variants={imageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                opacity: isImageLoaded ? 1 : 0,
                willChange: 'transform, opacity',
                backfaceVisibility: 'hidden',
                perspective: 1000
              }}
              onLoad={() => setIsImageLoaded(true)}
              onError={() => setIsImageLoaded(true)}
              draggable={false}
            />
          </div>

          {/* Bottom Controls - All Action Buttons */}
          <motion.div 
            className="viewer-bottom-controls"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{ willChange: 'transform, opacity' }}
          >
            {/* Zoom Controls */}
            <motion.button
              className="viewer-action-btn"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={handleZoomOut}
              title="Zoom Out (-)"
            >
              <ZoomOut size={22} />
            </motion.button>
            
            <div className="viewer-zoom-level">
              {Math.round(zoom * 100)}%
            </div>
            
            <motion.button
              className="viewer-action-btn"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={handleZoomIn}
              title="Zoom In (+)"
            >
              <ZoomIn size={22} />
            </motion.button>

            {/* Rotate */}
            <motion.button
              className="viewer-action-btn"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={handleRotate}
              title="Rotate (R)"
            >
              <RotateCcw size={22} />
            </motion.button>

            {/* Reset */}
            <motion.button
              className="viewer-action-btn"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={handleReset}
              title="Reset (0)"
            >
              <Maximize2 size={20} />
            </motion.button>

            {/* Share */}
            <motion.button
              className="viewer-action-btn"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={handleShare}
              title="Share"
            >
              <Share2 size={22} />
            </motion.button>

            {/* Download */}
            <motion.button
              className="viewer-action-btn"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={handleDownload}
              title="Download"
            >
              <Download size={22} />
            </motion.button>

            {/* Fullscreen */}
            <motion.button
              className="viewer-action-btn"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={handleFullscreen}
              title="Fullscreen (F)"
            >
              <Fullscreen size={22} />
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImageViewer;
