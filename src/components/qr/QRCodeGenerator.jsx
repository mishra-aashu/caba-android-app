import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import './QRCodeGenerator.css';

const QRCodeGenerator = ({ userId, userName, userPhone, onDownload, onClose }) => {
  const [qrDataURL, setQrDataURL] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    generateQRCode();
  }, [userId, userName, userPhone]);

  const generateQRCode = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!userId) {
        throw new Error('User ID is required');
      }

      const profileUrl = `https://mishra-aashu.github.io/CaBa/shared-profile.html?userId=${userId}`;

      console.log('Generating QR code with URL:', profileUrl);

      const dataURL = await QRCode.toDataURL(profileUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrDataURL(dataURL);
      setLoading(false);

    } catch (error) {
      console.error('Error generating QR code:', error);
      setError('Failed to generate QR code. Please try again.');
      setLoading(false);
    }
  };

  const handleDownload = () => {
    try {
      if (qrDataURL) {
        const link = document.createElement('a');
        link.download = `${userName || 'User'}-CaBa-QR.png`;
        link.href = qrDataURL;
        link.click();

        if (onDownload) {
          onDownload();
        }
      }
    } catch (error) {
      console.error('Error downloading QR code:', error);
      alert('Failed to download QR code');
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
          {loading ? (
            <div className="qr-loading">
              <div className="spinner"></div>
              <p>Generating QR Code...</p>
            </div>
          ) : error ? (
            <div className="qr-error">
              <p>{error}</p>
              <button onClick={generateQRCode}>Try Again</button>
            </div>
          ) : (
            <>
              <div className="qr-canvas-container">
                <img
                  src={qrDataURL}
                  alt="QR Code"
                  className="qr-canvas"
                  style={{ width: '256px', height: '256px' }}
                />
              </div>

              <div className="qr-info">
                <p className="qr-title">{userName}</p>
                {userPhone && <p className="qr-phone">📱 {userPhone}</p>}
                <p className="qr-description">
                  Scan this QR code to view my CaBa profile
                </p>
              </div>

              <div className="qr-actions">
                <button className="qr-download-btn" onClick={handleDownload}>
                  <i className="fas fa-download"></i>
                  Download QR
                </button>
                <button className="qr-share-btn" onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `${userName} - CaBa Profile`,
                      text: `Connect with ${userName} on CaBa!`,
                      url: `${window.location.origin}/shared-profile.html?userId=${userId}`
                    });
                  } else {
                    navigator.clipboard.writeText(`${window.location.origin}/shared-profile.html?userId=${userId}`)
                      .then(() => alert('Profile link copied to clipboard!'));
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