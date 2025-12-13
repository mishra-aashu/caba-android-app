import React from 'react';
import { useCall } from '../context/CallContext';
import { Phone, Video } from 'lucide-react';

export function CallButton({ receiverId, callType = 'video', size = 'md' }) {
  const { startCall, callState } = useCall();

  const handleCall = async () => {
    if (callState !== 'idle') {
      console.log('Already in a call');
      return;
    }

    try {
      await startCall(receiverId, callType);
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  };

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14'
  };

  const iconSizes = {
    sm: 18,
    md: 22,
    lg: 26
  };

  return (
    <button
      onClick={handleCall}
      disabled={callState !== 'idle'}
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center transition-all ${
        callType === 'video'
          ? 'bg-blue-500 hover:bg-blue-600'
          : 'bg-green-500 hover:bg-green-600'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {callType === 'video' ? (
        <Video size={iconSizes[size]} className="text-white" />
      ) : (
        <Phone size={iconSizes[size]} className="text-white" />
      )}
    </button>
  );
}

export default CallButton;