import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Video, X, Paperclip } from 'lucide-react';
import './AttachmentMenu.css';

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

  // Debug: Add console log to check if component is being called
  React.useEffect(() => {
    console.log('AttachmentMenu isOpen:', isOpen);
  }, [isOpen]);

  if (!isOpen) {
    console.log('AttachmentMenu: Returning null because isOpen is false');
    return null;
  }

  console.log('AttachmentMenu: Rendering popup');
  return (
    <AnimatePresence>
      <motion.div 
        className="attachment-menu-modal"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="attachment-menu-header">
          <h3>Attach</h3>
          <motion.button 
            onClick={onClose} 
            className="close-btn"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <X size={18} />
          </motion.button>
        </div>
        
        <div className="attachment-options">
          <motion.div 
            className="attachment-option" 
            onClick={() => handleIconClick('image/*')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="icon-wrapper photo-option">
              <Image size={20} />
            </div>
            <span>Photo</span>
          </motion.div>
        
          <motion.div 
            className="attachment-option" 
            onClick={() => handleIconClick('video/*')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="icon-wrapper video-option">
              <Video size={20} />
            </div>
            <span>Video</span>
          </motion.div>
        
          <motion.div 
            className="attachment-option" 
            onClick={() => { onQuickSelect && onQuickSelect(); onClose(); }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="icon-wrapper quick-option">
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
    </AnimatePresence>
  );
};

export default AttachmentMenu;