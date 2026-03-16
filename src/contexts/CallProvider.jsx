import React, { useReducer, useCallback, useEffect, useRef } from 'react';
import { callService } from '../services/callService';
import { webRTCService } from '../services/webrtcService';
import { CallContext } from './CallContext';

// Action Types
const ACTIONS = {
  SET_CALL_STATE: 'SET_CALL_STATE',
  SET_LOCAL_STREAM: 'SET_LOCAL_STREAM',
  SET_REMOTE_STREAM: 'SET_REMOTE_STREAM',
  SET_INCOMING_CALL: 'SET_INCOMING_CALL',
  SET_CALL_DURATION: 'SET_CALL_DURATION',
  TOGGLE_MUTE: 'TOGGLE_MUTE',
  TOGGLE_VIDEO: 'TOGGLE_VIDEO',
  TOGGLE_SPEAKER: 'TOGGLE_SPEAKER',
  TOGGLE_SCREEN_SHARE: 'TOGGLE_SCREEN_SHARE',
  RESET_CALL: 'RESET_CALL',
  SET_ERROR: 'SET_ERROR',
  SET_CALLER_INFO: 'SET_CALLER_INFO',
  REPLACE_LOCAL_STREAM: 'REPLACE_LOCAL_STREAM'
};

// Initial State
const initialState = {
  callState: 'idle', // idle, calling, ringing, connected, ended
  callType: null, // voice, video
  callId: null,
  localStream: null,
  remoteStream: null,
  incomingCall: null,
  callerInfo: null,
  receiverInfo: null,
  isMuted: false,
  isVideoOff: false,
  isSpeakerOn: true,
  isScreenSharing: false,
  callDuration: 0,
  error: null
};

// Audio helper
const createAudio = (src) => {
  const audio = new Audio(src);
  audio.loop = true;
  return audio;
};

// Reducer
function callReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_CALL_STATE:
      return { ...state, callState: action.payload.state, ...action.payload.data };
    case ACTIONS.SET_LOCAL_STREAM:
      return { ...state, localStream: action.payload };
    case ACTIONS.REPLACE_LOCAL_STREAM:
      return { ...state, localStream: action.payload };
    case ACTIONS.SET_REMOTE_STREAM:
      return { ...state, remoteStream: action.payload };
    case ACTIONS.SET_INCOMING_CALL:
      return { ...state, incomingCall: action.payload, callState: 'ringing' };
    case ACTIONS.SET_CALL_DURATION:
      return { ...state, callDuration: action.payload };
    case ACTIONS.TOGGLE_MUTE:
      return { ...state, isMuted: action.payload };
    case ACTIONS.TOGGLE_VIDEO:
      return { ...state, isVideoOff: action.payload };
    case ACTIONS.TOGGLE_SPEAKER:
      return { ...state, isSpeakerOn: action.payload };
    case ACTIONS.TOGGLE_SCREEN_SHARE:
      return { ...state, isScreenSharing: action.payload };
    case ACTIONS.SET_CALLER_INFO:
      return { ...state, callerInfo: action.payload };
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };
    case ACTIONS.RESET_CALL:
      return { ...initialState };
    default:
      return state;
  }
}

