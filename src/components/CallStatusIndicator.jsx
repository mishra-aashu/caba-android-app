import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../context/CallContext';
import { Phone, PhoneOff, Video, VideoOff } from 'lucide-react';

function CallStatusIndicator() {
  const navigate = useNavigate();
  const { callState, callType, callId, callerInfo, receiverInfo, endCall } = useCall();

  // Only show if there's an active call
  if (!['calling', 'connecting', 'connected'].includes(callState)) {
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
      className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg cursor-pointer hover:bg-green-600 transition-colors flex items-center gap-2 animate-pulse"
      onClick={handleClick}
      title="Click to view active call"
    >
      {/* Call Icon */}
      <div className="flex items-center gap-1">
        {isVideoCall ? <Video size={16} /> : <Phone size={16} />}
        <span className="text-sm font-medium">
          {callState === 'calling' && 'Calling...'}
          {callState === 'connecting' && 'Connecting...'}
          {callState === 'connected' && 'On Call'}
        </span>
      </div>

      {/* User Name */}
      <span className="text-sm max-w-24 truncate">
        {otherUser?.name || 'Unknown'}
      </span>

      {/* End Call Button */}
      <button
        onClick={handleEndCall}
        className="ml-2 bg-red-500 hover:bg-red-600 rounded-full p-1 transition-colors"
        title="End Call"
      >
        <PhoneOff size={14} />
      </button>
    </div>
  );
}

export default CallStatusIndicator;