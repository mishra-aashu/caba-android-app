import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCall } from '../context/CallContext';
import { Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import '../styles/call-status-indicator.css';

function CallStatusIndicator() {
  const navigate = useNavigate();
  const location = useLocation();
  const { callState, callType, callId, callerInfo, receiverInfo, endCall } = useCall();

  // Only show if there's an active call and not on calls page (since it has header notification)
  if (!['calling', 'connecting', 'connected'].includes(callState) || location.pathname.startsWith('/calls')) {
    return null;
  }

  const otherUser = callerInfo || receiverInfo;
  const isVideoCall = callType === 'video';

  const handleClick = () => {
    if (callId) {
      navigate(`/call/${callId}`);
    }
  };

  const handleEndCall = (e) => {
    e.stopPropagation();
    endCall();
  };

  return (
    <div
      className="call-status-indicator"
      onClick={handleClick}
      title="Click to view active call"
    >
      {/* Call Icon and Status */}
      <div className="call-status-info">
        {isVideoCall ? <Video className="call-status-icon" /> : <Phone className="call-status-icon" />}
        <span className="call-status-text">
          {callState === 'calling' && 'Calling...'}
          {callState === 'connecting' && 'Connecting...'}
          {callState === 'connected' && 'On Call'}
        </span>
      </div>

      {/* User Name */}
      <span className="call-status-user-name">
        {otherUser?.name || 'Unknown'}
      </span>

      {/* End Call Button */}
      <button
        onClick={handleEndCall}
        className="call-status-end-btn"
        title="End Call"
      >
        <PhoneOff className="call-status-end-icon" />
      </button>
    </div>
  );
}

export default CallStatusIndicator;