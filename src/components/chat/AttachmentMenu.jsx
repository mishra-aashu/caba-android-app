import React from 'react';
import { IonIcon } from '@ionic/react';
import { 
  documentText, 
  camera, 
  image, 
  headset, 
  location, 
  person 
} from 'ionicons/icons';
import './AttachmentMenu.css';

const AttachmentMenu = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const menuItems = [
    { id: 1, icon: documentText, label: "Document", color: "#7f66ff" }, // Purple
    { id: 2, icon: camera, label: "Camera", color: "#ff2e74" },       // Pink/Red
    { id: 3, icon: image, label: "Gallery", color: "#bf59cf" },       // Violet
    { id: 4, icon: headset, label: "Audio", color: "#ff8c00" },       // Orange
    { id: 5, icon: location, label: "Location", color: "#00a884" },    // Green
    { id: 6, icon: person, label: "Contact", color: "#009de2" }        // Blue
  ];

  return (
    <div className="attachment-overlay" onClick={onClose}>
      <div className="attachment-card">
        {menuItems.map((item) => (
          <div key={item.id} className="attachment-item">
            <div 
              className="icon-circle" 
              style={{ backgroundColor: item.color }}
            >
              <IonIcon icon={item.icon} />
            </div>
            <span className="icon-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttachmentMenu;
