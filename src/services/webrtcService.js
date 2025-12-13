import callService from './callService';

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

      // Fallback configuration with free TURN servers
      this.rtcConfig = {
        iceServers: [
          // Google STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },

          // OpenRelay TURN (FREE - no signup required)
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },

          // Metered.ca Free TURN
          {
            urls: 'turn:a.relay.metered.ca:80',
            username: 'df4e050fc5de5dc26b25b85a',
            credential: 'Pxdp2PK0b5ZXljOm'
          },
          {
            urls: 'turn:a.relay.metered.ca:80?transport=tcp',
            username: 'df4e050fc5de5dc26b25b85a',
            credential: 'Pxdp2PK0b5ZXljOm'
          },
          {
            urls: 'turn:a.relay.metered.ca:443',
            username: 'df4e050fc5de5dc26b25b85a',
            credential: 'Pxdp2PK0b5ZXljOm'
          },
          {
            urls: 'turn:a.relay.metered.ca:443?transport=tcp',
            username: 'df4e050fc5de5dc26b25b85a',
            credential: 'Pxdp2PK0b5ZXljOm'
          },

          // Additional free STUN servers
          { urls: 'stun:global.stun.twilio.com:3478' },
          { urls: 'stun:stun.services.mozilla.com' },
          { urls: 'stun:stun.ekiga.net' }
        ],
        iceCandidatePoolSize: 10
      };

      console.log('✅ Loaded fallback TURN/STUN configuration');
    } catch (error) {
      console.error('❌ Error loading TURN config:', error);
      // Ultimate fallback to basic STUN
      this.rtcConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      };
    }
  }

  /**
   * Generate unique call ID
   */
  generateCallId() {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get local media stream
   */
  async getLocalStream(video = true, audio = true) {
    try {
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
      console.error('❌ Error getting local stream:', error);
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