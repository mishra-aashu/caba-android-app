import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';
import { realtimeManager } from '../utils/realtimeManager';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';

const GroupCallContext = createContext(null);

// Action Types
const ACTIONS = {
  SET_GROUP_CALL_STATE: 'SET_GROUP_CALL_STATE',
  SET_PARTICIPANTS: 'SET_PARTICIPANTS',
  ADD_PARTICIPANT: 'ADD_PARTICIPANT',
  REMOVE_PARTICIPANT: 'REMOVE_PARTICIPANT',
  UPDATE_PARTICIPANT: 'UPDATE_PARTICIPANT',
  SET_LOCAL_STREAM: 'SET_LOCAL_STREAM',
  SET_PARTICIPANT_STREAMS: 'SET_PARTICIPANT_STREAMS',
  TOGGLE_MUTE: 'TOGGLE_MUTE',
  TOGGLE_VIDEO: 'TOGGLE_VIDEO',
  TOGGLE_SCREEN_SHARE: 'TOGGLE_SCREEN_SHARE',
  SET_CALL_SETTINGS: 'SET_CALL_SETTINGS',
  SET_RECORDING_STATE: 'SET_RECORDING_STATE',
  SET_ERROR: 'SET_ERROR',
  RESET_GROUP_CALL: 'RESET_GROUP_CALL',
  SET_HOST_ID: 'SET_HOST_ID',
  UPDATE_PARTICIPANT_AUDIO: 'UPDATE_PARTICIPANT_AUDIO',
  SET_INCOMING_GROUP_CALL: 'SET_INCOMING_GROUP_CALL',
  SET_USER_GROUPS: 'SET_USER_GROUPS'
};

// Initial State
const initialState = {
  callState: 'idle', // idle, initiating, connecting, connected, ending
  callId: null,
  groupId: null,
  hostId: null,
  callType: null, // voice, video
  localStream: null,
  participants: [],
  participantStreams: new Map(), // userId -> MediaStream
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  isRecording: false,
  callSettings: {
    maxParticipants: 50,
    recordingEnabled: false,
    screenSharingEnabled: true,
    hostControls: true
  },
  duration: 0,
  error: null,
  roomConnection: null,
  incomingGroupCall: null,
  userGroups: [] // Cache of group IDs the user belongs to
};

// Reducer
function groupCallReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_GROUP_CALL_STATE:
      return { ...state, callState: action.payload.state, ...action.payload.data };

    case ACTIONS.SET_PARTICIPANTS:
      return { ...state, participants: action.payload };

    case ACTIONS.ADD_PARTICIPANT:
      return {
        ...state,
        participants: [...state.participants.filter(p => p.user_id !== action.payload.user_id), action.payload]
      };

    case ACTIONS.REMOVE_PARTICIPANT:
      return {
        ...state,
        participants: state.participants.filter(p => p.user_id !== action.payload),
        participantStreams: new Map([...state.participantStreams].filter(([userId]) => userId !== action.payload))
      };

    case ACTIONS.UPDATE_PARTICIPANT:
      return {
        ...state,
        participants: state.participants.map(p =>
          p.user_id === action.payload.userId
            ? { ...p, ...action.payload.updates }
            : p
        )
      };

    case ACTIONS.SET_LOCAL_STREAM:
      return { ...state, localStream: action.payload };

    case ACTIONS.SET_PARTICIPANT_STREAMS:
      return { ...state, participantStreams: action.payload };

    case ACTIONS.TOGGLE_MUTE:
      return { ...state, isMuted: action.payload };

    case ACTIONS.TOGGLE_VIDEO:
      return { ...state, isVideoOff: action.payload };

    case ACTIONS.TOGGLE_SCREEN_SHARE:
      return { ...state, isScreenSharing: action.payload };

    case ACTIONS.SET_CALL_SETTINGS:
      return { ...state, callSettings: { ...state.callSettings, ...action.payload } };

    case ACTIONS.SET_RECORDING_STATE:
      return { ...state, isRecording: action.payload };

    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };

    case ACTIONS.RESET_GROUP_CALL:
      return { ...initialState };

    case ACTIONS.SET_HOST_ID:
      return { ...state, hostId: action.payload };

    case ACTIONS.UPDATE_PARTICIPANT_AUDIO:
      return {
        ...state,
        participants: state.participants.map(p =>
          p.user_id === action.payload.userId
            ? { ...p, is_speaking: action.payload.isSpeaking, audio_level: action.payload.audioLevel }
            : p
        )
      };

    case ACTIONS.SET_INCOMING_GROUP_CALL:
      return { ...state, incomingGroupCall: action.payload };

    case ACTIONS.SET_USER_GROUPS:
      return { ...state, userGroups: action.payload };

    default:
      return state;
  }
}

