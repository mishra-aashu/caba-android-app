import React, { useEffect, useState, useRef } from 'react';
import qrcode from 'qrcode';
import { useDialog } from '../../contexts/DialogContext';
import './QRCodeGenerator.css';

const QRCodeGenerator = ({ userId, userName, userPhone, onDownload, onClose }) => {
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState('classic');
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const canvasRef = useRef(null);

  const qrStyles = {
    classic: { fgColor: '#000000', bgColor: '#FFFFFF', eyeRadius: 0 },
    blue: { fgColor: '#0066CC', bgColor: '#FFFFFF', eyeRadius: 5 },
    green: { fgColor: '#00AA00', bgColor: '#FFFFFF', eyeRadius: 5 },
    purple: { fgColor: '#6600CC', bgColor: '#FFFFFF', eyeRadius: 5 },
    red: { fgColor: '#CC0000', bgColor: '#FFFFFF', eyeRadius: 5 },
    dark: { fgColor: '#FFFFFF', bgColor: '#000000', eyeRadius: 3 }
  };

  const userData = {
    id: userId,
    name: userName || 'User',
    phone: userPhone || '',
    type: 'caba-user'
  };

  const qrData = JSON.stringify(userData);

  useEffect(() => {
    if (canvasRef.current) {
      qrcode.toCanvas(canvasRef.current, qrData, {
        width: 160,
        margin: 1,
        color: {
          dark: qrStyles[selectedStyle].fgColor,
          light: qrStyles[selectedStyle].bgColor
        }
      }, (err) => {
        if (err) console.error(err);
      });
    }
  }, [qrData, selectedStyle]);



  // Swipe functionality
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe left - next style
      const styles = Object.keys(qrStyles);
      const currentIndex = styles.indexOf(selectedStyle);
      const nextIndex = currentIndex < styles.length - 1 ? currentIndex + 1 : 0;
      setSelectedStyle(styles[nextIndex]);
    }
    if (isRightSwipe) {
      // Swipe right - previous style
      const styles = Object.keys(qrStyles);
      const currentIndex = styles.indexOf(selectedStyle);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : styles.length - 1;
      setSelectedStyle(styles[prevIndex]);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const styles = Object.keys(qrStyles);
      const currentIndex = styles.indexOf(selectedStyle);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : styles.length - 1;
      setSelectedStyle(styles[prevIndex]);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const styles = Object.keys(qrStyles);
      const currentIndex = styles.indexOf(selectedStyle);
      const nextIndex = currentIndex < styles.length - 1 ? currentIndex + 1 : 0;
      setSelectedStyle(styles[nextIndex]);
    }
  };

  const handleDownload = () => {
    try {
      // Create a canvas from the QR swiper and download it
      const canvas = document.querySelector('.qr-swiper-container canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `${userName || 'User'}-ELEVENGRAM-QR-${selectedStyle}.png`;
        link.href = canvas.toDataURL();
        link.click();

        if (onDownload) {
          onDownload();
        }
      }
    } catch (error) {
      console.error('Error downloading QR code:', error);
      showAlert('Failed to download QR code');
    }
  };

  return (
    <div className="qr-generator-modal">
      <div className="qr-generator-content">
        <div className="qr-generator-header">
          <h3>My QR Code</h3>
          <button className="qr-close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="qr-generator-body">
          {error ? (
            <div className="qr-error">
              <p>{error}</p>
              <button onClick={() => setError(null)}>Try Again</button>
            </div>
          ) : (
            <>
              <div className="qr-style-selector">
                <h4>Swipe for different styles</h4>
                <div className="qr-swiper">
                  <button className="swiper-arrow swiper-prev" onClick={() => {
                    const styles = Object.keys(qrStyles);
                    const currentIndex = styles.indexOf(selectedStyle);
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : styles.length - 1;
                    setSelectedStyle(styles[prevIndex]);
                  }}>
                    ‹
                  </button>

                    <div
                    className="qr-swiper-container"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                  >
                    <div className="qr-swiper-content">
                      <canvas ref={canvasRef} />
                      <div className="qr-style-name">
                        {selectedStyle.charAt(0).toUpperCase() + selectedStyle.slice(1)}
                      </div>
                    </div>
                  </div>

                  <button className="swiper-arrow swiper-next" onClick={() => {
                    const styles = Object.keys(qrStyles);
                    const currentIndex = styles.indexOf(selectedStyle);
                    const nextIndex = currentIndex < styles.length - 1 ? currentIndex + 1 : 0;
                    setSelectedStyle(styles[nextIndex]);
                  }}>
                    ›
                  </button>
                </div>
              </div>

              <div className="qr-actions">
                <button className="qr-download-btn" onClick={handleDownload}>
                  <i className="fas fa-download"></i>
                  Download QR
                </button>
                <button className="qr-share-btn" onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `${userName} - ELEVENGRAM Profile`,
                      text: `Connect with ${userName} on ELEVENGRAM!`,
                      url: `${window.location.origin}/shared-profile.html?userId=${userId}`
                    });
                  } else {
                    navigator.clipboard.writeText(`${window.location.origin}/shared-profile.html?userId=${userId}`)
                      .then(() => showAlert('Profile link copied to clipboard!'));
                  }
                }}>
                  <i className="fas fa-share"></i>
                  Share Link
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;