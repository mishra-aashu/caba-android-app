import React, { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCall } from '../context/CallContext';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  RotateCcw,
  Volume2,
  VolumeX,
  ArrowLeft
} from 'lucide-react';

function CallScreen() {
  const { callId: routeCallId } = useParams();
  const navigate = useNavigate();
  const {
    callState,
    callType,
    localStream,
    remoteStream,
    callerInfo,
    receiverInfo,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    callDuration,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [showControls, setShowControls] = useState(true);

  // Set up video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Auto-hide controls
  useEffect(() => {
    if (callState === 'connected') {
      const timer = setTimeout(() => setShowControls(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [callState, showControls]);

  // Redirect if no active call
  useEffect(() => {
    if (!['calling', 'connecting', 'connected'].includes(callState)) {
      navigate('/', { replace: true });
    }
  }, [callState, navigate]);

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const otherUser = callerInfo || receiverInfo;
  const isVideoCall = callType === 'video';

  const handleEndCall = async () => {
    await endCall();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className={`fixed top-0 left-0 right-0 z-10 bg-black/80 backdrop-blur-sm transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-center flex-1">
            <p className="text-white/60 text-sm">
              {callState === 'calling' && '📞 Calling...'}
              {callState === 'connecting' && '🔄 Connecting...'}
              {callState === 'connected' && formatDuration(callDuration)}
            </p>
            <h3 className="text-white font-semibold text-lg">
              {otherUser?.name || 'Unknown'}
            </h3>
          </div>
          <div className="w-10" /> {/* Spacer for balance */}
        </div>
      </div>

      {/* Main Call Area */}
      <div
        className="h-screen flex items-center justify-center cursor-pointer"
        onClick={() => setShowControls(!showControls)}
      >
        {/* Remote Video (Full Screen) */}
        {isVideoCall && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Audio Only Background */}
        {!isVideoCall && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-40 h-40 mx-auto rounded-full overflow-hidden ring-4 ring-white/20 mb-6">
                {otherUser?.avatar ? (
                  <img
                    src={otherUser.avatar}
                    alt={otherUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-6xl font-bold text-white">
                    {otherUser?.name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">
                {otherUser?.name || 'Unknown'}
              </h2>
              <p className="text-white/60">
                {callState === 'calling' && 'Calling...'}
                {callState === 'connecting' && 'Connecting...'}
                {callState === 'connected' && `Connected • ${formatDuration(callDuration)}`}
              </p>
            </div>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {isVideoCall && localStream && (
          <div className="absolute top-20 right-4 w-32 h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-gray-500" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className={`fixed bottom-0 left-0 right-0 z-10 bg-black/80 backdrop-blur-sm p-8 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex justify-center items-center gap-6">
          {/* Mute Button */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Video Toggle (only for video calls) */}
          {isVideoCall && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleVideo(); }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isVideoOff ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isVideoOff ? (
                <VideoOff className="w-6 h-6 text-white" />
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </button>
          )}

          {/* End Call Button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleEndCall(); }}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Switch Camera (only for video calls) */}
          {isVideoCall && (
            <button
              onClick={(e) => { e.stopPropagation(); switchCamera(); }}
              className="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
            >
              <RotateCcw className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Speaker Toggle (only for voice calls) */}
          {!isVideoCall && (
            <button
              onClick={(e) => e.stopPropagation()}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isSpeakerOn ? 'bg-blue-500' : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isSpeakerOn ? (
                <Volume2 className="w-6 h-6 text-white" />
              ) : (
                <VolumeX className="w-6 h-6 text-white" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CallScreen;