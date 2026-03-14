import React from "react";
import { X } from "lucide-react";
import "../../styles/profile.css";

const FullscreenImageModal = ({ src, onClose }) => {
  return (
    <div className="fullscreen-modal" onClick={onClose}>
      <div className="fullscreen-modal-content">
        <img src={src} alt="Fullscreen Profile" />
      </div>
      <button className="close-fullscreen-btn" onClick={onClose}>
        <X size={24} />
      </button>
    </div>
  );
};

export default FullscreenImageModal;
