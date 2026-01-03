import React, { useEffect, useRef } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../context/CallContext';
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
    rejectCall
  } = useCall();

  const ringtoneRef = useRef(null);
  const hasUserInteracted = useRef(false);
  const [isIgnored, setIsIgnored] = useState(false);

  if (callState !== 'ringing' || !incomingCall || isIgnored) {
    return null;
  }

  const isVideoCall = incomingCall.signal_data?.callType === 'video';

  // Play ringtone on user interaction
  const playRingtone = () => {
    if (!hasUserInteracted.current && ringtoneRef.current) {
      hasUserInteracted.current = true;
      // Create a simple beep sound using Web Audio API
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);

        // Repeat the beep every 2 seconds
        const interval = setInterval(() => {
          if (callState === 'ringing') {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.frequency.setValueAtTime(800, audioContext.currentTime);
            osc.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.3);
          } else {
            clearInterval(interval);
          }
        }, 2000);

        // Clean up interval when component unmounts or call state changes
        return () => clearInterval(interval);
      } catch (error) {
        console.warn('Could not play ringtone:', error);
        // Fallback: try vibration if available
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }
      }
    }
  };

  // Handle user interaction
  const handleUserInteraction = async (action) => {
    playRingtone();
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