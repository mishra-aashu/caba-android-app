import React, { useState, useEffect, useRef } from 'react';
import { useGroupCall } from '../../contexts/GroupCallContext';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../config/supabase';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users, Settings, Monitor, MonitorOff, Crown, Volume2 } from 'lucide-react';
import './GroupCallScreen.css';

const GroupCallScreen = ({ groupId, callType = 'video', onEndCall }) => {
  const { currentUser } = useAuth();
  const {
    callState,
    callId,
    participants,
    participantStreams,
    localStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    duration,
    initializeGroupCall,
    joinGroupCall,
    leaveGroupCall,
    toggleMute,
    toggleVideo,
    updateParticipantAudioLevel
  } = useGroupCall();

  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const localVideoRef = useRef(null);
  const participantVideoRefs = useRef(new Map());
  const audioAnalyzerRef = useRef(null);

  // Set local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set participant video streams
  useEffect(() => {
    participantStreams.forEach((stream, userId) => {
      const videoRef = participantVideoRefs.current.get(userId);
      if (videoRef) {
        videoRef.srcObject = stream;
      }
    });
  }, [participantStreams]);

  // Setup audio analyzer for speaking detection
  useEffect(() => {
    if (localStream && !isMuted) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyzer = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(localStream);
      
      analyzer.fftSize = 256;
      microphone.connect(analyzer);
      
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      
      const checkAudioLevel = () => {
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const isSpeaking = average > 30; // Threshold for speaking
        
        updateParticipantAudioLevel(currentUser?.id, isSpeaking, average / 255);
        
        if (callState === 'connected') {
          requestAnimationFrame(checkAudioLevel);
        }
      };
      
      checkAudioLevel();
      audioAnalyzerRef.current = { audioContext, analyzer, microphone };
    }
    
    return () => {
      if (audioAnalyzerRef.current) {
        audioAnalyzerRef.current.audioContext.close();
      }
    };
  }, [localStream, isMuted, callState, currentUser?.id, updateParticipantAudioLevel]);

  // Initialize or join call
  useEffect(() => {
    if (groupId && callState === 'idle') {
      // Check if there's an active call for this group
      checkForActiveCall();
    }
  }, [groupId]);

  const checkForActiveCall = async () => {
    try {
      const { data: activeCall, error } = await supabase
        .from('calls')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'connected')
        .eq('is_group_call', true);

      if (error) {
        console.error('Error querying active calls:', error);
        throw error;
      }

      if (activeCall && activeCall.length > 0) {
        await joinGroupCall(activeCall[0].id);
      } else {
        await initializeGroupCall(groupId, callType);
      }
    } catch (error) {
      console.error('Error checking for active call:', error);
      // Fallback: create new call
      try {
        await initializeGroupCall(groupId, callType);
      } catch (initError) {
        console.error('Error initializing call:', initError);
        throw initError;
      }
    }
  };

  const handleEndCall = async () => {
    await leaveGroupCall();
    onEndCall();
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getParticipantName = (participant) => {
    return participant.name || 'Unknown User';
  };

  const getParticipantAvatar = (participant) => {
    if (participant.avatar) {
      return participant.avatar.startsWith('http') 
        ? participant.avatar 
        : `/assets/avatars/${participant.avatar}`;
    }
    return null;
  };

  const renderParticipant = (participant) => {
    const stream = participantStreams.get(participant.user_id);
    const isCurrentUser = participant.user_id === currentUser?.id;
    const isHost = participant.participant_role === 'host';
    
    return (
      <div key={participant.user_id} className="participant">
        <div className="participant-video">
          {stream ? (
            <video
              ref={(el) => participantVideoRefs.current.set(participant.user_id, el)}
              autoPlay
              playsInline
              muted={isCurrentUser}
              className="video-feed"
            />
          ) : (
            <div className="video-placeholder">
              <img
                src={getParticipantAvatar(participant)}
                alt={getParticipantName(participant)}
                className="participant-avatar"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="avatar-fallback">
                {getParticipantName(participant).charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          
          {/* Participant overlay */}
          <div className="participant-overlay">
            <div className="participant-info">
              <span className="participant-name">
                {getParticipantName(participant)}
                {isCurrentUser && ' (You)'}
                {isHost && <Crown size={16} className="host-icon" />}
              </span>
            </div>
            
            {/* Status indicators */}
            <div className="participant-status">
              {participant.is_muted && <MicOff size={16} className="status-icon muted" />}
              {!participant.is_video_enabled && <VideoOff size={16} className="status-icon" />}
              {participant.is_speaking && <Volume2 size={16} className="status-icon speaking" />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (callState === 'idle') {
    return (
      <div className="group-call-loading">
        <div className="loading-spinner"></div>
        <p>Initializing call...</p>
      </div>
    );
  }

  return (
    <div className="group-call-screen">
      {/* Header */}
      <div className="call-header">
        <div className="call-info">
          <h3>Group Call</h3>
          <span className="call-duration">{formatDuration(duration)}</span>
        </div>
        
        <div className="call-controls-header">
          <button
            className="control-btn"
            onClick={() => setShowParticipants(!showParticipants)}
            title="Participants"
          >
            <Users size={20} />
            <span className="participant-count">{participants.length}</span>
          </button>
          
          <button
            className="control-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Main video area */}
      <div className="video-container">
        {/* Local video (picture-in-picture style) */}
        {localStream && (
          <div className="local-video-container">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video"
            />
            <div className="local-video-label">You</div>
          </div>
        )}

        {/* Participant videos */}
        <div className="participants-grid">
          {participants.map(renderParticipant)}
        </div>
      </div>

      {/* Call controls */}
      <div className="call-controls">
        <button
          className={`control-btn ${isMuted ? 'muted' : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        <button
          className={`control-btn ${isVideoOff ? 'video-off' : ''}`}
          onClick={toggleVideo}
          title={isVideoOff ? 'Turn on video' : 'Turn off video'}
        >
          {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
        </button>

        <button
          className="control-btn end-call"
          onClick={handleEndCall}
          title="End call"
        >
          <PhoneOff size={24} />
        </button>
      </div>

      {/* Participants sidebar */}
      {showParticipants && (
        <div className="participants-sidebar">
          <div className="sidebar-header">
            <h4>Participants ({participants.length})</h4>
            <button
              className="close-btn"
              onClick={() => setShowParticipants(false)}
            >
              ×
            </button>
          </div>
          
          <div className="participants-list">
            {participants.map(participant => (
              <div key={participant.user_id} className="participant-item">
                <img
                  src={getParticipantAvatar(participant)}
                  alt={getParticipantName(participant)}
                  className="participant-avatar-small"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="avatar-fallback-small">
                  {getParticipantName(participant).charAt(0).toUpperCase()}
                </div>
                
                <div className="participant-details">
                  <span className="participant-name-small">
                    {getParticipantName(participant)}
                    {participant.user_id === currentUser?.id && ' (You)'}
                    {participant.participant_role === 'host' && <Crown size={14} />}
                  </span>
                  
                  <div className="participant-badges">
                    {participant.is_muted && <MicOff size={12} />}
                    {!participant.is_video_enabled && <VideoOff size={12} />}
                    {participant.is_screen_sharing && <Monitor size={12} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="settings-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h4>Call Settings</h4>
              <button
                className="close-btn"
                onClick={() => setShowSettings(false)}
              >
                ×
              </button>
            </div>
            
            <div className="settings-content">
              <div className="setting-item">
                <label>Maximum Participants</label>
                <select>
                  <option>10</option>
                  <option>25</option>
                  <option>50</option>
                  <option>100</option>
                </select>
              </div>
              
              <div className="setting-item">
                <label>
                  <input type="checkbox" />
                  Enable recording
                </label>
              </div>
              
              <div className="setting-item">
                <label>
                  <input type="checkbox" defaultChecked />
                  Allow screen sharing
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection status */}
      {callState !== 'connected' && (
        <div className="connection-status">
          <div className="status-indicator"></div>
          <span>{callState === 'initiating' ? 'Starting call...' : 'Connecting...'}</span>
        </div>
      )}
    </div>
  );
};

export default GroupCallScreen;