// Provider Component
export function CallProvider({ children, currentUser }) {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const signalChannelRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const outgoingAudioRef = useRef(null);
  const incomingAudioRef = useRef(null);
  const baseUrl = import.meta.env.BASE_URL || '/';

  // Initialize audio objects
  useEffect(() => {
    // Loaded once on mount, but incoming src will be updated dynamically
    outgoingAudioRef.current = createAudio(`${baseUrl}assets/audio/outgoing_ring.ogg`);
    incomingAudioRef.current = createAudio(`${baseUrl}assets/audio/fm-freemusic-give-me-a-smile(chosic.com).ogg`); // default

    return () => {
      if (outgoingAudioRef.current) {
        outgoingAudioRef.current.pause();
        outgoingAudioRef.current = null;
      }
      if (incomingAudioRef.current) {
        incomingAudioRef.current.pause();
        incomingAudioRef.current = null;
      }
    };
  }, []);

  // Handle call state changes for audio playback
  useEffect(() => {
    const playAudio = async (audio) => {
      try {
        if (audio) {
          audio.currentTime = 0;
          await audio.play();
        }
      } catch (error) {
        console.warn('Playback blocked by browser autoplay policy:', error);
      }
    };

    const stopAudio = (audio) => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };

    if (state.callState === 'calling') {
      playAudio(outgoingAudioRef.current);
      stopAudio(incomingAudioRef.current);
    } else if (state.callState === 'ringing') {
      // Update incoming ringtone from settings before playing
      const savedRingtone = localStorage.getItem('callRingtone') || 'fm-freemusic-give-me-a-smile(chosic.com).ogg';
      if (incomingAudioRef.current) {
        incomingAudioRef.current.src = `${baseUrl}assets/audio/${savedRingtone}`;
      }
      playAudio(incomingAudioRef.current);
      stopAudio(outgoingAudioRef.current);
    } else {
      stopAudio(outgoingAudioRef.current);
      stopAudio(incomingAudioRef.current);
    }

    return () => {
      // No cleanup here as we handle it inside the effect logic
    };
  }, [state.callState]);

  // Manual triggers for autoplay unlocking
  const playOutgoingRing = useCallback(() => {
    if (outgoingAudioRef.current && state.callState === 'calling') {
      outgoingAudioRef.current.play().catch(() => { });
    }
  }, [state.callState]);

  const playIncomingRing = useCallback(() => {
    if (incomingAudioRef.current && state.callState === 'ringing') {
      incomingAudioRef.current.play().catch(() => { });
    }
  }, [state.callState]);


  // Start duration timer
  const startDurationTimer = useCallback(() => {
    callStartTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      dispatch({ type: ACTIONS.SET_CALL_DURATION, payload: duration });
    }, 1000);
  }, []);

  // Stop duration timer
  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Handle incoming signal
  const handleSignal = useCallback(async (signal) => {
    console.log('📨 Signal received in context:', signal.signal_type, 'Call ID:', signal.call_id);

    try {
      if (signal.signal_type === 'offer') {
        // Incoming call - check if we are already in a call
        if (state.callState !== 'idle' && state.callState !== 'ringing') {
          console.log('📞 Busy: Already in a call. Ignoring new offer.');
          return;
        }

        const callerInfo = await callService.getUserById(signal.from_user_id).catch(err => ({
          id: signal.from_user_id,
          name: 'Unknown User',
          avatar: null
        }));

        dispatch({
          type: ACTIONS.SET_INCOMING_CALL,
          payload: {
            ...signal,
            callerInfo
          }
        });
        dispatch({ type: ACTIONS.SET_CALLER_INFO, payload: callerInfo });
        // Note: Ringtone is now handled in IncomingCallModal to comply with autoplay policies
      } else {
        // Handle other signals (answer, ice_candidate, call_end)
        try {
          await webRTCService.handleSignal(signal);
          // Mark signal as processed
          await callService.markSignalProcessed(signal.id);
        } catch (webrtcError) {
          console.warn('WebRTC signal handling error:', webrtcError);
        }
      }
    } catch (error) {
      console.error('Error in handleSignal:', error);
    }
  }, [state.callState]);

  // Check for pending signals (e.g. after reload)
  const checkPendingSignals = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      console.log('🔍 Checking for pending signals for:', currentUser.id);
      const signals = await callService.getPendingSignals(currentUser.id);

      if (signals && signals.length > 0) {
        console.log(`📡 Found ${signals.length} pending signals`);

        // Find the latest offer if any
        const latestOffer = [...signals]
          .reverse()
          .find(s => s.signal_type === 'offer');

        if (latestOffer) {
          const createdTime = new Date(latestOffer.created_at).getTime();
          const now = Date.now();
          // If offer is fresh enough (e.g. < 45s)
          if (now - createdTime < 45000) {
            await handleSignal(latestOffer);
          } else {
            console.log('⏳ Marking stale offer as processed');
            await callService.markSignalProcessed(latestOffer.id);
          }
        }

        // Process other signals (though they usually depend on active call)
        const otherSignals = signals.filter(s => s.signal_type !== 'offer');
        if (otherSignals.length > 0 && (state.callId || latestOffer)) {
          for (const signal of otherSignals) {
            await handleSignal(signal);
          }
        } else {
          // Mark all non-offer signals as processed if no active call
          const idsToMark = otherSignals.map(s => s.id);
          if (idsToMark.length > 0) {
            await callService.markSignalsProcessed(idsToMark);
          }
        }
      }
    } catch (error) {
      console.error('Error checking pending signals:', error);
    }
  }, [currentUser?.id, handleSignal, state.callId]);

  // Setup WebRTC callbacks
  useEffect(() => {
    webRTCService.onRemoteStream = (stream) => {
      console.log('🔊 Remote stream received in context');
      dispatch({ type: ACTIONS.SET_REMOTE_STREAM, payload: stream });
    };

    webRTCService.onCallEnd = (reason) => {
      console.log('📞 Call ended:', reason);
      stopDurationTimer();
      dispatch({ type: ACTIONS.RESET_CALL });
    };

    webRTCService.onConnectionStateChange = (state) => {
      if (state === 'connected') {
        startDurationTimer();
        dispatch({
          type: ACTIONS.SET_CALL_STATE,
          payload: { state: 'connected' }
        });
      }
    };
  }, [startDurationTimer, stopDurationTimer]);

  // Subscribe to signals and check pending
  useEffect(() => {
    if (currentUser?.id) {
      console.log('🔔 Setting up signal subscription for:', currentUser.id);

      // 1. Check for signals already in DB
      checkPendingSignals();

      // 2. Setup realtime subscription
      signalChannelRef.current = callService.subscribeToSignals(
        currentUser.id,
        handleSignal
      );

      return () => {
        if (signalChannelRef.current) {
          callService.unsubscribe(signalChannelRef.current);
        }
      };
    }
  }, [currentUser?.id, handleSignal, checkPendingSignals]);

  // Start outgoing call
  const startCall = useCallback(async (receiverId, callType = 'video') => {
    try {
      dispatch({
        type: ACTIONS.SET_CALL_STATE,
        payload: { state: 'calling', data: { callType } }
      });

      // Get receiver info
      const receiverInfo = await callService.getUserById(receiverId);
      dispatch({
        type: ACTIONS.SET_CALL_STATE,
        payload: { state: 'calling', data: { receiverInfo } }
      });

      const { callId, localStream } = await webRTCService.startCall(
        currentUser.id,
        receiverId,
        callType
      );

      dispatch({ type: ACTIONS.SET_LOCAL_STREAM, payload: localStream });
      dispatch({
        type: ACTIONS.SET_CALL_STATE,
        payload: { state: 'calling', data: { callId } }
      });

      return { callId, localStream };
    } catch (error) {
      console.error('❌ Error starting call:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      dispatch({ type: ACTIONS.RESET_CALL });
      throw error;
    }
  }, [currentUser?.id]);

  // Answer incoming call
  const answerCall = useCallback(async () => {
    try {
      const { incomingCall } = state;

      if (!incomingCall) {
        throw new Error('No incoming call to answer');
      }

      dispatch({
        type: ACTIONS.SET_CALL_STATE,
        payload: { state: 'connecting' }
      });

      const { localStream, remoteStream } = await webRTCService.answerCall(
        incomingCall.call_id,
        incomingCall.from_user_id,
        currentUser.id,
        incomingCall.signal_data
      );

      dispatch({ type: ACTIONS.SET_LOCAL_STREAM, payload: localStream });
      dispatch({ type: ACTIONS.SET_REMOTE_STREAM, payload: remoteStream });
      dispatch({
        type: ACTIONS.SET_CALL_STATE,
        payload: {
          state: 'connected',
          data: {
            callId: incomingCall.call_id,
            callType: incomingCall.signal_data.callType
          }
        }
      });

      // Mark signal as processed
      await callService.markSignalProcessed(incomingCall.id);

      startDurationTimer();
    } catch (error) {
      console.error('❌ Error answering call:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      dispatch({ type: ACTIONS.RESET_CALL });
      throw error;
    }
  }, [state, currentUser?.id, startDurationTimer]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    try {
      const { incomingCall } = state;

      if (incomingCall) {
        await webRTCService.rejectCall(
          incomingCall.call_id,
          currentUser.id,
          incomingCall.from_user_id
        );
        await callService.markSignalProcessed(incomingCall.id);
      }

      dispatch({ type: ACTIONS.RESET_CALL });
    } catch (error) {
      console.error('❌ Error rejecting call:', error);
      dispatch({ type: ACTIONS.RESET_CALL });
    }
  }, [state, currentUser?.id]);

  // End current call
  const endCall = useCallback(async () => {
    try {
      stopDurationTimer();
      await webRTCService.endCall(state.callDuration);
      dispatch({ type: ACTIONS.RESET_CALL });
    } catch (error) {
      console.error('❌ Error ending call:', error);
      dispatch({ type: ACTIONS.RESET_CALL });
    }
  }, [state.callDuration, stopDurationTimer]);

  // Toggle microphone
  const toggleMute = useCallback(() => {
    const isMuted = !webRTCService.toggleMicrophone();
    dispatch({ type: ACTIONS.TOGGLE_MUTE, payload: isMuted });
    return isMuted;
  }, []);

  // Toggle camera
  const toggleVideo = useCallback(() => {
    const isVideoOff = !webRTCService.toggleCamera();
    dispatch({ type: ACTIONS.TOGGLE_VIDEO, payload: isVideoOff });
    return isVideoOff;
  }, []);

  // Switch camera
  const switchCamera = useCallback(async () => {
    const newStream = await webRTCService.switchCamera();
    if (newStream) {
      dispatch({ type: ACTIONS.SET_LOCAL_STREAM, payload: newStream });
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const isScreenSharing = await webRTCService.toggleScreenShare();
    dispatch({ type: ACTIONS.TOGGLE_SCREEN_SHARE, payload: isScreenSharing });
    return isScreenSharing;
  }, []);

  const replaceLocalStream = useCallback(async (newStream) => {
    await webRTCService.replaceTrack(newStream.getVideoTracks()[0]);
    dispatch({ type: ACTIONS.REPLACE_LOCAL_STREAM, payload: newStream });
  }, []);

  const restoreCameraStream = useCallback(async () => {
    const newStream = await webRTCService.getLocalStream(true, true);
    await webRTCService.replaceTrack(newStream.getVideoTracks()[0]);
    dispatch({ type: ACTIONS.REPLACE_LOCAL_STREAM, payload: newStream });
  }, []);

  const value = {
    ...state,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    switchCamera,
    replaceLocalStream,
    restoreCameraStream,
    playOutgoingRing,
    playIncomingRing
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}
