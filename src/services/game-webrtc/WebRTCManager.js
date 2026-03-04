import { supabase } from '../../config/supabase';

class WebRTCManager {
    constructor(roomId, userId, onMessage, onStatusChange) {
        this.roomId = roomId;
        this.userId = userId;
        this.onMessage = onMessage;
        this.onStatusChange = onStatusChange;
        this.peerConnections = new Map(); // remoteUserId -> RTCPeerConnection
        this.dataChannels = new Map(); // remoteUserId -> RTCDataChannel
        this.channel = null;
        this.iceServers = [
            // Google STUN servers (Fast & Free)
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

            // Metered.ca Free TURN (50GB Tier)
            {
                urls: 'turn:a.relay.metered.ca:80',
                username: 'df4e050fc5de5dc26b25b85a',
                credential: 'Pxdp2PK0b5ZXljOm'
            },
            {
                urls: 'turn:a.relay.metered.ca:443',
                username: 'df4e050fc5de5dc26b25b85a',
                credential: 'Pxdp2PK0b5ZXljOm'
            },

            // Extra STUN fallback
            { urls: 'stun:stun.services.mozilla.com' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ];
        this.iceCandidatePoolSize = 10;
    }

    async initialize() {
        console.log(`[WebRTC] Initializing for room ${this.roomId}, user ${this.userId}`);

        this.channel = supabase.channel(`signaling:${this.roomId}`, {
            config: { broadcast: { self: false } }
        });

        this.channel
            .on('broadcast', { event: 'signal' }, async ({ payload }) => {
                if (payload.to === this.userId) {
                    await this._handleSignal(payload);
                }
            })
            .subscribe((status) => {
                console.log(`[WebRTC] Signaling channel status: ${status}`);
                if (this.onStatusChange) this.onStatusChange(status);
            });
    }

    async connectToPeer(remoteUserId) {
        if (this.peerConnections.has(remoteUserId)) return;

        console.log(`[WebRTC] Connecting to peer ${remoteUserId}`);
        const pc = this._createPeerConnection(remoteUserId);

        // Create data channel (only the initiator needs to do this)
        const dc = pc.createDataChannel('game-data', { reliable: true });
        this._setupDataChannel(remoteUserId, dc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this._sendSignal(remoteUserId, { type: 'offer', sdp: offer.sdp });
    }

    sendData(data) {
        const message = JSON.stringify(data);
        this.dataChannels.forEach((dc, id) => {
            if (dc.readyState === 'open') {
                dc.send(message);
            } else {
                console.warn(`[WebRTC] Data channel to ${id} is not open (state: ${dc.readyState})`);
            }
        });
    }

    _createPeerConnection(remoteUserId) {
        const pc = new RTCPeerConnection({
            iceServers: this.iceServers,
            iceCandidatePoolSize: this.iceCandidatePoolSize
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this._sendSignal(remoteUserId, { type: 'candidate', candidate: event.candidate });
            }
        };

        pc.ondatachannel = (event) => {
            console.log(`[WebRTC] Received data channel from ${remoteUserId}`);
            this._setupDataChannel(remoteUserId, event.channel);
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state with ${remoteUserId}: ${pc.connectionState}`);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this._cleanupPeer(remoteUserId);
            }
        };

        this.peerConnections.set(remoteUserId, pc);
        return pc;
    }

    _setupDataChannel(remoteUserId, dc) {
        dc.onopen = () => {
            console.log(`[WebRTC] Data channel with ${remoteUserId} is OPEN`);
            this.dataChannels.set(remoteUserId, dc);
        };

        dc.onclose = () => {
            console.log(`[WebRTC] Data channel with ${remoteUserId} is CLOSED`);
            this.dataChannels.delete(remoteUserId);
        };

        dc.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (this.onMessage) this.onMessage(remoteUserId, data);
        };

        dc.onerror = (error) => {
            console.error(`[WebRTC] Data channel error with ${remoteUserId}:`, error);
        };
    }

    async _handleSignal(payload) {
        const { from, data } = payload;
        let pc = this.peerConnections.get(from);

        if (!pc) {
            pc = this._createPeerConnection(from);
        }

        if (data.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this._sendSignal(from, { type: 'answer', sdp: answer.sdp });
        } else if (data.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
        } else if (data.type === 'candidate') {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error('[WebRTC] Error adding ICE candidate', e);
            }
        }
    }

    _sendSignal(to, data) {
        if (!this.channel) return;
        this.channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { from: this.userId, to, data }
        });
    }

    _cleanupPeer(remoteUserId) {
        const pc = this.peerConnections.get(remoteUserId);
        if (pc) pc.close();
        this.peerConnections.delete(remoteUserId);
        this.dataChannels.delete(remoteUserId);
    }

    cleanup() {
        console.log('[WebRTC] Cleaning up all connections');
        this.peerConnections.forEach((pc) => pc.close());
        this.peerConnections.clear();
        this.dataChannels.clear();
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }
    }
}

export default WebRTCManager;
