// Using global objects: window.supabaseClient, window.FREE_TURN_SERVERS

/**
 * Complete WebRTC Calling System
 * Supports voice and video calls
 */
class WebRTCCall {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.channel = null;

        this.callId = null;
        this.roomId = null;
        this.userId = null;
        this.remoteUserId = null;
        this.callType = 'video'; // 'voice' or 'video'

        this.isCaller = false;
        this.isConnected = false;

        // Callbacks
        this.onRemoteStreamCallback = null;
        this.onCallEndCallback = null;
        this.onCallStateChangeCallback = null;

        // Call timer
        this.callStartTime = null;
        this.callTimerInterval = null;
    }

    /**
     * Start outgoing call
     */
    async startCall(receiverId, callType = 'video', callbacks = {}) {
        console.log(`📞 startCall called with receiverId: ${receiverId}, callType: ${callType}`);
        try {
            // Validate receiverId - be very strict
            console.log(`🔍 Validating receiverId: ${receiverId}, type: ${typeof receiverId}, isValid: ${!!receiverId}`);
            if (!receiverId || receiverId === 'undefined' || receiverId === 'null' || typeof receiverId !== 'string' || receiverId.trim() === '') {
                console.error('❌ ReceiverId validation failed:', { receiverId, type: typeof receiverId });
                throw new Error(`Invalid receiver ID: "${receiverId}" is not a valid receiver identifier`);
            }
            console.log('✅ ReceiverId validation passed:', receiverId);

            this.callType = callType;
            this.remoteUserId = receiverId;
            this.isCaller = true;

            this.onRemoteStreamCallback = callbacks.onRemoteStream;
            this.onCallEndCallback = callbacks.onCallEnd;
            this.onCallStateChangeCallback = callbacks.onStateChange;

            console.log(`📞 Starting ${callType} call to ${receiverId}...`);
            console.log('🔐 Getting current user...');

            // Get current user
            const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
            if (authError || !user) throw new Error('Not authenticated');

            this.userId = user.id;

            // Generate room ID
            this.roomId = `call_${user.id}_${receiverId}_${Date.now()}`;

            // Create call record
            const { data: callData, error: callError } = await window.supabaseClient
                .from('call_history')
                .insert([{
                    caller_id: user.id,
                    receiver_id: receiverId,
                    call_type: callType === 'screen' ? 'video' : callType, // Map screen to video type
                    call_status: 'initiated',
                    call_id: this.roomId,
                    started_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (callError) throw callError;

            this.callId = callData.call_id;
            this.updateCallState('initiated');

            // Get local media
            await this.getLocalMedia(callType);

            // Initialize peer connection
            await this.initPeerConnection();

            // Subscribe to signals
            await this.subscribeToSignals();

            // Create and send offer
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: callType === 'video' || callType === 'screen'
            });

            await this.peerConnection.setLocalDescription(offer);

            // Send offer signal
            await this.sendSignal('offer', {
                sdp: offer.sdp,
                type: offer.type,
                callType: callType
            });

            console.log('✅ Call initiated, waiting for answer...');

            return {
                success: true,
                callId: this.callId,
                roomId: this.roomId,
                localStream: this.localStream
            };

        } catch (error) {
            console.error('❌ Start call error:', error);
            await this.endCall('failed');
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Answer incoming call
     */
    async answerCall(callId, roomId, callType = 'video', callbacks = {}) {
        try {
            this.callId = callId;
            this.roomId = roomId;
            this.callType = callType;
            this.isCaller = false;

            this.onRemoteStreamCallback = callbacks.onRemoteStream;
            this.onCallEndCallback = callbacks.onCallEnd;
            this.onCallStateChangeCallback = callbacks.onStateChange;

            console.log(`📞 Answering ${callType} call...`);

            // Get current user
            const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
            if (authError || !user) throw new Error('Not authenticated');

            this.userId = user.id;

            // Update call status
            await window.supabaseClient
                .from('call_history')
                .update({
                    call_status: 'answered',
                    answered_at: new Date().toISOString()
                })
                .eq('call_id', callId);

            this.updateCallState('ringing');

            // Get local media
            await this.getLocalMedia(callType);

            // Initialize peer connection
            await this.initPeerConnection();

            // Subscribe to signals (will receive offer and respond with answer)
            await this.subscribeToSignals();

            console.log('✅ Ready to receive call...');

            return {
                success: true,
                localStream: this.localStream
            };

        } catch (error) {
            console.error('❌ Answer call error:', error);
            await this.endCall('failed');
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reject incoming call
     */
    async rejectCall(callId) {
        try {
            await window.supabaseClient
                .from('call_history')
                .update({ call_status: 'rejected', ended_at: new Date().toISOString() })
                .eq('call_id', callId);

            // Send hangup signal
            if (this.roomId) {
                await this.sendSignal('call_end', { reason: 'rejected' });
            }

            console.log('📵 Call rejected');

        } catch (error) {
            console.error('Reject call error:', error);
        }
    }

    /**
     * End active call
     */
    async endCall(reason = 'completed') {
        try {
            console.log('📞 Ending call...');

            // Stop call timer
            this.stopCallTimer();

            // Calculate duration
            const duration = this.callStartTime
                ? Math.floor((Date.now() - this.callStartTime) / 1000)
                : 0;

            // Update call record
            if (this.callId) {
                await window.supabaseClient
                    .from('call_history')
                    .update({
                        call_status: reason === 'completed' ? 'ended' : reason,
                        ended_at: new Date().toISOString(),
                        call_duration: duration
                    })
                    .eq('call_id', this.callId);
            }

            // Send hangup signal
            if (this.roomId) {
                await this.sendSignal('call_end', { reason });
            }

            // Cleanup
            this.cleanup();

            // Callback
            if (this.onCallEndCallback) {
                this.onCallEndCallback({ reason, duration });
            }

            this.updateCallState('ended');

        } catch (error) {
            console.error('End call error:', error);
            this.cleanup();
        }
    }

    /**
     * Get local media stream
     */
    async getLocalMedia(callType) {
        try {
            let constraints;

            if (callType === 'screen') {
                // Screen sharing
                constraints = {
                    video: {
                        mediaSource: 'screen'
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                };
                this.localStream = await navigator.mediaDevices.getDisplayMedia(constraints);
            } else {
                // Voice or video call
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
                this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            }

            console.log('🎥 Local media acquired for', callType);

            return this.localStream;

        } catch (error) {
            console.error('Get media error:', error);
            throw new Error(`Could not access ${callType === 'screen' ? 'screen' : 'camera/microphone'}`);
        }
    }

    /**
     * Initialize RTCPeerConnection
     */
    async initPeerConnection() {
        this.peerConnection = new RTCPeerConnection(window.FREE_TURN_SERVERS);

        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle remote tracks
        this.peerConnection.ontrack = (event) => {
            console.log('🎥 Remote track received:', event.track.kind);

            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
            }

            this.remoteStream.addTrack(event.track);

            if (this.onRemoteStreamCallback) {
                this.onRemoteStreamCallback(this.remoteStream);
            }
        };

        // ICE candidates
        this.peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                await this.sendSignal('ice_candidate', {
                    candidate: event.candidate.toJSON()
                });
            }
        };

        // Connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('Connection state:', state);

            if (state === 'connected') {
                this.isConnected = true;
                this.startCallTimer();
                this.updateCallState('answered');

                // Update DB
                window.supabaseClient
                    .from('call_history')
                    .update({
                        call_status: 'answered',
                        answered_at: new Date().toISOString()
                    })
                    .eq('call_id', this.callId);
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                this.endCall(state);
            }
        };

        // ICE connection state
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
        };

        console.log('✅ Peer connection initialized');
    }

    /**
     * Subscribe to WebRTC signals
     */
    async subscribeToSignals() {
        this.channel = window.supabaseClient
            .channel(`call:${this.roomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'call_signaling',
                    filter: `call_id=eq.${this.roomId}`
                },
                async (payload) => {
                    await this.handleSignal(payload.new);
                }
            )
            .subscribe((status) => {
                console.log('📡 Call signaling channel:', status);
            });
    }

    /**
     * Handle incoming signal
     */
    async handleSignal(signal) {
        // Ignore own signals
        if (signal.from_user_id === this.userId) return;

        console.log(`📥 Signal received: ${signal.signal_type}`);

        try {
            switch (signal.signal_type) {
                case 'offer':
                    await this.handleOffer(signal.signal_data);
                    break;

                case 'answer':
                    await this.handleAnswer(signal.signal_data);
                    break;

                case 'ice_candidate':
                    await this.handleIceCandidate(signal.signal_data);
                    break;

                case 'call_end':
                    await this.endCall(signal.signal_data.reason || 'ended');
                    break;
            }
        } catch (error) {
            console.error('Handle signal error:', error);
        }
    }

    /**
     * Handle offer
     */
    async handleOffer(payload) {
        await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription({
                type: 'offer',
                sdp: payload.sdp
            })
        );

        // Send ringing signal
        await this.sendSignal('ringing', {});

        // Create answer
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        // Send answer
        await this.sendSignal('answer', {
            sdp: answer.sdp,
            type: answer.type
        });

        console.log('✅ Answer sent');
    }

    /**
     * Handle answer
     */
    async handleAnswer(payload) {
        await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription({
                type: 'answer',
                sdp: payload.sdp
            })
        );

        console.log('✅ Answer received');
    }

    /**
     * Handle ICE candidate
     */
    async handleIceCandidate(payload) {
        try {
            await this.peerConnection.addIceCandidate(
                new RTCIceCandidate(payload.candidate)
            );
        } catch (error) {
            console.error('Add ICE candidate error:', error);
        }
    }

    /**
     * Send signal
     */
    async sendSignal(type, payload) {
        try {
            await window.supabaseClient
                .from('call_signaling')
                .insert([{
                    call_id: this.roomId,
                    from_user_id: this.userId,
                    to_user_id: this.remoteUserId,
                    signal_type: type,
                    signal_data: payload
                }]);
        } catch (error) {
            console.error('Send signal error:', error);
        }
    }

    /**
     * Toggle mute audio
     */
    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return !audioTrack.enabled; // return muted state
            }
        }
        return false;
    }

    /**
     * Toggle video
     */
    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                return !videoTrack.enabled; // return video off state
            }
        }
        return false;
    }

    /**
     * Switch camera (front/back)
     */
    async switchCamera() {
        try {
            if (!this.localStream) return;

            const videoTrack = this.localStream.getVideoTracks()[0];
            if (!videoTrack) return;

            const currentFacingMode = videoTrack.getSettings().facingMode;
            const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

            // Stop current track
            videoTrack.stop();

            // Get new stream
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode }
            });

            const newVideoTrack = newStream.getVideoTracks()[0];

            // Replace track in peer connection
            const sender = this.peerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(newVideoTrack);
            }

            // Update local stream
            this.localStream.removeTrack(videoTrack);
            this.localStream.addTrack(newVideoTrack);

            console.log('📷 Camera switched to:', newFacingMode);

        } catch (error) {
            console.error('Switch camera error:', error);
        }
    }

    /**
     * Start call timer
     */
    startCallTimer() {
        this.callStartTime = Date.now();

        this.callTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);

            if (this.onCallStateChangeCallback) {
                this.onCallStateChangeCallback('timer', elapsed);
            }
        }, 1000);
    }

    /**
     * Stop call timer
     */
    stopCallTimer() {
        if (this.callTimerInterval) {
            clearInterval(this.callTimerInterval);
            this.callTimerInterval = null;
        }
    }

    /**
     * Update call state (trigger callback)
     */
    updateCallState(state) {
        if (this.onCallStateChangeCallback) {
            this.onCallStateChangeCallback('state', state);
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Unsubscribe from channel
        if (this.channel) {
            window.supabaseClient.removeChannel(this.channel);
            this.channel = null;
        }

        this.isConnected = false;
    }

    /**
     * Get call stats (for debugging)
     */
    async getStats() {
        if (!this.peerConnection) return null;

        const stats = await this.peerConnection.getStats();
        return stats;
    }
}

// Make globally available
window.WebRTCCall = WebRTCCall;