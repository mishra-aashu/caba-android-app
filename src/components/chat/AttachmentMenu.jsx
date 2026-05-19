import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Image, Video, Camera, MapPin, User, FileText, Music, Share2 } from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';

import { toast } from 'react-hot-toast';
import styles from './AttachmentMenu.module.css';
import hapticsManager from '../../utils/hapticsManager';
import { useDialog } from '../../contexts/DialogContext';

const AttachmentMenu = ({ isOpen, onClose, onFileSelect }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const { togglePanel } = useMusicStore();
  const { showConfirm } = useDialog();


  const handleOptionClick = (type) => {
    hapticsManager.impact();
    if (type === 'gallery') {
      fileInputRef.current.click();
    } else if (type === 'camera') {
      cameraInputRef.current.click();
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // More than 5MB
        onClose();
        const useOffline = await showConfirm(
          `Large file detected (${(file.size / (1024 * 1024)).toFixed(1)} MB).\n\nTransfer Options:\n• ShareMe (Offline): Blazing fast transfer speeds. Requires friend to be physically next to you.\n• Chat (Online): Normal upload via internet connection. Works from anywhere.\n\nWhich transfer method do you prefer?`,
          {
            title: 'Choose Transfer Method',
            confirmText: 'Use ShareMe',
            cancelText: 'Send Online'
          }
        );
        if (useOffline) {
          navigate('/offline-share', { state: { incomingFile: file, autoStart: true } });
          return;
        }
      }
      onFileSelect(file);
    }
    event.target.value = null;
    onClose();
  };

  const handleShareMeClick = async () => {
    hapticsManager.impact();
    onClose();
    const confirmed = await showConfirm(
      "ShareMe transfers files offline with nearby friends.\n\nRequirements:\n• Friend must be physically next to you.\n• Connected to the same Wi-Fi network or mobile hotspot.\n• 100% Offline transfer (no internet data used).\n\nDo you want to open ShareMe now?",
      {
        title: "Offline ShareMe",
        confirmText: "Open ShareMe",
        cancelText: "Cancel"
      }
    );
    if (confirmed) {
      navigate('/offline-share');
    }
  };

  const handleMockAction = (label) => {
    hapticsManager.impact();
    console.log(`[AttachmentMenu] ${label} clicked (mock)`);
    onClose();
  };

  const handleComingSoon = (label) => {
    hapticsManager.impact();
    toast.success(`${label} coming soon!`, {
      icon: '🚀',
      style: {
        borderRadius: '12px',
        background: '#333',
        color: '#fff',
      },
    });
    onClose();
  };

  const options = [
    { icon: <Image size={24} />, label: 'Gallery', onClick: () => handleOptionClick('gallery'), color: styles['photo-option'] },
    { icon: <Camera size={24} />, label: 'Camera', onClick: () => handleOptionClick('camera'), color: styles['camera-option'] },
    { icon: <Video size={24} />, label: 'Video', onClick: () => handleOptionClick('gallery'), color: styles['video-option'] }, // Video also uses gallery for now
    { icon: <FileText size={24} />, label: 'File', onClick: () => handleOptionClick('gallery'), color: styles['file-option'] },
    { icon: <Share2 size={24} />, label: 'ShareMe', onClick: handleShareMeClick, color: styles['shareme-option'] },
    { icon: <MapPin size={24} />, label: 'Location', onClick: () => handleComingSoon('Location'), color: styles['location-option'] },
    { icon: <User size={24} />, label: 'Contact', onClick: () => handleComingSoon('Contact'), color: styles['contact-option'] },
    { icon: <Music size={24} />, label: 'Music', onClick: () => { navigate('/listen-together'); onClose(); }, color: styles['music-option'] },
  ];


  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className={styles['attachment-menu-overlay']}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className={styles['attachment-menu-modal']}
            initial={{ opacity: 0, scale: 0.8, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <div className={styles['attachment-menu-grid']}>
              {options.map((opt, i) => (
                <motion.div
                  key={opt.label}
                  className={styles['attachment-option']}
                  onClick={opt.onClick}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className={`${styles['icon-wrapper']} ${opt.color}`}>
                    {opt.icon}
                  </div>
                  <span>{opt.label}</span>
                </motion.div>
              ))}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
            />

            <input
              type="file"
              ref={cameraInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AttachmentMenu;