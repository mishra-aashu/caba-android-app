import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Video, Camera, MapPin, User, FileText } from 'lucide-react';
import styles from './AttachmentMenu.module.css';
import hapticsManager from '../../utils/hapticsManager';

const AttachmentMenu = ({ isOpen, onClose, onFileSelect }) => {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleOptionClick = (type) => {
    hapticsManager.impact();
    if (type === 'gallery') {
      fileInputRef.current.click();
    } else if (type === 'camera') {
      cameraInputRef.current.click();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileSelect(file);
    }
    event.target.value = null;
    onClose();
  };

  const handleMockAction = (label) => {
    hapticsManager.impact();
    console.log(`[AttachmentMenu] ${label} clicked (mock)`);
    onClose();
  };

  const options = [
    { icon: <Image size={24} />, label: 'Gallery', onClick: () => handleOptionClick('gallery'), color: styles['photo-option'] },
    { icon: <Camera size={24} />, label: 'Camera', onClick: () => handleOptionClick('camera'), color: styles['camera-option'] },
    { icon: <Video size={24} />, label: 'Video', onClick: () => handleOptionClick('gallery'), color: styles['video-option'] }, // Video also uses gallery for now
    { icon: <FileText size={24} />, label: 'File', onClick: () => handleOptionClick('gallery'), color: styles['file-option'] },
    { icon: <MapPin size={24} />, label: 'Location', onClick: () => handleMockAction('Location'), color: styles['location-option'] },
    { icon: <User size={24} />, label: 'Contact', onClick: () => handleMockAction('Contact'), color: styles['contact-option'] },
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