// src/services/webrtc/WebRTCService.js

import callService from '../callService';
import { Capacitor } from '@capacitor/core';
import { safePluginCall } from '../../utils/platformCheck';
import { WEBRTC_CONFIG } from '../../constants/webrtcConfig';
import { generateCallId } from '../../utils/idGenerators';
import NetworkMonitor from './NetworkMonitor';
import QualityManager from './QualityManager';
import CodecOptimizer from './CodecOptimizer';

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
    this.onQualityChange = null;
    this.iceCandidatesQueue = [];
    this.isScreenSharing = false;
    this.originalVideoTrack = null;
    this.screenStream = null;

    // Quality management
    this.networkMonitor = null;
    this.qualityManager = null;

    this.loadTurnConfig();
  }

  loadTurnConfig() {
    try {
      if (window.FREE_TURN_SERVERS) {
        this.rtcConfig = window.FREE_TURN_SERVERS;
        console.log('✅ Loaded TURN servers from global config');
        return;
      }

      this.rtcConfig = WEBRTC_CONFIG;
      console.log('✅ Loaded shared TURN/STUN configuration');
    } catch (error) {
      console.error('❌ Error loading TURN config:', error);
      this.rtcConfig = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
    }
  }

  generateCallId() {
    return generateCallId();
  }

  async requestMediaPermissions(video = true, audio = true) {
    const isNative = Capacitor.isNativePlatform();

    if (!isNative) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (e) {
        console.error("❌ Web permission error:", e);
        throw e;
      }
    }

    try {
      if (video) {
        const cameraPermissions = await safePluginCall(
          () => import('@capacitor/camera'),
          (mod) => mod.Camera.requestPermissions({ permissions: ['camera'] })
        );
        
        if (cameraPermissions?.camera !== 'granted') {
          console.warn('⚠️ Camera permission not granted');
        }
      }

      if (audio) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          stream.getTracks().forEach(track => track.stop());
        } catch (audioError) {
          console.error("❌ Microphone access failed:", audioError);
          throw new Error("Microphone permission denied");
        }
      }

      return true;
    } catch (e) {
      console.error("❌ Native permission error:", e);
      throw e;
    }
  }

  async getLocalStream(video = true, audio = true, quality = 'high') {
    try {
      await this.requestMediaPermissions(video, audio);

      // Initialize quality manager if not already done
      if (!this.qualityManager) {
        this.qualityManager = new QualityManager(this.peerConnection);
      }
      
      // Get adaptive constraints
      const constraints = this.qualityManager.getInitialConstraints(
        video ? 'video' : 'audio',
        quality
      );

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('🎥 Local stream acquired with quality:', quality);
      
      return this.localStream;
    } catch (error) {
      console.error('❌ Error getting local stream:', error);
      throw error;
    }
  }

  initializePeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.remoteStream = new MediaStream();

    // Initialize quality manager
    this.qualityManager = new QualityManager(this.peerConnection);

    // Initialize network monitor
    this.networkMonitor = new NetworkMonitor(this.peerConnection);
    this.networkMonitor.onQualityChange((stats) => {
      console.log('📊 Network stats:', stats);
      
      // Apply adaptive quality
      this.qualityManager.applyProfile('auto', stats);

      // Notify UI
      if (this.onQualityChange) {
        this.onQualityChange(stats);
      }
    });

    // Start monitoring after 3 seconds (allow connection to stabilize)
    setTimeout(() => {
      if (this.networkMonitor) {
        this.networkMonitor.startMonitoring(2000);
      }
    }, 3000);

    // Add local tracks
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
        await this.sendIceCandidate(event.candidate);
      }
    };

    // Handle connection state
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

    return this.peerConnection;
  }

  async startCall(callerId, receiverId, callType = 'video', quality = 'high') {
    try {
      this.currentUserId = callerId;
      this.remoteUserId = receiverId;
      this.callId = this.generateCallId();

      console.log('📞 Starting call:', this.callId);

      // [ULTRA-SPEED FIX] Fire database creation and broadcast signal in PARALLEL
      // Do not await them to avoid blocking the very first milliseconds of initiation.
      Promise.all([
        callService.createCall(callerId, receiverId, this.callId, callType),
        callService.sendBroadcastSignal(receiverId, {
          call_id: this.callId,
          from_user_id: callerId,
          to_user_id: receiverId,
          signal_type: 'offer',
          signal_data: { callType },
          created_at: new Date().toISOString()
        })
      ]).catch(e => console.warn('⚠️ Call initiation sync failed:', e));

      // Immediately start getting camera/mic while signaling is happening
      await this.getLocalStream(callType === 'video', true, quality);
      this.initializePeerConnection();

      // Create offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video'
      });

      // Optimize SDP
      offer.sdp = CodecOptimizer.optimizeSDP(offer.sdp);

      await this.peerConnection.setLocalDescription(offer);

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

      console.log('📤 Offer sent');
      return { callId: this.callId, localStream: this.localStream };

    } catch (error) {
      console.error('❌ Error starting call:', error);
      this.cleanup();
      throw error;
    }
  }

  async answerCall(callId, callerId, receiverId, offerData) {
    try {
      this.callId = callId;
      this.currentUserId = receiverId;
      this.remoteUserId = callerId;

      const callType = offerData.callType || 'video';
      await this.getLocalStream(callType === 'video', true, 'high');
      this.initializePeerConnection();

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({
          type: offerData.type,
          sdp: offerData.sdp
        })
      );

      await this.processQueuedIceCandidates();

      const answer = await this.peerConnection.createAnswer();
      
      // Optimize SDP
      answer.sdp = CodecOptimizer.optimizeSDP(answer.sdp);

      await this.peerConnection.setLocalDescription(answer);

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

      await callService.updateCallStatus(callId, 'answered');

      console.log('📤 Answer sent');
      return { localStream: this.localStream, remoteStream: this.remoteStream };

    } catch (error) {
      console.error('❌ Error answering call:', error);
      this.cleanup();
      throw error;
    }
  }

  async handleAnswer(answerData) {
    try {
      if (!this.peerConnection) return;

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({
          type: answerData.type,
          sdp: answerData.sdp
        })
      );

      await this.processQueuedIceCandidates();
      await callService.updateCallStatus(this.callId, 'answered');

    } catch (error) {
      console.error('❌ Error handling answer:', error);
      throw error;
    }
  }

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

  async handleIceCandidate(candidateData) {
    try {
      const candidate = new RTCIceCandidate({
        candidate: candidateData.candidate,
        sdpMid: candidateData.sdpMid,
        sdpMLineIndex: candidateData.sdpMLineIndex
      });

      if (this.peerConnection?.remoteDescription) {
        await this.peerConnection.addIceCandidate(candidate);
      } else {
        this.iceCandidatesQueue.push(candidate);
      }
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  }

  async processQueuedIceCandidates() {
    while (this.iceCandidatesQueue.length > 0) {
      const candidate = this.iceCandidatesQueue.shift();
      try {
        await this.peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error('❌ Error adding queued candidate:', error);
      }
    }
  }

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

  async endCall(duration = 0) {
    try {
      if (this.callId && this.remoteUserId) {
        await callService.sendSignal(
          this.callId,
          this.currentUserId,
          this.remoteUserId,
          'call_end',
          { reason: 'ended', duration }
        );

        await callService.endCall(this.callId, duration);
      }

      this.cleanup();
    } catch (error) {
      console.error('❌ Error ending call:', error);
      this.cleanup();
    }
  }

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

          const sender = this.peerConnection?.getSenders()
            .find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }

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
   * Set quality profile manually
   */
  setQualityProfile(profile) {
    if (this.qualityManager) {
      this.qualityManager.setProfile(profile);
      console.log('🎨 Quality profile set to:', profile);
    }
  }

  /**
   * Get current network stats
   */
  getNetworkStats() {
    return this.networkMonitor?.getCurrentStats() || null;
  }

  async toggleScreenShare() {
    if (!this.peerConnection) return false;

    const videoSender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
    if (!videoSender) return false;

    if (this.isScreenSharing) {
      this.screenStream.getTracks().forEach(track => track.stop());
      await videoSender.replaceTrack(this.originalVideoTrack);
      this.localStream.removeTrack(this.localStream.getVideoTracks()[0]);
      this.localStream.addTrack(this.originalVideoTrack);

      this.isScreenSharing = false;
      this.screenStream = null;
      this.originalVideoTrack = null;
      return false;
    } else {
      try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          }
        });
        const screenTrack = this.screenStream.getVideoTracks()[0];

        this.originalVideoTrack = this.localStream.getVideoTracks()[0];
        await videoSender.replaceTrack(screenTrack);

        screenTrack.onended = () => {
          this.toggleScreenShare();
        };

        this.isScreenSharing = true;
        return true;
      } catch (error) {
        console.error('❌ Error starting screen share:', error);
        return false;
      }
    }
  }

  cleanup() {
    console.log('🧹 Cleaning up WebRTC resources');

    // Stop monitoring
    if (this.networkMonitor) {
      this.networkMonitor.stopMonitoring();
      this.networkMonitor = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.callId = null;
    this.remoteUserId = null;
    this.iceCandidatesQueue = [];
    this.qualityManager = null;
  }

  async handleSignal(signal) {
    const { signal_type, signal_data, call_id } = signal;

    if (call_id && this.callId && call_id !== this.callId) {
      return;
    }

    switch (signal_type) {
      case 'offer':
        return { type: 'incoming_call', data: signal };

      case 'answer':
        await this.handleAnswer(signal_data);
        break;

      case 'ice_candidate':
        await this.handleIceCandidate(signal_data);
        break;

      case 'call_end':
        if (this.onCallEnd) {
          this.onCallEnd(signal_data.reason);
        }
        this.cleanup();
        break;

      default:
        console.warn('Unknown signal type:', signal_type);
    }
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;
