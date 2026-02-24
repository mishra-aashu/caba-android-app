import React, { useRef } from 'react';
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
    <div className="attachment-menu-modal">
      <div className="attachment-menu-header">
        <h3>Attach</h3>
        <button onClick={onClose} className="close-btn">
          <X size={18} />
        </button>
      </div>
      
      <div className="attachment-options">
        <div className="attachment-option" onClick={() => handleIconClick('image/*')}>
          <div className="icon-wrapper photo-option">
            <Image size={20} />
          </div>
          <span>Photo</span>
        </div>
        
        <div className="attachment-option" onClick={() => handleIconClick('video/*')}>
          <div className="icon-wrapper video-option">
            <Video size={20} />
          </div>
          <span>Video</span>
        </div>
        
        <div className="attachment-option" onClick={() => { onQuickSelect && onQuickSelect(); onClose(); }}>
          <div className="icon-wrapper quick-option">
            <Paperclip size={20} />
          </div>
          <span>File</span>
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