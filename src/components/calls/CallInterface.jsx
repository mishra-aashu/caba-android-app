import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabase';
import { useTheme } from '../../contexts/ThemeContext';

const CallInterface = ({ contact, callType, incoming = false, callId, roomId, onClose, onCallEnd }) => {
  const { theme } = useTheme();
  const [callState, setCallState] = useState(incoming ? 'incoming' : 'connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callInstanceRef = useRef(null);

  useEffect(() => {
    if (incoming) {
      initializeIncomingCall();
    } else {
      initializeOutgoingCall();
    }
    return () => {
      if (callInstanceRef.current) {
        callInstanceRef.current.endCall();
      }
    };
  }, []);

  const initializeOutgoingCall = async () => {
    try {
      // Check if WebRTCCall is available
      if (!window.WebRTCCall) {
        alert('WebRTC not loaded. Please refresh the page.');
        onClose();
        return;
      }

      const callInstance = new window.WebRTCCall();

      callInstanceRef.current = callInstance;

      const result = await callInstance.startCall(contact.id, callType, {
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        },
        onCallEnd: (data) => {
          console.log('Call ended:', data);
          setCallState('ended');
          onCallEnd && onCallEnd(data);
          setTimeout(() => onClose(), 2000);
        },
        onStateChange: (type, value) => {
          if (type === 'state') {
            setCallState(value);
          } else if (type === 'timer') {
            setCallDuration(value);
          }
        }
      });

      if (result.success) {
        setLocalStream(result.localStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = result.localStream;
        }
      } else {
        alert('Failed to start call: ' + result.error);
        onClose();
      }

    } catch (error) {
      console.error('Call initialization error:', error);
      alert('Failed to initialize call');
      onClose();
    }
  };

  const initializeIncomingCall = async () => {
    try {
      if (!window.WebRTCCall) {
        alert('WebRTC not loaded. Please refresh the page.');
        onClose();
        return;
      }

      const callInstance = new window.WebRTCCall();
      callInstanceRef.current = callInstance;

      const result = await callInstance.answerCall(callId, roomId, callType, {
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        },
        onCallEnd: (data) => {
          console.log('Call ended:', data);
          setCallState('ended');
          onCallEnd && onCallEnd(data);
          setTimeout(() => onClose(), 2000);
        },
        onStateChange: (type, value) => {
          if (type === 'state') {
            setCallState(value);
          } else if (type === 'timer') {
            setCallDuration(value);
          }
        }
      });

      if (result.success) {
        setLocalStream(result.localStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = result.localStream;
        }
      } else {
        alert('Failed to answer call: ' + result.error);
        onClose();
      }

    } catch (error) {
      console.error('Incoming call initialization error:', error);
      alert('Failed to answer call');
      onClose();
    }
  };

  const handleEndCall = () => {
    if (callInstanceRef.current) {
      callInstanceRef.current.endCall();
    }
    onClose();
  };

  const handleToggleMute = () => {
    if (callInstanceRef.current) {
      const muted = callInstanceRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const handleToggleVideo = () => {
    if (callInstanceRef.current) {
      const videoOff = callInstanceRef.current.toggleVideo();
      setIsVideoOff(videoOff);
    }
  };

  const handleSwitchCamera = () => {
    if (callInstanceRef.current) {
      callInstanceRef.current.switchCamera();
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-call-overlay">
      <div className="video-call-container">
        {/* Call Header */}
        <div className="call-header">
          <div className="call-info">
            <div className="caller-avatar">
              {contact.avatar ? (
                <img src={contact.avatar} alt={contact.name} />
              ) : (
                contact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              )}
            </div>
            <div className="caller-details">
              <h3>{contact.name}</h3>
              <p className="call-status">
                {callState === 'initiated' && 'Calling...'}
                {callState === 'ringing' && 'Ringing...'}
                {callState === 'answered' && `Connected • ${formatDuration(callDuration)}`}
                {callState === 'ended' && 'Call ended'}
              </p>
            </div>
          </div>
          <button className="minimize-btn" onClick={onClose} title="Minimize">
            <i className="fas fa-chevron-down"></i>
          </button>
        </div>

        {/* Main Video Area - Remote User */}
        <div className="main-video-area">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="main-video"
            />
          ) : (
            <div className="connecting-screen">
              <div className="connecting-avatar">
                <div className="avatar-circle-xl">
                  {contact.avatar ? (
                    <img src={contact.avatar} alt={contact.name} />
                  ) : (
                    contact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  )}
                </div>
              </div>
              <h2 className="connecting-name">{contact.name}</h2>
              <div className="connecting-status">
                <div className="status-indicator">
                  <div className="pulse-ring"></div>
                  <div className="pulse-ring pulse-ring-delay"></div>
                </div>
                <p>
                  {callState === 'initiated' && 'Calling...'}
                  {callState === 'ringing' && 'Ringing...'}
                  {callState === 'answered' && 'Connected'}
                  {callState === 'ended' && 'Call ended'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Picture-in-Picture - Local Video */}
        {localStream && callType === 'video' && !isVideoOff && (
          <div className="pip-container">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="pip-video"
            />
            <div className="pip-label">You</div>
          </div>
        )}

        {/* Call Controls */}
        <div className="call-controls-bar">
          <div className="controls-wrapper">
            <button
              className={`control-btn ${isMuted ? 'muted' : ''}`}
              onClick={handleToggleMute}
            >
              <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
              <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            {callType === 'video' && (
              <>
                <button
                  className={`control-btn ${isVideoOff ? 'video-off' : ''}`}
                  onClick={handleToggleVideo}
                >
                  <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`}></i>
                  <span className="control-label">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
                </button>

                <button
                  className="control-btn"
                  onClick={handleSwitchCamera}
                >
                  <i className="fas fa-sync-alt"></i>
                  <span className="control-label">Switch</span>
                </button>
              </>
            )}

            <button
              className="control-btn end-call-btn"
              onClick={handleEndCall}
            >
              <i className="fas fa-phone-slash"></i>
              <span className="control-label">End</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallInterface;