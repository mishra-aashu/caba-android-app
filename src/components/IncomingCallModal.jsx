import React, { useEffect, useRef } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../contexts/CallContext';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { dpOptions } from '../utils/dpOptions';
import '../styles/incoming-call-modal.css';

export function IncomingCallModal() {
  const navigate = useNavigate();
  const {
    callState,
    incomingCall,
    callerInfo,
    answerCall,
    rejectCall,
    playIncomingRing
  } = useCall();

  const hasUserInteracted = useRef(false);
  const [isIgnored, setIsIgnored] = useState(false);

  // Reset ignore state whenever a new call comes in
  useEffect(() => {
    if (incomingCall?.call_id) {
      setIsIgnored(false);
    }
  }, [incomingCall?.call_id]);

  if (callState !== 'ringing' || !incomingCall || isIgnored) {
    return null;
  }

  const isVideoCall = incomingCall.signal_data?.callType === 'video';

  // User interaction helps satisfy autoplay policy
  const handleUserInteraction = async (action) => {
    // Attempt to play ringing sound (in case it was blocked)
    playIncomingRing();

    if (action === answerCall) {
      // For answering calls, navigate to call screen after answering
      try {
        await action();
        navigate(`/call/${incomingCall.call_id}`);
      } catch (error) {
        console.error('Error answering call:', error);
      }
    } else {
      // For rejecting calls, just execute the action
      action();
    }
  };

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-container">
        {/* Caller Avatar Section */}
        <div className="incoming-call-avatar-section">
          <div className="incoming-call-avatar">
            {callerInfo?.avatar ? (
              parseInt(callerInfo.avatar) ? (
                <img
                  src={dpOptions.find(dp => dp.id === parseInt(callerInfo.avatar))?.path || callerInfo.avatar}
                  alt={callerInfo.name}
                />
              ) : (
                <img
                  src={callerInfo.avatar}
                  alt={callerInfo.name}
                />
              )
            ) : (
              <div className="incoming-call-avatar-placeholder">
                {callerInfo?.name?.charAt(0) || '?'}
              </div>
            )}
          </div>

          {/* Call Type Badge */}
          <div className="incoming-call-type-badge">
            {isVideoCall ? <Video className="incoming-call-type-icon" /> : <Phone className="incoming-call-type-icon" />}
            <span>{isVideoCall ? 'Video Call' : 'Voice Call'}</span>
          </div>
        </div>

        {/* Caller Info */}
        <div className="incoming-call-info">
          <h2 className="incoming-call-name">
            {callerInfo?.name || 'Unknown Caller'}
          </h2>
          <p className="incoming-call-phone">
            {callerInfo?.phone || 'Incoming call...'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="incoming-call-actions">
          {/* Ignore Button */}
          <button
            onClick={() => setIsIgnored(true)}
            className="incoming-call-btn ignore"
          >
            Ignore
          </button>

          {/* Reject Button */}
          <button
            onClick={() => handleUserInteraction(rejectCall)}
            className="incoming-call-btn reject"
          >
            <PhoneOff className="incoming-call-icon" />
          </button>

          {/* Answer Button */}
          <button
            onClick={() => handleUserInteraction(answerCall)}
            className="incoming-call-btn accept"
          >
            <Phone className="incoming-call-icon" />
          </button>
        </div>

        {/* Hint */}
        <p className="incoming-call-hint">
          Tap buttons to respond
        </p>
      </div>
    </div>
  );
}

export default IncomingCallModal;