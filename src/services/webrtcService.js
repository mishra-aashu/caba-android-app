import callService from './callService';
import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins, safePluginCall } from '../utils/platformCheck';
import { ICE_SERVERS, WEBRTC_CONFIG } from '../constants/webrtcConfig';
import { generateCallId } from '../utils/idGenerators';

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.callId = null;
    this.currentUserId = null;
    this.remoteUserId = null;
    this.onRemoteStream = null;
    this.onCallEnd = null;
    this.onConnectionStateChange = null;
    this.iceCandidatesQueue = [];
    this.isScreenSharing = false;
    this.originalVideoTrack = null;
    this.screenStream = null;

    // Load TURN servers configuration
    this.loadTurnConfig();
  }

  /**
   * Load TURN/STUN server configuration
   */
  loadTurnConfig() {
    try {
      // Try to load from global config first (from turn-config.js)
      if (window.FREE_TURN_SERVERS) {
        this.rtcConfig = window.FREE_TURN_SERVERS;
        console.log('✅ Loaded TURN servers from global config');
        return;
      }

      this.rtcConfig = WEBRTC_CONFIG;
      console.log('✅ Loaded shared TURN/STUN configuration');
    } catch (error) {
      console.error('❌ Error loading TURN config:', error);
      // Ultimate fallback to basic STUN
      this.rtcConfig = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
    }
  }

  /**
   * Generate unique call ID (Redirected to shared utility)
   */
  generateCallId() {
    return generateCallId();
  }

  /**
   * Request media permissions for Camera and Microphone
   */
  async requestMediaPermissions(video = true, audio = true) {
    if (!isNativeWithPlugins()) {
      console.log('Checking permissions on web...');
      try {
        // Just a check, the real stream is acquired later
        const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (e) {
        console.error("❌ Web permission error:", e);
        throw e;
      }
    }

    // On native platforms (Android/iOS)
    try {
      if (video) {
        console.log('Requesting camera permissions...');
        const cameraPermissions = await safePluginCall(
          () => import('@capacitor/camera'),
          (mod) => mod.Camera.requestPermissions({ permissions: ['camera', 'photos'] })
        );
        if (cameraPermissions?.camera !== 'granted') {
          throw new Error('Camera permission was denied.');
        }
      }

      if (audio) {
        console.log('Requesting microphone permissions via getUserMedia...');
        // On Android, the WebView doesn't always automatically proxy the request to the OS
        // unless you trigger it. Capacitor 6 bridge usually handles this if declared in manifest,
        // but a direct getUserMedia call is the most reliable "trigger".
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          stream.getTracks().forEach(track => track.stop());
          console.log('🎤 Microphone permission granted.');
        } catch (audioError) {
          console.error("❌ Microphone access failed:", audioError);
          throw new Error("Microphone permission denied or hardware unavailable");
        }
      }

      return true;
    } catch (e) {
      console.error("❌ Native permission request error:", e);
      // Re-throw with a more descriptive message if it's a known error
      if (e.name === 'NotAllowedError' || e.message?.includes('denied')) {
        throw new Error("Permissions denied by user");
      }
      throw e;
    }
  }

  /**
   * Get local media stream after ensuring permissions.
   */
  async getLocalStream(video = true, audio = true) {
    try {
      // First, ensure we have permissions.
      await this.requestMediaPermissions(video, audio);

      // Now, get the actual stream.
      const constraints = {
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false,
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('🎥 Local stream acquired');
      return this.localStream;
    } catch (error) {
      console.error('❌ Error getting local stream:', error.name, error.message);
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        throw new Error("Permission denied");
      }
      throw error;
    }
  }

  /**
   * Initialize peer connection
   */
  initializePeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.remoteStream = new MediaStream();

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle incoming tracks
    this.peerConnection.ontrack = (event) => {
      console.log('🔊 Remote track received');
      event.streams[0].getTracks().forEach(track => {
        this.remoteStream.addTrack(track);
      });
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated');
        await this.sendIceCandidate(event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('📡 Connection state:', this.peerConnection.connectionState);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }

      if (['disconnected', 'failed', 'closed'].includes(this.peerConnection.connectionState)) {
        if (this.onCallEnd) {
          this.onCallEnd('connection_failed');
        }
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
    };

    return this.peerConnection;
  }

  /**
   * Start outgoing call
   */
  async startCall(callerId, receiverId, callType = 'video') {
    try {
      this.currentUserId = callerId;
      this.remoteUserId = receiverId;
      this.callId = this.generateCallId();

      console.log('📞 Starting call:', this.callId, 'from:', callerId, 'to:', receiverId);

      // Get local stream
      await this.getLocalStream(callType === 'video', true);

      // Initialize peer connection
      this.initializePeerConnection();

      // Create call record in database
      await callService.createCall(callerId, receiverId, this.callId, callType);

      // Create and send offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video'
      });

      await this.peerConnection.setLocalDescription(offer);

      // Send offer through signaling
      await callService.sendSignal(
        this.callId,
        callerId,
        receiverId,
        'offer',
        {
          sdp: offer.sdp,
          type: offer.type,
          callType: callType
        }
      );

      console.log('📤 Offer sent for call:', this.callId);
      return { callId: this.callId, localStream: this.localStream };

    } catch (error) {
      console.error('❌ Error starting call:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Answer incoming call
   */
  async answerCall(callId, callerId, receiverId, offerData) {
    try {
      this.callId = callId;
      this.currentUserId = receiverId;
      this.remoteUserId = callerId;

      console.log('📞 Answering call:', callId, 'from:', callerId, 'to:', receiverId);

      // Get local stream
      const callType = offerData.callType || 'video';
      await this.getLocalStream(callType === 'video', true);

      // Initialize peer connection
      this.initializePeerConnection();

      // Set remote description (the offer)
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({
          type: offerData.type,
          sdp: offerData.sdp
        })
      );

      // Process any queued ICE candidates
      await this.processQueuedIceCandidates();

      // Create answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send answer through signaling
      await callService.sendSignal(
        callId,
        receiverId,
        callerId,
        'answer',
        {
          sdp: answer.sdp,
          type: answer.type
        }
      );

      // Update call status
      await callService.updateCallStatus(callId, 'answered');

      console.log('📤 Answer sent for call:', callId);
      return { localStream: this.localStream, remoteStream: this.remoteStream };

    } catch (error) {
      console.error('❌ Error answering call:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Handle received answer
   */
  async handleAnswer(answerData) {
    try {
      if (!this.peerConnection) {
        console.error('No peer connection');
        return;
      }

      console.log('📥 Processing answer');

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({
          type: answerData.type,
          sdp: answerData.sdp
        })
      );

      // Process queued ICE candidates
      await this.processQueuedIceCandidates();

      // Update call status
      await callService.updateCallStatus(this.callId, 'answered');

    } catch (error) {
      console.error('❌ Error handling answer:', error);
      throw error;
    }
  }

  /**
   * Send ICE candidate
   */
  async sendIceCandidate(candidate) {
    try {
      await callService.sendSignal(
        this.callId,
        this.currentUserId,
        this.remoteUserId,
        'ice_candidate',
        {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex
        }
      );
    } catch (error) {
      console.error('❌ Error sending ICE candidate:', error);
    }
  }

  /**
   * Handle received ICE candidate
   */
  async handleIceCandidate(candidateData) {
    try {
      const candidate = new RTCIceCandidate({
        candidate: candidateData.candidate,
        sdpMid: candidateData.sdpMid,
        sdpMLineIndex: candidateData.sdpMLineIndex
      });

      if (this.peerConnection && this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(candidate);
        console.log('🧊 ICE candidate added');
      } else {
        // Queue the candidate
        this.iceCandidatesQueue.push(candidate);
        console.log('🧊 ICE candidate queued');
      }
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  }

  /**
   * Process queued ICE candidates
   */
  async processQueuedIceCandidates() {
    while (this.iceCandidatesQueue.length > 0) {
      const candidate = this.iceCandidatesQueue.shift();
      try {
        await this.peerConnection.addIceCandidate(candidate);
        console.log('🧊 Queued ICE candidate added');
      } catch (error) {
        console.error('❌ Error adding queued candidate:', error);
      }
    }
  }

  /**
   * Reject incoming call
   */
  async rejectCall(callId, fromUserId, toUserId) {
    try {
      await callService.sendSignal(callId, fromUserId, toUserId, 'call_end', {
        reason: 'rejected'
      });
      await callService.updateCallStatus(callId, 'rejected');
    } catch (error) {
      console.error('❌ Error rejecting call:', error);
    }
  }

  /**
   * End call
   */
  async endCall(duration = 0) {
    try {
      if (this.callId && this.remoteUserId) {
        // Notify remote user
        await callService.sendSignal(
          this.callId,
          this.currentUserId,
          this.remoteUserId,
          'call_end',
          { reason: 'ended', duration }
        );

        // Update call record
        await callService.endCall(this.callId, duration);
      }

      this.cleanup();
    } catch (error) {
      console.error('❌ Error ending call:', error);
      this.cleanup();
    }
  }

  /**
   * Toggle microphone
   */
  toggleMicrophone() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  /**
   * Toggle camera
   */
  toggleCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        const currentFacingMode = videoTrack.getSettings().facingMode;
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: newFacingMode }
          });

          const newVideoTrack = newStream.getVideoTracks()[0];

          // Replace track in peer connection
          const sender = this.peerConnection?.getSenders()
            .find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }

          // Stop old track and update local stream
          videoTrack.stop();
          this.localStream.removeTrack(videoTrack);
          this.localStream.addTrack(newVideoTrack);

          return this.localStream;
        } catch (error) {
          console.error('❌ Error switching camera:', error);
        }
      }
    }
    return null;
  }

  /**
   * Replace the video track in the peer connection
   */
  async replaceTrack(newTrack) {
    if (this.peerConnection) {
      const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
    }
  }

  /**
   * Toggle screen sharing
   */
  async toggleScreenShare() {
    if (!this.peerConnection) {
      console.error('Cannot toggle screen share without a peer connection.');
      return false;
    }

    const videoSender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
    if (!videoSender) {
      console.error('Cannot toggle screen share without a video track.');
      return false;
    }

    if (this.isScreenSharing) {
      // Stop screen sharing
      this.screenStream.getTracks().forEach(track => track.stop());
      await videoSender.replaceTrack(this.originalVideoTrack);
      this.localStream.removeTrack(this.localStream.getVideoTracks()[0]);
      this.localStream.addTrack(this.originalVideoTrack);

      this.isScreenSharing = false;
      this.screenStream = null;
      this.originalVideoTrack = null;

      console.log('📺 Screen sharing stopped');
      return false;
    } else {
      // Start screen sharing
      try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = this.screenStream.getVideoTracks()[0];

        this.originalVideoTrack = this.localStream.getVideoTracks()[0];
        await videoSender.replaceTrack(screenTrack);

        // When the user stops sharing via the browser UI
        screenTrack.onended = () => {
          this.toggleScreenShare();
        };

        this.isScreenSharing = true;
        console.log('📺 Screen sharing started');
        return true;
      } catch (error) {
        console.error('❌ Error starting screen share:', error);
        return false;
      }
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    console.log('🧹 Cleaning up WebRTC resources');

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Reset state
    this.remoteStream = null;
    this.callId = null;
    this.remoteUserId = null;
    this.iceCandidatesQueue = [];
  }

  /**
   * Handle signal based on type
   */
  async handleSignal(signal) {
    const { signal_type, signal_data, call_id, from_user_id } = signal;

    console.log('📨 Handling signal:', signal_type, 'for call:', call_id);

    // Only handle signals for the current call
    if (call_id && this.callId && call_id !== this.callId) {
      console.log('📨 Ignoring signal for different call:', call_id, 'current:', this.callId);
      return;
    }

    switch (signal_type) {
      case 'offer':
        // This is handled separately for incoming call UI
        return { type: 'incoming_call', data: signal };

      case 'answer':
        console.log('📞 Processing answer for call:', call_id);
        await this.handleAnswer(signal_data);
        break;

      case 'ice_candidate':
        console.log('🧊 Processing ICE candidate');
        await this.handleIceCandidate(signal_data);
        break;

      case 'call_end':
        console.log('📞 Call ended with reason:', signal_data.reason);
        if (this.onCallEnd) {
          this.onCallEnd(signal_data.reason);
        }
        this.cleanup();
        break;

      case 'busy':
        if (this.onCallEnd) {
          this.onCallEnd('busy');
        }
        this.cleanup();
        break;

      case 'ringing':
        // Update UI to show ringing state
        console.log('🔔 Ringing signal received');
        break;

      default:
        console.warn('Unknown signal type:', signal_type);
    }
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;