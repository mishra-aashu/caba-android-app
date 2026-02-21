import React, { useState } from 'react';
import { Phone, Video, Users } from 'lucide-react';
import './GroupCallButton.css';

const GroupCallButton = ({ 
  groupId, 
  groupName, 
  isGroupChat = false, 
  currentUser,
  onStartCall 
}) => {
  const [showCallOptions, setShowCallOptions] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartCall = async (callType) => {
    setIsStarting(true);
    setShowCallOptions(false);
    
    try {
      await onStartCall(callType);
    } catch (error) {
      console.error('Error starting call:', error);
    } finally {
      setIsStarting(false);
    }
  };

  if (!isGroupChat) {
    return null; // Only show for group chats
  }

  return (
    <div className="group-call-button-container">
      <button
        className={`group-call-btn ${isStarting ? 'starting' : ''}`}
        onClick={() => setShowCallOptions(!showCallOptions)}
        disabled={isStarting}
        title={`Start ${groupName} call`}
      >
        {isStarting ? (
          <div className="loading-spinner"></div>
        ) : (
          <Phone size={20} />
        )}
        <span className="btn-text">
          {isStarting ? 'Starting...' : 'Call'}
        </span>
      </button>

      {showCallOptions && (
        <div className="call-options-dropdown">
          <div className="dropdown-header">
            <Users size={16} />
            <span>Start {groupName} Call</span>
          </div>
          
          <div className="call-options">
            <button
              className="call-option voice"
              onClick={() => handleStartCall('voice')}
              disabled={isStarting}
            >
              <Phone size={20} />
              <div className="option-details">
                <span className="option-title">Voice Call</span>
                <span className="option-desc">Audio only</span>
              </div>
            </button>
            
            <button
              className="call-option video"
              onClick={() => handleStartCall('video')}
              disabled={isStarting}
            >
              <Video size={20} />
              <div className="option-details">
                <span className="option-title">Video Call</span>
                <span className="option-desc">Audio and video</span>
              </div>
            </button>
          </div>
          
          <div className="dropdown-footer">
            <small>Group members will be invited to join</small>
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {showCallOptions && (
        <div
          className="dropdown-backdrop"
          onClick={() => setShowCallOptions(false)}
        />
      )}
    </div>
  );
};

export default GroupCallButton;
