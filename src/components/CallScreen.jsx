import React, { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCall } from '../context/CallContext';
// import '../../styles/call-screen.css';
import { dpOptions } from '../utils/dpOptions';
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
  ArrowLeft,
  Monitor
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
    isScreenSharing,
    callDuration,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    switchCamera
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [showControls, setShowControls] = useState(true);
  const [isSwapped, setIsSwapped] = useState(false);

  // Set up video elements
  useEffect(() => {
    console.log('CallScreen: localStream changed', localStream);
    console.log('CallScreen: localStream tracks:', localStream?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
    if (localVideoRef.current) {
      const stream = isSwapped ? remoteStream : localStream;
      if (stream) {
        localVideoRef.current.srcObject = stream;
        console.log('CallScreen: set srcObject on pip video, tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
        // Ensure video plays
        localVideoRef.current.play().catch(e => console.log('Play failed:', e));
      }
    }
  }, [localStream, remoteStream, isSwapped]);

  useEffect(() => {
    console.log('CallScreen: remoteStream changed', remoteStream);
    console.log('CallScreen: remoteStream tracks:', remoteStream?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
    if (remoteVideoRef.current) {
      const stream = isSwapped ? localStream : remoteStream;
      if (stream) {
        remoteVideoRef.current.srcObject = stream;
        console.log('CallScreen: set srcObject on main video, tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
      }
    }
    if (remoteAudioRef.current) {
      const stream = isSwapped ? localStream : remoteStream;
      if (stream) {
        remoteAudioRef.current.srcObject = stream;
        console.log('CallScreen: set srcObject on remote audio, tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
      }
    }
  }, [localStream, remoteStream, isSwapped]);

  // Controls are always visible

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
    <div className="call-screen-container">
      {/* Header */}
      <div className={`call-screen-header ${showControls ? 'controls-visible' : 'controls-hidden'}`}>
        <div className="header-content">
          <button
            onClick={() => navigate(-1)}
            className="back-button"
          >
            <ArrowLeft className="back-icon" />
          </button>
          <div className="header-center">
            <p className="call-status-text">
              {callState === 'calling' && '📞 Calling...'}
              {callState === 'connecting' && '🔄 Connecting...'}
              {callState === 'connected' && formatDuration(callDuration)}
            </p>
            <h3 className="caller-name">
              {otherUser?.name || 'Unknown'}
            </h3>
          </div>
          <div className="header-spacer" />
        </div>
      </div>

      {/* Main Call Area */}
      <div className="main-call-area">
        {/* Remote Video (Full Screen) */}
        {isVideoCall && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={isSwapped ? true : false}
            className="remote-video"
          />
        )}

        {/* Remote Audio (for audio calls) */}
        {!isVideoCall && (
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
          />
        )}

        {/* Audio Only Background */}
        {!isVideoCall && (
          <div className="audio-background">
            <div className="audio-content">
              <div className="caller-avatar-large">
                {otherUser?.avatar ? (
                  parseInt(otherUser.avatar) ? (
                    <img
                      src={dpOptions.find(dp => dp.id === parseInt(otherUser.avatar))?.path || otherUser.avatar}
                      alt={otherUser.name}
                      className="avatar-image"
                    />
                  ) : (
                    <img
                      src={otherUser.avatar}
                      alt={otherUser.name}
                      className="avatar-image"
                    />
                  )
                ) : (
                  <div className="avatar-placeholder">
                    {otherUser?.name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              <h2 className="audio-caller-name">
                {otherUser?.name || 'Unknown'}
              </h2>
              <p className="audio-status">
                {callState === 'calling' && 'Calling...'}
                {callState === 'connecting' && 'Connecting...'}
                {callState === 'connected' && `Connected • ${formatDuration(callDuration)}`}
              </p>
            </div>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {isVideoCall && localStream && (
          <div className="pip-container" onClick={() => setIsSwapped(!isSwapped)}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted={isSwapped ? false : true}
              className={`pip-video ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="pip-placeholder">
                <VideoOff className="pip-icon" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className={`call-controls ${showControls ? 'controls-visible' : 'controls-hidden'}`}>
        <div className="controls-container">
          {/* Mute Button */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            className={`control-button ${isMuted ? 'muted' : ''}`}
          >
            {isMuted ? (
              <MicOff className="control-icon" />
            ) : (
              <Mic className="control-icon" />
            )}
          </button>

          {/* Screen Share Button (only for video calls) */}
          {isVideoCall && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleScreenShare(); }}
              className={`control-button ${isScreenSharing ? 'screen-sharing' : ''}`}
            >
              <Monitor className="control-icon" />
            </button>
          )}

          {/* Video Toggle (only for video calls) */}
          {isVideoCall && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleVideo(); }}
              className={`control-button ${isVideoOff ? 'video-off' : ''}`}
            >
              {isVideoOff ? (
                <VideoOff className="control-icon" />
              ) : (
                <Video className="control-icon" />
              )}
            </button>
          )}

          {/* End Call Button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleEndCall(); }}
            className="end-call-button"
          >
            <PhoneOff className="end-call-icon" />
          </button>

          {/* Switch Camera (only for video calls) */}
          {isVideoCall && (
            <button
              onClick={(e) => { e.stopPropagation(); switchCamera(); }}
              className="control-button"
            >
              <RotateCcw className="control-icon" />
            </button>
          )}

          {/* Speaker Toggle (only for voice calls) */}
          {!isVideoCall && (
            <button
              onClick={(e) => e.stopPropagation()}
              className={`control-button ${isSpeakerOn ? 'speaker-on' : ''}`}
            >
              {isSpeakerOn ? (
                <Volume2 className="control-icon" />
              ) : (
                <VolumeX className="control-icon" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CallScreen;