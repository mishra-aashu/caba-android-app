import React from 'react';
import { X, Video as VideoIcon, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '../../../styles/chat.module.css';

const MediaPreview = ({ filePreview, onRemove }) => {
  return (
    <AnimatePresence>
      {filePreview && (
        <motion.div 
          className={styles['file-preview-container']}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className={styles['file-preview-glass']}>
            <div className={styles['file-preview-content']}>
              {filePreview.fileType === 'image' ? (
                <img src={filePreview.previewUrl} alt="preview" className={styles['preview-image']} />
              ) : filePreview.fileType === 'video' ? (
                <div className={styles['video-preview-box']}>
                  <VideoIcon size={32} />
                  <span>Video Preview</span>
                </div>
              ) : (
                <div className={styles['file-preview-box']}>
                  <FileText size={32} />
                  <span className={styles['file-name-preview']}>{filePreview.file?.name}</span>
                </div>
              )}
              <button 
                className={styles['remove-file-btn-premium']} 
                onClick={onRemove}
                title="Remove"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MediaPreview;
