import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../context/CallContext';
import { Phone, PhoneOff, Video } from 'lucide-react';

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

  if (callState !== 'ringing' || !incomingCall) {
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-3xl p-8 text-center max-w-sm w-full mx-4 shadow-2xl">
        {/* Caller Avatar */}
        <div className="relative mb-6">
          <div className="w-32 h-32 mx-auto rounded-full overflow-hidden ring-4 ring-green-500 animate-pulse">
            {callerInfo?.avatar ? (
              <img
                src={callerInfo.avatar}
                alt={callerInfo.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white">
                {callerInfo?.name?.charAt(0) || '?'}
              </div>
            )}
          </div>

          {/* Call Type Badge */}
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-green-500 px-4 py-1 rounded-full">
            <span className="text-white text-sm font-medium flex items-center gap-1">
              {isVideoCall ? <Video size={14} /> : <Phone size={14} />}
              {isVideoCall ? 'Video Call' : 'Voice Call'}
            </span>
          </div>
        </div>

        {/* Caller Info */}
        <h2 className="text-2xl font-bold text-white mb-1">
          {callerInfo?.name || 'Unknown Caller'}
        </h2>
        <p className="text-gray-400 mb-8">
          {callerInfo?.phone || 'Incoming call...'}
        </p>

        {/* Action Buttons */}
        <div className="flex justify-center gap-8">
          {/* Reject Button */}
          <button
            onClick={() => handleUserInteraction(rejectCall)}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all hover:scale-110 shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Answer Button */}
          <button
            onClick={() => handleUserInteraction(answerCall)}
            className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all hover:scale-110 shadow-lg shadow-green-500/30 animate-bounce"
          >
            <Phone className="w-7 h-7 text-white" />
          </button>
        </div>

        {/* Swipe hint */}
        <p className="text-gray-500 text-sm mt-6">
          Tap to answer or reject
        </p>
      </div>
    </div>
  );
}

export default IncomingCallModal;