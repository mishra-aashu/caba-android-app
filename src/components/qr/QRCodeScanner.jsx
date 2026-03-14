import React, { useEffect, useRef, useState } from 'react';
import { X, RotateCcw, Upload, Camera, QrCode, Lightbulb, Hand, Square } from 'lucide-react';
import './QRCodeScanner.css';

const QRCodeScanner = ({ onScan, onClose, onError }) => {
  const videoRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const isScanningRef = useRef(false);

  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, []);

  const initializeScanner = async () => {
    try {
      if (!('BarcodeDetector' in window)) {
        throw new Error('BarcodeDetector API is not supported by your browser. Please use the image upload option.');
      }
      
      setError('');
      setIsScanning(true);
      isScanningRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", true);
        await videoRef.current.play();
        requestAnimationFrame(tick);
      }
    } catch (err) {
      console.error('Error initializing QR scanner:', err);
      setError(err.message || 'Failed to initialize camera. Please check camera permissions.');
      setIsScanning(false);
      isScanningRef.current = false;
      if (onError) {
        onError(err);
      }
    }
  };

  const handleScanSuccess = (decodedText) => {
    try {
      cleanupScanner();
      
      let scannedData;
      try {
        scannedData = JSON.parse(decodedText);
      } catch (e) {
        scannedData = { type: 'url', url: decodedText };
      }

      if (onScan) {
        onScan(scannedData);
      }
    } catch (error) {
      console.error('Error processing QR scan result:', error);
      setError('Invalid QR code format');
    }
  };

  const tick = async () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      try {
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await barcodeDetector.detect(videoRef.current);
        if (barcodes.length > 0) {
          handleScanSuccess(barcodes[0].rawValue);
          return;
        }
      } catch (e) {
        // softly ignore errors during continuous detection
      }
    }
    
    if (isScanningRef.current) {
      requestAnimationFrame(tick);
    }
  };

  const cleanupScanner = () => {
    isScanningRef.current = false;
    setIsScanning(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        setError('');
        
        if (!('BarcodeDetector' in window)) {
          throw new Error('BarcodeDetector API is not supported by your browser.');
        }

        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const barcodes = await barcodeDetector.detect(img);
        if (barcodes.length > 0) {
          handleScanSuccess(barcodes[0].rawValue);
        } else {
          setError('No QR code found in the image.');
        }
      } catch (error) {
        console.error('Error scanning uploaded file:', error);
        setError(error.message || 'Failed to scan QR code from image.');
      }
    }
  };

  return (
    <div className="qr-scanner-modal">
      <div className="qr-scanner-content">
        <div className="qr-scanner-header">
          <h3>Scan QR Code</h3>
          <button className="qr-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="qr-scanner-body">
          {error ? (
            <div className="qr-error">
              <div className="error-icon">⚠️</div>
              <p>{error}</p>
              <button className="qr-retry-btn" onClick={initializeScanner}>
                <RotateCcw size={18} />
                Try Again
              </button>
              <div className="qr-alternative" style={{ marginTop: '20px' }}>
                <span>or</span>
                <label className="qr-upload-btn">
                  <Upload size={18} />
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
          ) : !isScanning ? (
            <div className="qr-start-section">
              <div className="qr-start-icon">
                <Camera size={48} />
              </div>
              <p>Scan QR codes to connect with ELEVENGRAM users</p>
              <button className="qr-start-btn" onClick={initializeScanner}>
                <QrCode size={18} />
                Start Scanning
              </button>
              <div className="qr-alternative">
                <span>or</span>
                <label className="qr-upload-btn">
                  <Upload size={18} />
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
                <video 
                  id="qr-reader" 
                  ref={videoRef} 
                  className="qr-reader" 
                  style={{ width: '100%', borderRadius: '15px', objectFit: 'cover' }} 
                />
              </div>

              <div className="qr-scanner-info">
                <p>Position the QR code within the frame</p>
                <div className="qr-scanner-tips">
                  <div className="tip">
                    <Lightbulb size={16} />
                    <span>Ensure good lighting</span>
                  </div>
                  <div className="tip">
                    <Hand size={16} />
                    <span>Hold steady</span>
                  </div>
                </div>
              </div>

              <div className="qr-scanner-actions">
                <button className="qr-stop-btn" onClick={() => {
                  cleanupScanner();
                  setIsScanning(false);
                }}>
                  <Square size={18} />
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