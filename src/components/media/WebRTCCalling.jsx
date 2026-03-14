import React, { useRef, useEffect, useState } from 'react';
import { Phone, Video, Monitor, User, PhoneCall, Mic, MicOff, VideoOff, PhoneOff } from 'lucide-react';
import { useWebRTCCalling } from '../../hooks/media/useWebRTCCalling';
import { useDialog } from '../../contexts/DialogContext';

/**
 * WebRTC Calling Component
 * Provides UI for voice and video calls
 */
const WebRTCCalling = ({ receiverId, onCallStateChange }) => {
  const {
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleVideo,
    cleanup,
    localStream,
    remoteStream,
    isConnected,
    callState,
    callDuration,
    callType
  } = useWebRTCCalling();
  const { showAlert } = useDialog();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

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

  useEffect(() => {
    if (onCallStateChange) {
      onCallStateChange(callState, callDuration);
    }
  }, [callState, callDuration, onCallStateChange]);

  const handleStartCall = async (type) => {
    if (!receiverId) return;

    const result = await startCall(receiverId, type, {
      onRemoteStream: (stream) => {
      },
      onCallEnd: (data) => {
      },
      onStateChange: (type, data) => {
      }
    });

    if (!result.success) {
      showAlert('Failed to start call: ' + result.error);
    }
  };

  const handleEndCall = async () => {
    await endCall('completed');
  };

  const handleToggleMute = () => {
    const muted = toggleMute();
    setIsMuted(muted);
  };

  const handleToggleVideo = () => {
    const videoOff = toggleVideo();
    setIsVideoOff(videoOff);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="webrtc-calling">
      <div className="call-header">
        <h3>WebRTC Calling</h3>
        <div className="call-status">
          Status: <span className={`status-${callState}`}>{callState}</span>
          {callDuration > 0 && (
            <span className="call-duration"> ({formatDuration(callDuration)})</span>
          )}
        </div>
      </div>

      {callState === 'idle' && (
        <div className="call-controls">
          <h4>Start Call</h4>
          <div className="call-buttons">
            <button
              type="button"
              onClick={() => handleStartCall('audio')}
              className="btn-primary"
              disabled={!receiverId}
            >
              <Phone size={18} /> Voice Call
            </button>
            <button
              type="button"
              onClick={() => handleStartCall('video')}
              className="btn-primary"
              disabled={!receiverId}
            >
              <Video size={18} /> Video Call
            </button>
            <button
              type="button"
              onClick={() => handleStartCall('screen')}
              className="btn-secondary"
              disabled={!receiverId}
            >
              <Monitor size={18} /> Screen Share
            </button>
          </div>
          {!receiverId && (
            <p className="call-info">Select a user to call</p>
          )}
        </div>
      )}

      {(callState === 'calling' || callState === 'ringing' || callState === 'answered') && (
        <div className="active-call">
          <div className="video-container">
            {(callType === 'video' || callType === 'screen') && (
              <>
                <div className="remote-video">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="video-element"
                  />
                  {!remoteStream && (
                    <div className="video-placeholder">
                      <User size={48} />
                      <p>Waiting for {callState === 'calling' ? 'answer' : 'connection'}...</p>
                    </div>
                  )}
                </div>
                <div className="local-video">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="video-element"
                  />
                </div>
              </>
            )}

            {callType === 'audio' && (
              <div className="audio-call">
                <div className="audio-visualization">
                  <PhoneCall size={48} />
                  <p>{callState === 'calling' ? 'Calling...' : callState === 'ringing' ? 'Ringing...' : 'Connected'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="call-actions">
            <button
              type="button"
              onClick={handleToggleMute}
              className={`btn-control ${isMuted ? 'active' : ''}`}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            {(callType === 'video' || callType === 'screen') && (
              <button
                type="button"
                onClick={handleToggleVideo}
                className={`btn-control ${isVideoOff ? 'active' : ''}`}
              >
                {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
            )}

            <button
              type="button"
              onClick={handleEndCall}
              className="btn-danger"
            >
              <PhoneOff size={20} /> End Call
            </button>
          </div>
        </div>
      )}

      <div className="call-info">
        <p>
          <strong>WebRTC Calling:</strong> Supports voice, video, and screen sharing calls using WebRTC with TURN server fallback.
        </p>
        <p>
          Connection: {isConnected ? 'Established' : 'Not connected'}
        </p>
      </div>
    </div>
  );
};

export default WebRTCCalling;