// Provider Component
export function GroupCallProvider({ children, currentUser }) {
  const { session } = useAuth();
  const [state, dispatch] = useReducer(groupCallReducer, initialState);
  const peerConnectionsRef = useRef(new Map()); // userId -> RTCPeerConnection
  const roomChannelRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const userGroupsRef = useRef([]); // Ref to track user groups without triggering re-renders

  // Fetch user groups to filter incoming calls
  useEffect(() => {
    if (currentUser?.id) {
      const fetchUserGroups = async () => {
        const { data, error } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', currentUser.id);

        if (!error && data) {
          const groupIds = data.map(m => m.group_id);
          console.log('👥 Fetched user groups for notification filtering:', groupIds);
          userGroupsRef.current = groupIds;
          dispatch({ type: ACTIONS.SET_USER_GROUPS, payload: groupIds });
        } else if (error) {
          console.error('❌ Error fetching user groups:', error);
        }
      };
      fetchUserGroups();
    }
  }, [currentUser?.id]);

  // Global listener for new group calls
  useEffect(() => {
    if (!currentUser?.id) return;

    console.log('📡 Setting up global group call listener...');

    realtimeManager.subscribe(
      'global_group_calls',
      {},
      {
        postgres_changes: [
          {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            handler: async (payload) => {
              const newCall = payload.new;
              console.log('📞 Global call INSERT:', newCall);
              // Debug: Immediate toast on any insert
              toast.success(`Debug: Call insert detected!`, { id: 'realtime-insert' });

              if (!newCall.is_group_call) return;
              if (newCall.caller_id === currentUser.id) return;
              if (newCall.status !== 'initiated') return;

              const isMember = userGroupsRef.current.includes(newCall.group_id);
              console.log(`🔍 Group membership for ${newCall.group_id}: ${isMember}`, userGroupsRef.current);

              if (!isMember) {
                toast.error(`Debug: Not a member of group ${newCall.group_id}`, { id: 'realtime-not-member' });
                return;
              }

              // Debug toast to confirm listener passed filters
              toast.success(`Debug: All filters passed! Fetching details...`, { id: 'debug-filters-passed' });

              try {
                const [{ data: group }, { data: caller }] = await Promise.all([
                  supabase.from('groups').select('name').eq('id', newCall.group_id).single(),
                  supabase.from('users').select('name, avatar').eq('id', newCall.caller_id).single()
                ]);

                console.log('📦 Dispatching SET_INCOMING_GROUP_CALL', newCall.group_id);
                dispatch({
                  type: ACTIONS.SET_INCOMING_GROUP_CALL,
                  payload: {
                    ...newCall,
                    groupName: group?.name || 'Group',
                    callerName: caller?.name || 'Someone',
                    callerAvatar: caller?.avatar
                  }
                });
                toast.success('Debug: SET_INCOMING_GROUP_CALL dispatched!');
              } catch (err) {
                console.error('Error fetching incoming group call info:', err);
                toast.error(`Error: Failed to fetch call details: ${err.message}`);
              }
            }
          },
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            handler: (payload) => {
              const updatedCall = payload.new;
              if (!updatedCall.is_group_call) return;

              console.log('📞 Global call UPDATE:', updatedCall.status);
              if (['ended', 'cancelled', 'completed'].includes(updatedCall.status)) {
                dispatch({ type: ACTIONS.SET_INCOMING_GROUP_CALL, payload: null });
              }
            }
          }
        ]
      }
    );

    return () => {
      realtimeManager.unsubscribe('global_group_calls');
    };
  }, [currentUser?.id]);

  // Start duration timer
  const startDurationTimer = useCallback(() => {
    callStartTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      // You can add duration to state if needed
    }, 1000);
  }, []);

  // Stop duration timer
  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Add participant to call
  const addParticipantToCall = useCallback(async (callId, userId, role = 'participant') => {
    try {
      const { error } = await supabase
        .from('group_call_participants')
        .insert({
          call_id: callId,
          user_id: userId,
          participant_role: role,
          is_video_enabled: role === 'host' ? true : (arguments[3] !== undefined ? arguments[3] : true),
          is_muted: false
        });

      if (error) throw error;

      // Fetch user details
      const { data: user } = await supabase
        .from('users')
        .select('id, name, avatar')
        .eq('id', userId)
        .single();

      if (user) {
        dispatch({
          type: ACTIONS.ADD_PARTICIPANT,
          payload: {
            user_id: userId,
            name: user.name,
            avatar: user.avatar,
            participant_role: role,
            is_muted: false,
            is_video_enabled: true,
            is_screen_sharing: false,
            is_speaking: false,
            audio_level: 0.0,
            joined_at: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Error adding participant:', error);
    }
  }, []);

  // Setup room signaling
  const setupRoomSignaling = useCallback(async (callId, roomId) => {
    try {
      // Subscribe to room signaling channel
      const channelName = `group_call_${roomId}`;

      roomChannelRef.current = realtimeManager.subscribe(
        channelName,
        {},
        {
          postgres_changes: [
            {
              event: '*',
              schema: 'public',
              table: 'group_call_participants',
              filter: `call_id=eq.${callId}`,
              handler: (payload) => handleParticipantChange(payload)
            },
            {
              event: '*',
              schema: 'public',
              table: 'webrtc_signals',
              filter: `call_id=eq.${callId}`,
              handler: (payload) => handleWebRTCSignal(payload.new)
            }
          ]
        }
      );

    } catch (error) {
      console.error('Error setting up room signaling:', error);
    }
  }, []);

  // Handle participant changes
  const handleParticipantChange = useCallback((payload) => {
    const { eventType, new: record, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      // Participant joined
      dispatch({ type: ACTIONS.ADD_PARTICIPANT, payload: record });
    } else if (eventType === 'UPDATE') {
      // Participant updated (mute, video, etc.)
      dispatch({
        type: ACTIONS.UPDATE_PARTICIPANT,
        payload: {
          userId: record.user_id,
          updates: {
            is_muted: record.is_muted,
            is_video_enabled: record.is_video_enabled,
            is_screen_sharing: record.is_screen_sharing,
            is_speaking: record.is_speaking,
            audio_level: record.audio_level
          }
        }
      });
    } else if (eventType === 'DELETE') {
      // Participant left
      dispatch({ type: ACTIONS.REMOVE_PARTICIPANT, payload: oldRecord.user_id });
    }
  }, []);

  // Handle WebRTC signals
  const handleWebRTCSignal = useCallback(async (signal) => {
    try {
      if (signal.to_user_id === currentUser.id) {
        await processWebRTCSignal(signal);
      }
    } catch (error) {
      console.error('Error processing WebRTC signal:', error);
    }
  }, [currentUser?.id]);

  // Process WebRTC signal
  const processWebRTCSignal = useCallback(async (signal) => {
    const { signal_type, signal_data, from_user_id } = signal;
    let peerConnection = peerConnectionsRef.current.get(from_user_id);

    if (signal_type === 'offer') {
      if (!peerConnection) {
        peerConnection = await createPeerConnection(from_user_id);
        peerConnectionsRef.current.set(from_user_id, peerConnection);
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal_data));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer back
      await sendWebRTCSignal(from_user_id, 'answer', answer);
    } else if (signal_type === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal_data));
    } else if (signal_type === 'ice_candidate') {
      await peerConnection.addIceCandidate(new RTCIceCandidate(signal_data));
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(async (userId) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local stream
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, state.localStream);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      const newStreams = new Map(state.participantStreams);
      newStreams.set(userId, remoteStream);
      dispatch({ type: ACTIONS.SET_PARTICIPANT_STREAMS, payload: newStreams });
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendWebRTCSignal(userId, 'ice_candidate', event.candidate);
      }
    };

    return peerConnection;
  }, [state.localStream, state.participantStreams]);

  // Send WebRTC signal
  const sendWebRTCSignal = useCallback(async (toUserId, signalType, signalData) => {
    try {
      await supabase
        .from('webrtc_signals')
        .insert({
          from_user_id: currentUser.id,
          to_user_id: toUserId,
          call_id: state.callId,
          group_id: state.groupId,
          signal_type: signalType,
          signal_data: signalData,
          room_id: state.roomConnection?.roomId,
          broadcast_type: 'room'
        });
    } catch (error) {
      console.error('Error sending WebRTC signal:', error);
    }
  }, [currentUser?.id, state.callId, state.groupId, state.roomConnection]);

  // Initialize group call
  const initializeGroupCall = useCallback(async (groupId, callType = 'video') => {
    try {
      dispatch({
        type: ACTIONS.SET_GROUP_CALL_STATE,
        payload: { state: 'initiating', data: { groupId, callType } }
      });

      // Get local media stream
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true
      });

      dispatch({ type: ACTIONS.SET_LOCAL_STREAM, payload: localStream });

      // Create call record in database
      const { data: call, error } = await supabase
        .from('calls')
        .insert({
          group_id: groupId,
          caller_id: currentUser.id,
          host_id: currentUser.id,
          call_type: callType,
          status: 'initiated',
          is_group_call: true,
          room_id: `group_${groupId}_${Date.now()}`,
          call_participants: [],
          max_participants: 50
        })
        .select()
        .single();

      if (error) {
        console.error('Database error creating call:', error);
        console.error('Full error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      dispatch({
        type: ACTIONS.SET_GROUP_CALL_STATE,
        payload: {
          state: 'connecting',
          data: { callId: call.id, hostId: currentUser.id }
        }
      });

      // Add host as first participant
      await addParticipantToCall(call.id, currentUser.id, 'host');

      // Setup room signaling
      await setupRoomSignaling(call.id, call.room_id);

      return call;
    } catch (error) {
      console.error('Error initializing group call:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      dispatch({ type: ACTIONS.RESET_GROUP_CALL });
      throw error;
    }
  }, [currentUser?.id, addParticipantToCall, setupRoomSignaling]);

  // Join group call
  const joinGroupCall = useCallback(async (callId, withVideo = true) => {
    try {
      // Get call details
      const { data: call, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .maybeSingle();

      if (error || !call) throw new Error('Call not found');

      dispatch({
        type: ACTIONS.SET_GROUP_CALL_STATE,
        payload: {
          state: 'connecting',
          data: {
            callId,
            groupId: call.group_id,
            callType: call.call_type,
            isVideoOff: !withVideo
          }
        }
      });

      // Get local media stream
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: withVideo && call.call_type === 'video',
        audio: true
      });

      // If video was disabled by preference, ensure tracks are disabled
      if (!withVideo) {
        localStream.getVideoTracks().forEach(track => track.enabled = false);
      }

      dispatch({ type: ACTIONS.SET_LOCAL_STREAM, payload: localStream });

      // Add participant to call
      await addParticipantToCall(callId, currentUser.id, 'participant', withVideo);

      // Setup room signaling
      await setupRoomSignaling(callId, call.room_id);

      // Create peer connections with existing participants
      const { data: participants } = await supabase
        .from('group_call_participants')
        .select('user_id')
        .eq('call_id', callId)
        .neq('user_id', currentUser.id);

      if (participants) {
        for (const participant of participants) {
          const peerConnection = await createPeerConnection(participant.user_id);
          peerConnectionsRef.current.set(participant.user_id, peerConnection);

          // Send offer to this participant
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          await sendWebRTCSignal(participant.user_id, 'offer', offer);
        }
      }

      dispatch({
        type: ACTIONS.SET_GROUP_CALL_STATE,
        payload: { state: 'connected' }
      });

      startDurationTimer();
    } catch (error) {
      console.error('Error joining group call:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      dispatch({ type: ACTIONS.RESET_GROUP_CALL });
    }
  }, [currentUser?.id, addParticipantToCall, setupRoomSignaling, createPeerConnection, sendWebRTCSignal, startDurationTimer]);

  // Leave group call
  const leaveGroupCall = useCallback(async () => {
    try {
      stopDurationTimer();

      // Update participant record
      if (state.callId && currentUser?.id) {
        await supabase
          .from('group_call_participants')
          .update({ left_at: new Date().toISOString() })
          .eq('call_id', state.callId)
          .eq('user_id', currentUser.id);
      }

      // Close all peer connections
      peerConnectionsRef.current.forEach((pc, userId) => {
        pc.close();
      });
      peerConnectionsRef.current.clear();

      // Stop local stream
      if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
      }

      // Unsubscribe from room channel
      if (roomChannelRef.current) {
        realtimeManager.unsubscribe(roomChannelRef.current);
      }

      dispatch({ type: ACTIONS.RESET_GROUP_CALL });
    } catch (error) {
      console.error('Error leaving group call:', error);
      dispatch({ type: ACTIONS.RESET_GROUP_CALL });
    }
  }, [state.callId, state.localStream, currentUser?.id, stopDurationTimer]);

  // Toggle microphone
  const toggleMute = useCallback(() => {
    if (state.localStream) {
      const audioTracks = state.localStream.getAudioTracks();
      const newMuteState = !state.isMuted;

      audioTracks.forEach(track => {
        track.enabled = !newMuteState;
      });

      dispatch({ type: ACTIONS.TOGGLE_MUTE, payload: newMuteState });

      // Update database
      if (state.callId && currentUser?.id) {
        supabase
          .from('group_call_participants')
          .update({ is_muted: newMuteState })
          .eq('call_id', state.callId)
          .eq('user_id', currentUser.id);
      }
    }
  }, [state.localStream, state.isMuted, state.callId, currentUser?.id]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (state.localStream) {
      const videoTracks = state.localStream.getVideoTracks();
      const newVideoState = !state.isVideoOff;

      videoTracks.forEach(track => {
        track.enabled = !newVideoState;
      });

      dispatch({ type: ACTIONS.TOGGLE_VIDEO, payload: newVideoState });

      // Update database
      if (state.callId && currentUser?.id) {
        supabase
          .from('group_call_participants')
          .update({ is_video_enabled: !newVideoState })
          .eq('call_id', state.callId)
          .eq('user_id', currentUser.id);
      }
    }
  }, [state.localStream, state.isVideoOff, state.callId, currentUser?.id]);

  // Update participant audio level (for speaking indicator)
  const updateParticipantAudioLevel = useCallback((userId, isSpeaking, audioLevel = 0.0) => {
    dispatch({
      type: ACTIONS.UPDATE_PARTICIPANT_AUDIO,
      payload: { userId, isSpeaking, audioLevel }
    });

    // Update database periodically
    if (state.callId) {
      supabase.rpc('update_participant_speaking_status', {
        p_call_id: state.callId,
        p_user_id: userId,
        p_is_speaking: isSpeaking,
        p_audio_level: audioLevel
      });
    }
  }, [state.callId]);

  const value = {
    ...state,
    initializeGroupCall,
    joinGroupCall,
    leaveGroupCall,
    toggleMute,
    toggleVideo,
    updateParticipantAudioLevel,
    participantStreams: state.participantStreams,
    incomingGroupCall: state.incomingGroupCall,
    clearIncomingGroupCall: () => dispatch({ type: ACTIONS.SET_INCOMING_GROUP_CALL, payload: null })
  };

  return (
    <GroupCallContext.Provider value={value}>
      {children}
    </GroupCallContext.Provider>
  );
}

// Custom Hook
export function useGroupCall() {
  const context = useContext(GroupCallContext);
  if (!context) {
    throw new Error('useGroupCall must be used within a GroupCallProvider');
  }
  return context;
}

export default GroupCallContext;
