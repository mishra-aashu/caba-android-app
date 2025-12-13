import React from 'react';
import './AttachmentMenu.css';

const AttachmentMenu = ({ isVisible, onClose, onFileSelect }) => {
  
  const attachmentOptions = [
    { id: 'camera', name: 'Camera', icon: 'fas fa-camera', color: '#E91E63' },
    { id: 'gallery', name: 'Gallery', icon: 'fas fa-images', color: '#9C27B0' },
    { id: 'video', name: 'Video', icon: 'fas fa-video', color: '#FF5722' },
    { id: 'audio', name: 'Audio', icon: 'fas fa-microphone', color: '#FF9800' },
    { id: 'location', name: 'Location', icon: 'fas fa-map-marker-alt', color: '#4CAF50' },
    { id: 'reminder', name: 'Reminder', icon: 'fas fa-bell', color: '#00BCD4' }
  ];

  const handleOptionClick = (option) => {
    console.log('Option clicked:', option.name);
    if (onFileSelect) {
      onFileSelect({ type: option.id, name: option.name });
    }
    if (onClose) {
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="whatsapp-attachment-overlay">
      <div className={`whatsapp-attachment-popup ${isVisible ? 'open' : ''}`}>
        <div className="whatsapp-attachment-header">
          <h3>Share</h3>
          <button onClick={onClose} className="whatsapp-attachment-close">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="whatsapp-menu-grid">
          {attachmentOptions.map((option) => (
            <div
              key={option.id}
              className="whatsapp-menu-item"
              onClick={() => handleOptionClick(option)}
            >
              <div
                className="whatsapp-icon-circle"
                style={{ backgroundColor: option.color }}
              >
                <i className={option.icon}></i>
              </div>
              <span className="whatsapp-item-name">{option.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AttachmentMenu;