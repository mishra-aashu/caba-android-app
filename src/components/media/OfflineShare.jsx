import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Share2, 
  Upload, 
  Download, 
  Wifi, 
  Smartphone, 
  Check, 
  X, 
  Camera, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle,
  File, 
  AlertCircle,
  Image,
  Video,
  Music,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

import { useOfflineShare } from '../../hooks/media/useOfflineShare';
import { isNativeWithPlugins, safePluginCall } from '../../utils/platformCheck';
import QRCodeScanner from '../qr/QRCodeScanner';
import './OfflineShare.css';

// Synthesize premium UI sound effects using Web Audio API (100% offline, 0KB asset weight!)
const playSynthSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'connect') {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'sine';
      osc2.type = 'triangle';
      
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      
      osc2.frequency.setValueAtTime(261.63, now);
      osc2.frequency.exponentialRampToValueAtTime(440, now + 0.15);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } else if (type === 'success') {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      gain.connect(ctx.destination);
      
      const playTone = (freq, time, duration) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.connect(gain);
        osc.start(time);
        osc.stop(time + duration);
      };
      
      playTone(523.25, now, 0.12);
      playTone(659.25, now + 0.08, 0.12);
      playTone(783.99, now + 0.16, 0.12);
      playTone(1046.50, now + 0.24, 0.35);
    }
  } catch (e) {
    console.warn('📡 [OfflineShare] Sound synthesis bypassed:', e);
  }
};

