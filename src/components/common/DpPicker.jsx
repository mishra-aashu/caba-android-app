/**
 * DpPicker - Display Picture Selection Modal
 * Shows predefined DP options for selection
 */

import React from 'react';
import { dpOptions } from '../../utils/dpOptions';
import { Check, Image } from 'lucide-react';
import './DpPicker.css';

const DpPicker = ({ isOpen, onClose, onSelect, currentDp }) => {
  if (!isOpen) return null;

  const handleSelect = (dp) => {
    onSelect(dp.path);
    onClose();
  };

  return (
    <div className="dp-picker-overlay" onClick={onClose}>
      <div className="dp-picker-container" onClick={(e) => e.stopPropagation()}>
        <div className="dp-picker-header">
          <h3>Choose Group Photo</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="dp-picker-grid">
          {dpOptions.map((dp) => (
            <div 
              key={dp.id} 
              className={`dp-option ${currentDp === dp.path ? 'selected' : ''}`}
              onClick={() => handleSelect(dp)}
            >
              <img src={dp.path} alt={`Option ${dp.id}`} />
              {currentDp === dp.path && (
                <div className="dp-selected-check">
                  <Check size={16} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="dp-picker-footer">
          <p>Select a photo from the options above</p>
        </div>
      </div>
    </div>
  );
};

export default DpPicker;
