import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import './QRCodeScanner.css';

const QRCodeScanner = ({ onScan, onClose, onError }) => {
  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, []);

  const initializeScanner = () => {
    try {
      setError('');
      setIsScanning(true);

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        videoConstraints: {
          facingMode: "environment"
        }
      };

      html5QrcodeScannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        config,
        false
      );

      html5QrcodeScannerRef.current.render(
        (decodedText, decodedResult) => {
          handleScanSuccess(decodedText, decodedResult);
        },
        (errorMessage) => {
          // Ignore frequent scan errors
          if (!errorMessage.includes('No QR code found')) {
            console.warn('QR scan error:', errorMessage);
          }
        }
      );

    } catch (err) {
      console.error('Error initializing QR scanner:', err);
      setError('Failed to initialize camera. Please check camera permissions.');
      setIsScanning(false);
      if (onError) {
        onError(err);
      }
    }
  };

  const handleScanSuccess = (decodedText, decodedResult) => {
    try {
      // Stop scanning immediately
      cleanupScanner();
      setIsScanning(false);

      let scannedData;
      
      try {
        // Try to parse as JSON first (our CaBa QR format)
        scannedData = JSON.parse(decodedText);
      } catch (e) {
        // If not JSON, treat as plain URL
        scannedData = {
          type: 'url',
          url: decodedText
        };
      }

      if (onScan) {
        onScan(scannedData);
      }

    } catch (error) {
      console.error('Error processing QR scan result:', error);
      setError('Invalid QR code format');
    }
  };

  const cleanupScanner = () => {
    if (html5QrcodeScannerRef.current) {
      try {
        html5QrcodeScannerRef.current.clear();
      } catch (error) {
        console.warn('Error cleaning up QR scanner:', error);
      }
      html5QrcodeScannerRef.current = null;
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        setError('');
        setIsScanning(true);

        // Import html5-qrcode for file scanning
        const { Html5Qrcode } = await import('html5-qrcode');

        const html5QrCode = new Html5Qrcode("hidden-qr-reader");

        // Scan the uploaded image
        const qrCodeResult = await html5QrCode.scanFile(file, false);

        // Clean up
        html5QrCode.clear();

        // Process the result
        handleScanSuccess(qrCodeResult, {});

      } catch (error) {
        console.error('Error scanning uploaded file:', error);
        setError('Failed to scan QR code from image. Please ensure the image contains a valid QR code.');
        setIsScanning(false);
      }
    }
  };

  return (
    <div className="qr-scanner-modal">
      {/* Hidden element for file scanning */}
      <div id="hidden-qr-reader" style={{ display: 'none' }}></div>

      <div className="qr-scanner-content">
        <div className="qr-scanner-header">
          <h3>Scan QR Code</h3>
          <button className="qr-close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="qr-scanner-body">
          {error ? (
            <div className="qr-error">
              <div className="error-icon">⚠️</div>
              <p>{error}</p>
              <button className="qr-retry-btn" onClick={initializeScanner}>
                <i className="fas fa-redo"></i>
                Try Again
              </button>
            </div>
          ) : !isScanning ? (
            <div className="qr-start-section">
              <div className="qr-start-icon">
                <i className="fas fa-camera"></i>
              </div>
              <p>Scan QR codes to connect with CaBa users</p>
              <button className="qr-start-btn" onClick={initializeScanner}>
                <i className="fas fa-qrcode"></i>
                Start Scanning
              </button>
              <div className="qr-alternative">
                <span>or</span>
                <label className="qr-upload-btn">
                  <i className="fas fa-upload"></i>
                  Upload from Gallery
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <>
              <div className="qr-reader-container">
                <div id="qr-reader" ref={scannerRef} className="qr-reader"></div>
              </div>

              <div className="qr-scanner-info">
                <p>Position the QR code within the frame</p>
                <div className="qr-scanner-tips">
                  <div className="tip">
                    <i className="fas fa-lightbulb"></i>
                    <span>Ensure good lighting</span>
                  </div>
                  <div className="tip">
                    <i className="fas fa-hand-paper"></i>
                    <span>Hold steady</span>
                  </div>
                </div>
              </div>

              <div className="qr-scanner-actions">
                <button className="qr-stop-btn" onClick={() => {
                  cleanupScanner();
                  setIsScanning(false);
                }}>
                  <i className="fas fa-stop"></i>
                  Stop Scanning
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanner;