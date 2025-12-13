import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../utils/supabase';
import { useTURNConfig } from './useTURNConfig';

/**
 * React hook for WebRTC calling functionality
 * Adapted from webrtc-calling.js
 */
export const useWebRTCCalling = () => {
  const { getTURNConfig } = useTURNConfig();

  const [peerConnection, setPeerConnection] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [channel, setChannel] = useState(null);

  const [callId, setCallId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [callType, setCallType] = useState('video');

  const [isCaller, setIsCaller] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [callState, setCallState] = useState('idle'); // idle, calling, ringing, answered, ended
  const [callDuration, setCallDuration] = useState(0);

  const callTimerRef = useRef(null);
  const callStartTimeRef = useRef(null);

  // Callbacks
  const [onRemoteStream, setOnRemoteStream] = useState(null);
  const [onCallEnd, setOnCallEnd] = useState(null);
  const [onCallStateChange, setOnCallStateChange] = useState(null);

  /**
   * Start outgoing call
   */
  const startCall = useCallback(async (receiverId, callType = 'video', callbacks = {}) => {
    try {
      setCallType(callType);
      setRemoteUserId(receiverId);
      setIsCaller(true);
      setOnRemoteStream(() => callbacks.onRemoteStream);
      setOnCallEnd(() => callbacks.onCallEnd);
      setOnCallStateChange(() => callbacks.onStateChange);

      console.log(`📞 Starting ${callType} call to ${receiverId}...`);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Not authenticated');

      setUserId(user.id);

      // Generate room ID
      const roomId = `call_${user.id}_${receiverId}_${Date.now()}`;
      setRoomId(roomId);

      // Create call record
      const { data: callData, error: callError } = await supabase
        .from('calls')
        .insert([{
          caller_id: user.id,
          receiver_id: receiverId,
          call_type: callType === 'screen' ? 'video' : callType,
          status: 'calling',
          room_id: roomId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (callError) throw callError;

      setCallId(callData.id);
      setCallState('calling');

      // Get local media
      await getLocalMedia(callType);

      // Initialize peer connection
      await initPeerConnection();

      // Subscribe to signals
      await subscribeToSignals();

      // Create and send offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video' || callType === 'screen'
      });

      await peerConnection.setLocalDescription(offer);

      // Send offer signal
      await sendSignal('offer', {
        sdp: offer.sdp,
        type: offer.type,
        callType: callType
      });

      console.log('✅ Call initiated, waiting for answer...');

      return {
        success: true,
        callId: callData.id,
        roomId: roomId,
        localStream: localStream
      };

    } catch (error) {
      console.error('❌ Start call error:', error);
      await endCall('failed');
      return {
        success: false,
        error: error.message
      };
    }
  }, [peerConnection, localStream]);

  /**
   * Answer incoming call
   */
  const answerCall = useCallback(async (callId, roomId, callType = 'video', callbacks = {}) => {
    try {
      setCallId(callId);
      setRoomId(roomId);
      setCallType(callType);
      setIsCaller(false);
      setOnRemoteStream(() => callbacks.onRemoteStream);
      setOnCallEnd(() => callbacks.onCallEnd);
      setOnCallStateChange(() => callbacks.onStateChange);

      console.log(`📞 Answering ${callType} call...`);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Not authenticated');

      setUserId(user.id);

      // Update call status
      await supabase
        .from('calls')
        .update({
          status: 'ringing',
          answered_at: new Date().toISOString()
        })
        .eq('id', callId);

      setCallState('ringing');

      // Get local media
      await getLocalMedia(callType);

      // Initialize peer connection
      await initPeerConnection();

      // Subscribe to signals
      await subscribeToSignals();

      console.log('✅ Ready to receive call...');

      return {
        success: true,
        localStream: localStream
      };

    } catch (error) {
      console.error('❌ Answer call error:', error);
      await endCall('failed');
      return {
        success: false,
        error: error.message
      };
    }
  }, [localStream]);

  /**
   * End active call
   */
  const endCall = useCallback(async (reason = 'completed') => {
    try {
      console.log('📞 Ending call...');

      // Stop call timer
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }

      // Calculate duration
      const duration = callStartTimeRef.current
        ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
        : 0;

      // Update call record
      if (callId) {
        await supabase
          .from('calls')
          .update({
            status: reason,
            ended_at: new Date().toISOString(),
            duration: duration
          })
          .eq('id', callId);
      }

      // Send hangup signal
      if (roomId) {
        await sendSignal('hangup', { reason });
      }

      // Cleanup
      cleanup();

      // Callbacks
      if (onCallEnd) {
        onCallEnd({ reason, duration });
      }

      setCallState('ended');

    } catch (error) {
      console.error('End call error:', error);
      cleanup();
    }
  }, [callId, roomId, onCallEnd]);

  /**
   * Get local media stream
   */
  const getLocalMedia = useCallback(async (callType) => {
    try {
      let constraints;

      if (callType === 'screen') {
        constraints = {
          video: { mediaSource: 'screen' },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };
        const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
        setLocalStream(stream);
      } else {
        constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: callType === 'video' ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          } : false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);
      }

      console.log('🎥 Local media acquired for', callType);

    } catch (error) {
      console.error('Get media error:', error);
      throw new Error(`Could not access ${callType === 'screen' ? 'screen' : 'camera/microphone'}`);
    }
  }, []);

  /**
   * Initialize RTCPeerConnection
   */
  const initPeerConnection = useCallback(async () => {
    const pc = new RTCPeerConnection(getTURNConfig());

    setPeerConnection(pc);

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('🎥 Remote track received:', event.track.kind);

      if (!remoteStream) {
        const remote = new MediaStream();
        setRemoteStream(remote);
      }

      remoteStream.addTrack(event.track);

      if (onRemoteStream) {
        onRemoteStream(remoteStream);
      }
    };

    // ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await sendSignal('ice', {
          candidate: event.candidate.toJSON()
        });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('Connection state:', state);

      if (state === 'connected') {
        setIsConnected(true);
        startCallTimer();
        setCallState('answered');

        // Update DB
        supabase
          .from('calls')
          .update({
            status: 'answered',
            answered_at: new Date().toISOString()
          })
          .eq('id', callId);
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        endCall(state);
      }
    };

    console.log('✅ Peer connection initialized');
  }, [localStream, remoteStream, onRemoteStream, callId, getTURNConfig]);

  /**
   * Subscribe to WebRTC signals
   */
  const subscribeToSignals = useCallback(async () => {
    const ch = supabase
      .channel(`call:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          await handleSignal(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('📡 Call signaling channel:', status);
      });

    setChannel(ch);
  }, [roomId]);

  /**
   * Handle incoming signal
   */
  const handleSignal = useCallback(async (signal) => {
    // Ignore own signals
    if (signal.sender_id === userId) return;

    console.log(`📥 Signal received: ${signal.signal_type}`);

    try {
      switch (signal.signal_type) {
        case 'offer':
          await handleOffer(signal.payload);
          break;
        case 'answer':
          await handleAnswer(signal.payload);
          break;
        case 'ice':
          await handleIceCandidate(signal.payload);
          break;
        case 'hangup':
          await endCall(signal.payload.reason || 'completed');
          break;
      }
    } catch (error) {
      console.error('Handle signal error:', error);
    }
  }, [userId, endCall]);

  /**
   * Handle offer
   */
  const handleOffer = useCallback(async (payload) => {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: 'offer',
        sdp: payload.sdp
      })
    );

    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send answer
    await sendSignal('answer', {
      sdp: answer.sdp,
      type: answer.type
    });

    console.log('✅ Answer sent');
  }, [peerConnection]);

  /**
   * Handle answer
   */
  const handleAnswer = useCallback(async (payload) => {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: payload.sdp
      })
    );

    console.log('✅ Answer received');
  }, [peerConnection]);

  /**
   * Handle ICE candidate
   */
  const handleIceCandidate = useCallback(async (payload) => {
    try {
      await peerConnection.addIceCandidate(
        new RTCIceCandidate(payload.candidate)
      );
    } catch (error) {
      console.error('Add ICE candidate error:', error);
    }
  }, [peerConnection]);

  /**
   * Send signal
   */
  const sendSignal = useCallback(async (type, payload) => {
    try {
      await supabase
        .from('webrtc_signals')
        .insert([{
          room_id: roomId,
          sender_id: userId,
          signal_type: type,
          purpose: 'call',
          payload: payload
        }]);
    } catch (error) {
      console.error('Send signal error:', error);
    }
  }, [roomId, userId]);

  /**
   * Start call timer
   */
  const startCallTimer = useCallback(() => {
    callStartTimeRef.current = Date.now();

    callTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      setCallDuration(elapsed);

      if (onCallStateChange) {
        onCallStateChange('timer', elapsed);
      }
    }, 1000);
  }, [onCallStateChange]);

  /**
   * Toggle mute audio
   */
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled;
      }
    }
    return false;
  }, [localStream]);

  /**
   * Toggle video
   */
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return !videoTrack.enabled;
      }
    }
    return false;
  }, [localStream]);

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }

    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }

    // Unsubscribe from channel
    if (channel) {
      supabase.removeChannel(channel);
      setChannel(null);
    }

    setIsConnected(false);
    setCallState('idle');
    setCallDuration(0);
  }, [localStream, remoteStream, peerConnection, channel]);

  return {
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
  };
};