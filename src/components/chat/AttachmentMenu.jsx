import React, { useRef } from 'react';
import { Image, Video, X, MessageSquarePlus } from 'lucide-react';
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
    // Reset the input value to allow selecting the same file again
    event.target.value = null;
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="attachment-menu-modal">
      <div className="attachment-menu-header">
        <h3>Attach</h3>
        <button onClick={onClose} className="close-btn"><X size={20} /></button>
      </div>
      <div className="attachment-options">
        <div className="attachment-option" onClick={() => handleIconClick('image/*')}>
          <div className="icon-wrapper photo-option">
            <Image size={24} />
          </div>
          <span>Photo</span>
        </div>
        <div className="attachment-option" onClick={() => handleIconClick('video/*')}>
          <div className="icon-wrapper video-option">
            <Video size={24} />
          </div>
          <span>Video</span>
        </div>
        <div className="attachment-option" onClick={() => { onQuickSelect && onQuickSelect(); onClose(); }}>
          <div className="icon-wrapper quick-option">
            <MessageSquarePlus size={24} />
          </div>
          <span>Quick MSG</span>
        </div>

      </div>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};

export default AttachmentMenu;