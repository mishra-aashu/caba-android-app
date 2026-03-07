import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Video, X, Paperclip } from 'lucide-react';
import styles from './AttachmentMenu.module.css';

const AttachmentMenu = ({ isOpen, onClose, onFileSelect, onQuickSelect }) => {
  const fileInputRef = useRef(null);

  const handleIconClick = (accept) => {
    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileSelect(file);
    }
    event.target.value = null;
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay/Backdrop to prevent background clicks */}
          <motion.div
            className={styles['attachment-menu-overlay']}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              zIndex: 99,
              backdropFilter: 'blur(2px)'
            }}
          />

          <motion.div
            className={styles['attachment-menu-modal']}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ zIndex: 100 }}
          >
            <div className={styles['attachment-menu-header']}>
              <h3>Attach</h3>
              <motion.button
                onClick={onClose}
                className={styles['close-btn']}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={18} />
              </motion.button>
            </div>

            <div className={styles['attachment-options']}>
              <motion.div
                className={styles['attachment-option']}
                onClick={() => handleIconClick('image/*')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className={`${styles['icon-wrapper']} ${styles['photo-option']}`}>
                  <Image size={20} />
                </div>
                <span>Photo</span>
              </motion.div>

              <motion.div
                className={styles['attachment-option']}
                onClick={() => handleIconClick('video/*')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className={`${styles['icon-wrapper']} ${styles['video-option']}`}>
                  <Video size={20} />
                </div>
                <span>Video</span>
              </motion.div>

              <motion.div
                className={styles['attachment-option']}
                onClick={() => { onQuickSelect && onQuickSelect(); onClose(); }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className={`${styles['icon-wrapper']} ${styles['quick-option']}`}>
                  <Paperclip size={20} />
                </div>
                <span>File</span>
              </motion.div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AttachmentMenu;