const OfflineShare = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const {
    connectionState,
    activeRole,
    localOffer,
    localAnswer,
    progress,
    transferRate,
    estimatedTime,
    fileMeta,
    receivedFileBlob,
    error,
    startSending,
    acceptReceiverAnswer,
    startReceiving,
    cleanup
  } = useOfflineShare();

  const [selectedFiles, setSelectedFiles] = useState([]);
  const selectedFile = selectedFiles[0] || null;
  const [showScanner, setShowScanner] = useState(false);
  const [scannerPurpose, setScannerPurpose] = useState(null);
  const [manualInputOpen, setManualInputOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [imageUrls, setImageUrls] = useState({});

  // Generate object URLs for image previews safely with cleanup to prevent memory leaks
  useEffect(() => {
    const newUrls = {};
    const oldUrls = { ...imageUrls };

    selectedFiles.forEach((file, index) => {
      const key = `${file.name}-${file.size}-${index}`;
      if (file && typeof window !== 'undefined' && window.File && file instanceof window.File && file.type.startsWith('image/')) {
        if (oldUrls[key]) {
          newUrls[key] = oldUrls[key];
          delete oldUrls[key];
        } else {
          newUrls[key] = URL.createObjectURL(file);
        }
      } else if (file.type?.startsWith('image/') || file.name?.match(/\.(png|jpe?g|gif|webp)$/i)) {
        newUrls[key] = file.uri || file.path || null;
      }
    });

    // Revoke old unused object URLs
    Object.values(oldUrls).forEach(url => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    setImageUrls(newUrls);

    return () => {
      Object.values(newUrls).forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [selectedFiles]);

  // Helper to render high-fidelity file previews and type-colored premium icons
  const renderFileThumbnail = (fileObj, metaObj, index = 0) => {
    const fileName = fileObj?.name || metaObj?.name || '';
    const key = `${fileName}-${fileObj?.size || metaObj?.size || 0}-${index}`;
    const localUrl = imageUrls[key];

    // 1. If we have a local object URL (sender side preview)
    if (localUrl && fileObj) {
      return (
        <div className="file-thumbnail-icon image-preview">
          <img src={localUrl} alt="" className="file-image-thumb" />
        </div>
      );
    }

    // 2. Identify the file type from object or metadata name
    const isImg = fileName.match(/\.(png|jpe?g|gif|webp|svg)$/i);
    const isVideo = fileName.match(/\.(mp4|webm|mkv|mov|avi)$/i);
    const isAudio = fileName.match(/\.(mp3|wav|ogg|m4a|aac)$/i);
    const isPdf = fileName.match(/\.pdf$/i);

    if (isImg) {
      return (
        <div className="file-thumbnail-icon img-type">
          <Image size={20} />
        </div>
      );
    }
    if (isVideo) {
      return (
        <div className="file-thumbnail-icon video-type">
          <Video size={20} />
        </div>
      );
    }
    if (isAudio) {
      return (
        <div className="file-thumbnail-icon audio-type">
          <Music size={20} />
        </div>
      );
    }
    if (isPdf) {
      return (
        <div className="file-thumbnail-icon pdf-type">
          <FileText size={20} />
        </div>
      );
    }

    return (
      <div className="file-thumbnail-icon default-type">
        <File size={20} />
      </div>
    );
  };

  // 📡 Auto-start when navigated here from Android share intent
  useEffect(() => {
    const { incomingFile, autoStart } = location.state || {};
    if (incomingFile && autoStart && connectionState === 'idle') {
      setSelectedFiles([incomingFile]);
      // Small delay to let the component mount completely before starting P2P
      const timer = setTimeout(() => {
        startSending([incomingFile]);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, []); // Run once on mount only

  // Audio & complete triggers
  useEffect(() => {
    if (connectionState === 'connected') {
      playSynthSound('connect');
      toast.success('Offline P2P Tunnel Established!', { icon: '⚡' });
    } else if (connectionState === 'completed') {
      playSynthSound('success');
      toast.success('Transfer Successful!', { icon: '🎉' });
    }
  }, [connectionState]);

  // QR Code Renderer
  useEffect(() => {
    if (canvasRef.current && (localOffer || localAnswer)) {
      const dataToEncode = localOffer || localAnswer;
      import('qrcode')
        .then((qrcode) => {
          qrcode.toCanvas(
            canvasRef.current,
            dataToEncode,
            {
              width: 240,
              margin: 1.5,
              color: {
                dark: '#0f172a', // Deep dark slate
                light: '#ffffff'
              }
            },
            (err) => {
              if (err) console.error('📡 [OfflineShare] QR Generation error:', err);
            }
          );
        })
        .catch((err) => {
          console.error('📡 [OfflineShare] Dynamic QR library load failed:', err);
        });
    }
  }, [localOffer, localAnswer]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleStartSending = () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file to share.');
      return;
    }
    startSending(selectedFiles);
  };

  const handleStartReceiving = () => {
    setScannerPurpose('offer');
    setShowScanner(true);
  };

  const handleQRScan = (scannedData) => {
    setShowScanner(false);
    
    // Support either decoded raw object, string, or typical caba payload
    let payloadStr = scannedData;
    if (typeof scannedData === 'object' && scannedData.url) {
      payloadStr = scannedData.url;
    } else if (typeof scannedData === 'object') {
      payloadStr = JSON.stringify(scannedData);
    }

    if (scannerPurpose === 'offer') {
      // Receiver parses the sender's offer
      startReceiving(payloadStr);
    } else if (scannerPurpose === 'answer') {
      // Sender parses the receiver's answer
      acceptReceiverAnswer(payloadStr);
    }
  };

  const handleManualConnectSubmit = () => {
    if (!manualCode.trim()) return;

    if (activeRole === 'sender') {
      acceptReceiverAnswer(manualCode.trim());
    } else {
      startReceiving(manualCode.trim());
    }
    setManualCode('');
    setManualInputOpen(false);
  };

  const saveFile = async () => {
    if (!receivedFileBlob) return;

    const filesToSave = Array.isArray(receivedFileBlob)
      ? receivedFileBlob
      : [{ name: fileMeta?.name || 'downloaded_file', blob: receivedFileBlob }];

    for (let i = 0; i < filesToSave.length; i++) {
      const { name: filename, blob: fileBlob } = filesToSave[i];

      if (isNativeWithPlugins()) {
        try {
          await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64data = reader.result.split(',')[1];
              try {
                await safePluginCall(
                  () => import('@capacitor/filesystem'),
                  (mod) => mod.Filesystem.writeFile({
                    path: `CaBa/Downloads/${filename}`,
                    data: base64data,
                    directory: mod.Directory.Data,
                    recursive: true
                  })
                );
                toast.success(`Saved to device: CaBa/Downloads/${filename}`, { duration: 4000 });
                resolve();
              } catch (e) {
                reject(e);
              }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(fileBlob);
          });
        } catch (err) {
          console.error('📡 [OfflineShare] Native save failed, falling back:', err);
          triggerBrowserDownloadForBlob(fileBlob, filename);
        }
      } else {
        triggerBrowserDownloadForBlob(fileBlob, filename);
      }
    }
  };

  const triggerBrowserDownloadForBlob = (fileBlob, filename) => {
    const url = URL.createObjectURL(fileBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded: ${filename}`);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    const gb = mb / 1024;
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    if (kb >= 1) return `${kb.toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec === Infinity) return '0.00 MB/s';
    const mb = bytesPerSec / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB/s`;
    const kb = bytesPerSec / 1024;
    return `${kb.toFixed(2)} KB/s`;
  };

  const formatTime = (secs) => {
    if (secs === Infinity || isNaN(secs)) return 'estimating...';
    if (secs <= 0) return '0s';
    if (secs < 60) return `${Math.ceil(secs)}s remaining`;
    const mins = Math.floor(secs / 60);
    const rem = Math.ceil(secs % 60);
    return `${mins}m ${rem}s remaining`;
  };

  const handleCopyCode = () => {
    const textToCopy = localOffer || localAnswer;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      toast.success('Connection handshake copied to clipboard!');
    }
  };

  return (
    <div className="offline-share-container">
      {/* 📡 Header Area */}
      <header className="share-header">
        <button className="share-back-btn" onClick={() => { cleanup(); navigate('/settings'); }}>
          <ArrowLeft size={20} />
        </button>
        <div className="header-title-area">
          <h1>Direct Offline Share</h1>
          <p>Share files at full Wi-Fi speed without internet</p>
        </div>
      </header>

      {/* 📡 Glass Card Interface */}
      <div className="share-card">
        {/* Connection status banner pill */}
        {connectionState !== 'idle' && (
          <div className={`status-pill-banner ${
            connectionState === 'connected' || connectionState === 'completed' ? 'connected' : 'connecting'
          }`}>
            <span className={`status-indicator-dot ${connectionState === 'transferring' ? 'pulse' : ''}`} />
            {connectionState.toUpperCase()}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* 1. SELECTION / PRE-FLIGHT STATE */}
          {connectionState === 'idle' && (
            <motion.div
              key="pre-flight"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              style={{ width: '100%' }}
            >
              {/* Pulsating animation searching */}
              <div className="searching-waves-container">
                <div className="pulse-wave w1" />
                <div className="pulse-wave w2" />
                <div className="pulse-wave w3" />
                <div className="searching-icon-core">
                  <Wifi size={32} />
                </div>
              </div>

              {/* Instructions Panel */}
              <div className="offline-instructions">
                <div className="instruction-step">
                  <span className="step-num">1</span>
                  <span className="step-text">One device creates a <strong>Portable Wi-Fi Hotspot</strong> (Android Settings).</span>
                </div>
                <div className="instruction-step">
                  <span className="step-num">2</span>
                  <span className="step-text">The other device connects to that Wi-Fi network (No internet required!).</span>
                </div>
                <div className="instruction-step">
                  <span className="step-num">3</span>
                  <span className="step-text">Open this page on both devices, select Send or Receive, and scan the QR!</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="share-action-grid">
                <div className="action-card" onClick={() => fileInputRef.current?.click()}>
                  <div className="action-icon-wrapper">
                    <Upload size={22} />
                  </div>
                  <h3>Send File</h3>
                  <p>Choose photos, videos, or big files</p>
                </div>

                <div className="action-card" onClick={handleStartReceiving}>
                  <div className="action-icon-wrapper">
                    <Download size={22} />
                  </div>
                  <h3>Receive File</h3>
                  <p>Scan a sender to start getting file</p>
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {/* File box after selection */}
              {selectedFiles && selectedFiles.length > 0 && (
                <div className="selected-files-list" style={{ marginTop: '20px', width: '100%' }}>
                  <div className="files-scroll-area" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                    {selectedFiles.map((file, idx) => (
                      <div className="selected-file-box" key={idx} style={{ marginBottom: '0', display: 'flex', flexDirection: 'column' }}>
                        {renderFileThumbnail(file, null, idx)}
                        <div className="selected-file-details-row">
                          <div className="selected-file-details">
                            <h4>{file.name}</h4>
                            <p>{formatSize(file.size)}</p>
                          </div>
                          <button className="file-remove-btn" onClick={() => handleRemoveFile(idx)} aria-label="Remove file">
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary Bar */}
                  <div className="selected-files-summary-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                      <strong>{selectedFiles.length}</strong> {selectedFiles.length === 1 ? 'file' : 'files'} ({formatSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))})
                    </div>
                    <button 
                      className="btn-add-more-glass" 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.2)', padding: '6px 12.5px', borderRadius: '8px', fontSize: '12px', color: '#f8fafc', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      + Add More
                    </button>
                  </div>
                </div>
              )}

              {/* Trigger send button */}
              {selectedFiles.length > 0 && (
                <button
                  className="camera-trigger-btn"
                  onClick={handleStartSending}
                  style={{ marginTop: '20px' }}
                >
                  <Share2 size={18} />
                  Start P2P Send
                </button>
              )}
            </motion.div>
          )}

          {/* 2. SENDER: GENERATING OFFER QR */}
          {connectionState === 'preparing' && activeRole === 'sender' && (
            <motion.div
              key="preparing-sender"
              className="transferring-core"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="searching-waves-container">
                <div className="pulse-wave w1" />
                <div className="searching-icon-core" style={{ color: '#00f2fe', borderColor: '#00f2fe' }}>
                  <Share2 className="animate-spin" size={30} />
                </div>
              </div>
              <h3>Preparing secure P2P tunnel...</h3>
              <p className="qr-instructions-text">Setting up local WebRTC connection channels and pruning candidates...</p>
            </motion.div>
          )}

          {/* 3. SENDER: OFFERING (SHOW QR) */}
          {connectionState === 'offering' && activeRole === 'sender' && (
            <motion.div
              key="offering-sender"
              className="qr-display-container"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <h3>Scan to Connect</h3>
              <p className="qr-instructions-text" style={{ marginBottom: '14px' }}>
                Show this QR Code to the <strong>Receiver</strong>. They should click <strong>Receive</strong> and scan it.
              </p>
              
              <div className="qr-glow-wrapper">
                <canvas ref={canvasRef} />
              </div>

              <div className="selected-file-box" style={{ width: '100%', marginBottom: '16px' }}>
                {renderFileThumbnail(selectedFile, fileMeta)}
                <div className="selected-file-details-row">
                  <div className="selected-file-details">
                    <h4>{fileMeta?.name}</h4>
                    <p>{formatSize(fileMeta?.size)}</p>
                  </div>
                </div>
              </div>

              <button
                className="camera-trigger-btn"
                onClick={() => {
                  setScannerPurpose('answer');
                  setShowScanner(true);
                }}
              >
                <Camera size={18} />
                Scan Receiver's Answer
              </button>

              <button className="btn-glass" onClick={() => setManualInputOpen(!manualInputOpen)} style={{ marginTop: '10px' }}>
                Manual Handshake Connection
              </button>
            </motion.div>
          )}

          {/* 4. RECEIVER: WAITING OR SCANNING ANSWER GENERATION */}
          {connectionState === 'preparing' && activeRole === 'receiver' && (
            <motion.div
              key="preparing-receiver"
              className="transferring-core"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="searching-waves-container">
                <div className="pulse-wave w1" />
                <div className="searching-icon-core" style={{ color: '#00f2fe', borderColor: '#00f2fe' }}>
                  <Share2 className="animate-spin" size={30} />
                </div>
              </div>
              <h3>Generating tunnel response...</h3>
              <p className="qr-instructions-text">Setting up remote descriptors and generating local ICE candidate maps...</p>
            </motion.div>
          )}

          {/* 5. RECEIVER: SCANNING / DISPLAY ANSWER QR */}
          {connectionState === 'scanning' && activeRole === 'receiver' && (
            <motion.div
              key="scanning-receiver"
              className="qr-display-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h3>Scan Answer Back</h3>
              <p className="qr-instructions-text">
                Now show this Answer QR code back to the <strong>Sender</strong> so they can verify the handshake and open the tunnel.
              </p>

              <div className="qr-glow-wrapper">
                <canvas ref={canvasRef} />
              </div>

              <div className="selected-file-box" style={{ width: '100%', marginBottom: '16px' }}>
                {renderFileThumbnail(selectedFile, fileMeta)}
                <div className="selected-file-details-row">
                  <div className="selected-file-details">
                    <h4>Incoming File Connection</h4>
                    <p>{fileMeta?.name} ({formatSize(fileMeta?.size)})</p>
                  </div>
                </div>
              </div>

              <button className="btn-glass" onClick={() => setManualInputOpen(!manualInputOpen)}>
                Manual Handshake Connection
              </button>
            </motion.div>
          )}

          {/* 6. CONNECTING STAGE */}
          {connectionState === 'connecting' && (
            <motion.div
              key="connecting"
              className="transferring-core"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="searching-waves-container">
                <div className="pulse-wave w1" />
                <div className="pulse-wave w2" />
                <div className="searching-icon-core" style={{ color: '#3aeda2', borderColor: '#3aeda2' }}>
                  <Smartphone className="animate-pulse" size={32} />
                </div>
              </div>
              <h3>Establishing Secure Tunnel...</h3>
              <p className="qr-instructions-text">Matching keys and connecting directly over local Wi-Fi chips...</p>
            </motion.div>
          )}

          {/* 7. TRANSFERRING DATA CHUNKS */}
          {connectionState === 'transferring' && (
            <motion.div
              key="transferring"
              className="transferring-core"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <h3>{activeRole === 'sender' ? 'Sending File...' : 'Receiving File...'}</h3>
              
              <div className="speed-counter-glow">
                <h2 className="speed-value-big">
                  {formatSpeed(transferRate).split(' ')[0]}
                  <span className="speed-unit">{formatSpeed(transferRate).split(' ')[1]}</span>
                </h2>
                <p className="estimated-time-label">{formatTime(estimatedTime)}</p>
              </div>

              <div className="progress-track-wrapper">
                <div className="progress-track-fill" style={{ width: `${progress}%` }} />
                <div className="progress-text-overlay">{progress}%</div>
              </div>

              <div className="selected-file-box" style={{ width: '100%', marginBottom: '0' }}>
                {renderFileThumbnail(selectedFile, fileMeta)}
                <div className="selected-file-details-row">
                  <div className="selected-file-details">
                    <h4>{fileMeta?.name}</h4>
                    <p>{formatSize(fileMeta?.size)}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 8. COMPLETED STATE */}
          {connectionState === 'completed' && (
            <motion.div
              key="completed"
              className="success-core"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="success-check-icon">
                <Check size={40} />
              </div>
              <h2>Transfer Completed!</h2>
              <p>{activeRole === 'sender' ? 'The file was sent successfully!' : 'The file has been received successfully!'}</p>

              <div className="success-file-card">
                {fileMeta?.files && fileMeta.files.length > 1 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px', marginBottom: '4px' }}>
                      TRANSFERRED FILES ({fileMeta.files.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }} className="files-scroll-area">
                      {fileMeta.files.map((file, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontSize: '12px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%', fontWeight: '600' }}>
                            {file.name}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {formatSize(file.size)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', marginTop: '4px', fontSize: '12px', fontWeight: '700' }}>
                      <span style={{ color: '#cbd5e1' }}>Total Combined Size:</span>
                      <span style={{ color: '#00f2fe' }}>{formatSize(fileMeta.size)}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="success-file-row">
                      <span className="success-file-label">Name:</span>
                      <span className="success-file-value">{fileMeta?.name}</span>
                    </div>
                    <div className="success-file-row">
                      <span className="success-file-label">Size:</span>
                      <span className="success-file-value">{formatSize(fileMeta?.size)}</span>
                    </div>
                    <div className="success-file-row">
                      <span className="success-file-label">Role:</span>
                      <span className="success-file-value" style={{ textTransform: 'capitalize' }}>{activeRole}</span>
                    </div>
                  </>
                )}
              </div>

              {activeRole === 'receiver' && receivedFileBlob && (
                <button className="camera-trigger-btn" onClick={saveFile} style={{ marginBottom: '10px' }}>
                  <Download size={18} />
                  Save / Download Files
                </button>
              )}

              <button className="btn-glass" onClick={() => { cleanup(); setSelectedFiles([]); }}>
                Share Another File
              </button>
            </motion.div>
          )}

          {/* 9. FAILED STATE */}
          {connectionState === 'failed' && (
            <motion.div
              key="failed"
              className="success-core"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="success-check-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)', boxShadow: '0 0 25px rgba(239, 68, 68, 0.2)' }}>
                <AlertCircle size={40} />
              </div>
              <h2 style={{ color: '#ef4444' }}>Transfer Failed</h2>
              <p style={{ color: '#cbd5e1', marginBottom: '24px' }}>{error || 'Connection timed out or lost. Please try again.'}</p>

              <button className="camera-trigger-btn" onClick={() => { cleanup(); setSelectedFiles([]); }} style={{ background: 'rgba(255,255,255,0.06)', color: 'white', boxShadow: 'none' }}>
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Accordion for Manual connection string input */}
        {manualInputOpen && (localOffer || localAnswer || activeRole) && (
          <div className="fallback-textarea-container">
            <hr style={{ width: '100%', border: '0', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '16px 0' }} />
            <p>Paste peer handshake connection code below:</p>
            <textarea
              className="fallback-input-field"
              placeholder="Paste connection code from other device here..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button 
                className="camera-trigger-btn" 
                onClick={handleManualConnectSubmit} 
                style={{ flex: 1, margin: 0, padding: '10px' }}
                disabled={!manualCode.trim()}
              >
                Connect
              </button>
              {(localOffer || localAnswer) && (
                <button 
                  className="btn-glass" 
                  onClick={handleCopyCode} 
                  style={{ flex: 1, padding: '10px' }}
                >
                  <Copy size={16} /> Copy Code
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🎥 Embedded Camera QR Reader Modal */}
      {showScanner && (
        <QRCodeScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
          onError={(err) => {
            console.error('Scan error:', err);
            toast.error(err?.message || 'Failed to open device camera. Use manual handshake.');
            setShowScanner(false);
          }}
        />
      )}
    </div>
  );
};

export default OfflineShare;
