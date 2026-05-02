import React, { useReducer, useCallback, useEffect, useRef } from 'react';
import { onSWNeedRefresh, activateSWUpdate } from '../pwa';
import { isNativeWithPlugins, safePluginCall } from '../utils/platformCheck';
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
  const historyChannelRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const outgoingAudioRef = useRef(null);
  const incomingAudioRef = useRef(null);
  const incomingAudioPromiseRef = useRef(null);
  const outgoingAudioPromiseRef = useRef(null);
  const ringTimeoutRef = useRef(null);

  // Callback refs to keep handlers stable for realtime subscriptions
  const handleSignalRef = useRef(null);
  const checkPendingSignalsRef = useRef(null);
  const callStateRef = useRef(state.callState);

  // Keep callStateRef in sync
  useEffect(() => {
    callStateRef.current = state.callState;
  }, [state.callState]);

  // Helper to get absolute asset path
  const getAssetPath = useCallback((path) => {
    // Ensuring root-relative path (relative to origin)
    // Using simple relative paths works better in Capacitor WebViews
    return path.startsWith('/') ? path : `/${path}`;
  }, []);

  // Initialize audio objects
  useEffect(() => {
    // Loaded once on mount, but incoming src will be updated dynamically
    outgoingAudioRef.current = createAudio(getAssetPath('assets/audio/outgoing_ring.ogg'));
    incomingAudioRef.current = createAudio(getAssetPath('assets/audio/fm-freemusic-give-me-a-smile(chosic.com).ogg')); // default

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
  }, [getAssetPath]);

  // Handle call state changes for audio playback
  useEffect(() => {
    const playAudio = async (audio, promiseRef) => {
      try {
        if (!audio) return;
        
        // If there's an existing play promise, wait for it or ignore it
        // Note: Browsers usually handle multiple play() calls, but let's be safe
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          promiseRef.current = playPromise;
          await playPromise;
          promiseRef.current = null;
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn('Playback blocked or interrupted:', error);
        }
      }
    };

    const stopAudio = async (audio, promiseRef) => {
      if (!audio) return;
      
      try {
        // If there's a pending play promise, wait for it before pausing
        // to avoid "The play() request was interrupted by a call to pause()"
        if (promiseRef.current) {
          try {
            await promiseRef.current;
          } catch (e) {
            // Ignore play errors when we are about to stop anyway
          }
          promiseRef.current = null;
        }
        
        audio.pause();
        audio.currentTime = 0;
      } catch (error) {
        console.warn('Error stopping audio:', error);
      }
    };

    console.log('🎵 Audio state controller:', state.callState);

    if (state.callState === 'calling') {
      playAudio(outgoingAudioRef.current, outgoingAudioPromiseRef);
      stopAudio(incomingAudioRef.current, incomingAudioPromiseRef);
    } else if (state.callState === 'ringing') {
      // Update incoming ringtone from settings before playing
      const savedRingtone = localStorage.getItem('callRingtone') || 'fm-freemusic-give-me-a-smile(chosic.com).ogg';
      if (incomingAudioRef.current) {
        incomingAudioRef.current.src = getAssetPath(`assets/audio/${savedRingtone}`);
      }
      playAudio(incomingAudioRef.current, incomingAudioPromiseRef);
      stopAudio(outgoingAudioRef.current, outgoingAudioPromiseRef);
    } else {
      // Critical: Ensure both are stopped when connected or idle
      stopAudio(outgoingAudioRef.current, outgoingAudioPromiseRef);
      stopAudio(incomingAudioRef.current, incomingAudioPromiseRef);
    }

    return () => {
      // No cleanup needed here as stopAudio handles it, but let's be safe
    };
  }, [state.callState, getAssetPath]);

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
    console.log('📨 Signal received in context:', signal.signal_type, 'Call ID:', signal.call_id, 'From:', signal.from_user_id);

    try {
      if (signal.signal_type === 'offer') {
        // Incoming call - check if we are already in a call
        if (state.callState !== 'idle' && state.callState !== 'ringing') {
          console.log(`📞 Busy: Current state is ${state.callState}. Ignoring new offer.`);
          return;
        }

        // [OPTIMIZATION] Dispatch IMMEDIATELY with placeholder info to show UI without delay
        const placeholderInfo = {
          id: signal.from_user_id,
          name: 'Loading...',
          avatar: null
        };

        dispatch({
          type: ACTIONS.SET_INCOMING_CALL,
          payload: {
            ...signal,
            callerInfo: placeholderInfo
          }
        });

        // Clear existing ring timeout
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        
        // Set a timeout to auto-reject if not answered (missed call)
        ringTimeoutRef.current = setTimeout(() => {
          console.log('🕒 Call ring timeout reached - marking as missed');
          dispatch({ type: ACTIONS.RESET_CALL });
          ringTimeoutRef.current = null;
        }, 45000);

        // Load REAL user info in background
        callService.getUserById(signal.from_user_id)
          .then(callerInfo => {
            console.log('👤 Caller info resolved:', callerInfo.name);
            dispatch({
              type: ACTIONS.SET_INCOMING_CALL,
              payload: {
                ...signal,
                callerInfo
              }
            });
            dispatch({ type: ACTIONS.SET_CALLER_INFO, payload: callerInfo });
          })
          .catch(err => {
            console.warn('Failed to load caller info:', err);
            const fallbackInfo = {
              id: signal.from_user_id,
              name: 'Unknown User',
              avatar: null
            };
            dispatch({
              type: ACTIONS.SET_INCOMING_CALL,
              payload: {
                ...signal,
                callerInfo: fallbackInfo
              }
            });
          });
      } else {
        // Handle other signals (answer, ice_candidate, call_end)
        try {
          if (signal.signal_type === 'call_end') {
            if (ringTimeoutRef.current) {
              clearTimeout(ringTimeoutRef.current);
              ringTimeoutRef.current = null;
            }
          }
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

  // Handle call history update (fallback for signals)
  const handleCallHistoryUpdate = useCallback(async (payload) => {
    const { eventType, new: newCall } = payload;
    console.log('📜 Call history event:', eventType, newCall?.call_status);

    if ((eventType === 'INSERT' || eventType === 'UPDATE') && newCall?.call_status === 'initiated') {
      // If we are already in a call, ignore
      if (state.callState !== 'idle' && state.callState !== 'ringing') return;

      console.log('📞 Detected initiated call in history, checking for signals...');
      // Give it a tiny bit of time for the signal to arrive naturally
      setTimeout(() => {
        if (checkPendingSignalsRef.current) checkPendingSignalsRef.current();
      }, 1000);
    } else if (eventType === 'UPDATE' && ['ended', 'missed', 'rejected'].includes(newCall?.call_status)) {
      // If call was ended remotely, cleanup
      if (state.callId === newCall.call_id) {
        console.log('📞 Call was ended in database');
        dispatch({ type: ACTIONS.RESET_CALL });
      }
    }
  }, [state.callState, state.callId]);

  // Update handler ref whenever it changes
  useEffect(() => {
    handleSignalRef.current = handleSignal;
  }, [handleSignal]);

  const handleCallHistoryUpdateRef = useRef(null);
  useEffect(() => {
    handleCallHistoryUpdateRef.current = handleCallHistoryUpdate;
  }, [handleCallHistoryUpdate]);

  // Check for pending signals (e.g. after reload)
  const checkPendingSignals = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      // 1. Check signaling table
      const signals = await callService.getPendingSignals(currentUser.id);
      if (signals && signals.length > 0) {
        console.log(`📡 Found ${signals.length} pending signals via check`);
        const latestOffer = [...signals].reverse().find(s => s.signal_type === 'offer');
        if (latestOffer) {
          const createdTime = new Date(latestOffer.created_at).getTime();
          if (Date.now() - createdTime < 60000) {
            await handleSignal(latestOffer);
            return; // Offer handled
          }
        }
      }

      // 2. Check history table as secondary trigger if no active call
      if (state.callState === 'idle') {
        const incomingCalls = await callService.getIncomingCalls(currentUser.id);
        if (incomingCalls && incomingCalls.length > 0) {
          const latestCall = incomingCalls[0];
          const createdTime = new Date(latestCall.started_at).getTime();
          if (Date.now() - createdTime < 60000) {
            console.log('📜 Found pending call in history but no signal yet');
            
            // Show the modal even without the signal data yet
            // We'll use placeholder data until signal arrives
            const callerInfo = await callService.getUserById(latestCall.caller_id).catch(() => ({
              id: latestCall.caller_id,
              name: 'Unknown User',
              avatar: null
            }));

            dispatch({
              type: ACTIONS.SET_INCOMING_CALL,
              payload: {
                call_id: latestCall.call_id,
                from_user_id: latestCall.caller_id,
                signal_type: 'offer',
                signal_data: { callType: latestCall.call_type }, // placeholder
                callerInfo
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking pending signals:', error);
    }
  }, [currentUser?.id, handleSignal, state.callState, state.callId]);

  // Update checkPendingSignals ref
  useEffect(() => {
    checkPendingSignalsRef.current = checkPendingSignals;
  }, [checkPendingSignals]);

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
      console.log('🔔 Setting up call subscriptions for:', currentUser.id);

      // 1. Initial checks
      checkPendingSignals();

      // 2. Setup stable realtime subscriptions
      const stableSignalHandler = (signal) => {
        if (handleSignalRef.current) handleSignalRef.current(signal);
      };

      const stableHistoryHandler = (payload) => {
        if (handleCallHistoryUpdateRef.current) handleCallHistoryUpdateRef.current(payload);
      };

      signalChannelRef.current = callService.subscribeToSignals(currentUser.id, stableSignalHandler);
      historyChannelRef.current = callService.subscribeToCallHistory(currentUser.id, stableHistoryHandler);

      // Polling fallback removed to prevent network spam.
      // Realtime (WS) handles instant delivery. 
      // Periodic reconciliation is synchronized with the global SyncHeartbeat.
      const handleHeartbeat = () => {
        if (callStateRef.current === 'idle' && checkPendingSignalsRef.current) {
          console.log('[CallProvider] Heartbeat sync: Checking pending signals');
          checkPendingSignalsRef.current();
        }
      };

      window.addEventListener('app:sync-heartbeat', handleHeartbeat);
      
      return () => {
        if (signalChannelRef.current) callService.unsubscribe(signalChannelRef.current);
        if (historyChannelRef.current) callService.unsubscribe(historyChannelRef.current);
        window.removeEventListener('app:sync-heartbeat', handleHeartbeat);
      };
    }
  }, [currentUser?.id, state.callState]); // Re-setup if user changes, or polling check logic depends on state

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

      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
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
    playIncomingRing,
    checkPendingSignals: () => {
        if (state.callState === 'idle' && checkPendingSignalsRef.current) {
            checkPendingSignalsRef.current();
        }
    }
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}
