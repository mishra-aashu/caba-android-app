// WebRTCRoomManager.js — Zero-dependency P2P Room Engine
// Handles: Signaling, Multi-peer Mesh, Data Channels, Chunking
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { ICE_SERVERS } from '../constants/webrtcConfig';
import { uuid } from '../utils/idGenerators';

const CHUNK_SIZE = 16_384; // 16KB — safe for all browsers
const HEADER_SIZE = 40;    // 4 bytes index + 36 bytes transferId

const CHANNEL_CONFIG = {
  'game-events':    { ordered: true },
  'chat-text':      { ordered: true },
  'media-transfer': { ordered: true },
};

/**
 * Generates a UUID v4 (Redirected to shared utility)
 */
function uuidHelper() {
  return uuid();
}

export default class WebRTCRoomManager extends EventTarget {
  /**
   * @param {Object} opts
   * @param {string} opts.roomId    — temporary room identifier from URL
   * @param {string} opts.userId    — current user's unique ID
   * @param {string} opts.userName  — display name
   * @param {Object} opts.supabase  — initialized Supabase client (reuse existing!)
   */
  constructor({ roomId, userId, userName, supabase }) {
    super();
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;
    this.supabase = supabase;

    // ── Peer State ──────────────────────────────────────────
    this.peers = new Map();
    // Map<peerId, {
    //   pc: RTCPeerConnection,
    //   channels: Map<channelName, RTCDataChannel>,
    //   pendingCandidates: RTCIceCandidateInit[],
    //   userName: string
    // }>

    // ── Media Assembly (receiver side) ──────────────────────
    this.mediaAssembly = new Map();
    // Map<transferId, { meta, chunks: ArrayBuffer[], received: number }>

    // ── Live Media State ────────────────────────────────────
    this.localStream = null;
    this.remoteStreams = new Map(); // Map<peerId, MediaStream>

    // ── Active ObjectURLs (for cleanup) ─────────────────────
    this._objectURLs = new Set();

    // ── State Guards ────────────────────────────────────────
    this._destroyed = false;
    this._signalingChannel = null;

    // ── Boot ────────────────────────────────────────────────
    this._initSignaling();
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIGNALING (Supabase Realtime Broadcast — ONLY use)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _initSignaling() {
    const channelName = `room-signal-${this.roomId}`;

    this._signalingChannel = this.supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        if (this._destroyed) return;
        if (payload.targetId && payload.targetId !== this.userId) return;
        this._handleSignal(payload);
      })
      .on('broadcast', { event: 'game-fallback' }, ({ payload }) => {
        if (this._destroyed) return;
        if (payload.targetId && payload.targetId !== this.userId) return;
        if (payload.senderId === this.userId) return;
        
        // Emit as a regular game event
        this._emit('game-event', {
          peerId: payload.senderId,
          ...payload.event,
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // console.log(`[WebRTC] Joined signaling channel: ${channelName}`);
          // Announce presence — existing peers will send offers
          await this._broadcast('peer-join', {
            userName: this.userName,
          });
        }
      });
  }

  async _broadcast(type, data = {}) {
    if (this._destroyed || !this._signalingChannel) return;
    await this._signalingChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type,
        senderId: this.userId,
        senderName: this.userName,
        ...data,
      },
    });
  }

  async _sendTo(targetId, type, data = {}) {
    if (this._destroyed || !this._signalingChannel) return;
    await this._signalingChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type,
        senderId: this.userId,
        senderName: this.userName,
        targetId,
        ...data,
      },
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIGNAL HANDLER (Router)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async _handleSignal(signal) {
    const { type, senderId, senderName } = signal;
    if (senderId === this.userId) return;

    switch (type) {
      case 'peer-join':
        this._onPeerJoin(senderId, senderName);
        break;
      case 'peer-leave':
        this._onPeerLeave(senderId);
        break;
      case 'sdp-offer':
        await this._onSDPOffer(senderId, senderName, signal.sdp);
        break;
      case 'sdp-answer':
        await this._onSDPAnswer(senderId, signal.sdp);
        break;
      case 'ice-candidate':
        await this._onICECandidate(senderId, signal.candidate);
        break;
      default:
        break;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PEER LIFECYCLE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async _onPeerJoin(peerId, peerName) {
    if (this.peers.has(peerId)) return;

    // Polite peer pattern: lower userId creates the offer
    // This prevents "glare" (simultaneous offers)
    const iAmPolite = this.userId < peerId;

    if (iAmPolite) {
      // I create the offer
      const pc = this._createPeerConnection(peerId, peerName);
      
      // Data channels will follow the audio m-line
      this._createDataChannels(pc, peerId);

      // If audio is already active, enable the transceiver
      if (this.localStream) {
        const audioTrack = this.localStream.getAudioTracks()[0];
        const transceiver = pc.getTransceivers().find(t => t.receiver.track.kind === 'audio');
        if (transceiver && audioTrack) {
          transceiver.sender.replaceTrack(audioTrack);
          if (transceiver.sender.setStreams) {
            transceiver.sender.setStreams(this.localStream);
          }
          transceiver.direction = 'sendrecv';
        }
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this._sendTo(peerId, 'sdp-offer', {
        sdp: pc.localDescription.toJSON(),
      });
    }
    // If not polite, we wait for THEIR offer
  }

  _onPeerLeave(peerId) {
    this._removePeer(peerId);
    this._emit('peer-left', { peerId });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PEER CONNECTION FACTORY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _createPeerConnection(peerId, peerName) {
    const pc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10
    });

    const peerState = {
      pc,
      channels: new Map(),
      pendingCandidates: [],
      userName: peerName || 'Unknown',
    };
    this.peers.set(peerId, peerState);

    // ── ICE Candidates ────────────────────────────────────
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this._sendTo(peerId, 'ice-candidate', {
          candidate: candidate.toJSON(),
        });
      }
    };

    // ── Pre-allocate Transceivers (Consistent M-Lines) ────
    // We add an audio transceiver immediately so the m-line order 
    // is consistent [Audio, Data] for all peers.
    pc.addTransceiver('audio', { direction: 'recvonly' });

    // ── Connection State ──────────────────────────────────
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      this._emit('connection-state', { peerId, state });

      if (state === 'connected') {
        this._emit('peer-connected', {
          peerId,
          userName: peerState.userName,
        });
      }

      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        // Auto-cleanup disconnected peers after a grace period
        setTimeout(() => {
          if (pc.connectionState !== 'connected') {
            this._removePeer(peerId);
            this._emit('peer-disconnected', { peerId });
          }
        }, 5000);
      }
    };

    // ── Tracks (Incoming Media) ───────────────────────────
    pc.ontrack = (event) => {
      console.log(`[WebRTC] 🎤 Track received from ${peerId}:`, event.track.kind);
      const stream = event.streams[0] || new MediaStream([event.track]);
      this.remoteStreams.set(peerId, stream);
      this._emit('track-received', { peerId, stream });
    };

    // ── Negotiation ───────────────────────────────────────
    pc.onnegotiationneeded = async () => {
      console.log(`[WebRTC] 🔄 Negotiation needed for ${peerId}`);
      try {
        if (pc.signalingState !== 'stable') return;
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await this._sendTo(peerId, 'sdp-offer', {
          sdp: pc.localDescription.toJSON(),
        });
      } catch (err) {
        console.error('[WebRTC] ❌ Negotiation failed:', err);
      }
    };

    // ── Incoming Data Channels (from the OTHER peer) ──────
    pc.ondatachannel = ({ channel }) => {
      this._attachChannelHandlers(channel, peerId);
      peerState.channels.set(channel.label, channel);
    };

    return pc;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DATA CHANNELS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _createDataChannels(pc, peerId) {
    const peer = this.peers.get(peerId);

    for (const [name, config] of Object.entries(CHANNEL_CONFIG)) {
      const channel = pc.createDataChannel(name, config);
      this._attachChannelHandlers(channel, peerId);
      peer.channels.set(name, channel);
    }
  }

  _attachChannelHandlers(channel, peerId) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      // console.log(`[WebRTC] Channel ${channel.label} opened with peer ${peerId}`);
      this._emit('channel-open', { peerId, channel: channel.label });
    };

    channel.onclose = () => {
      // console.log(`[WebRTC] Channel ${channel.label} closed with peer ${peerId}`);
      this._emit('channel-close', { peerId, channel: channel.label });
    };

    channel.onerror = (err) => {
      if (this._destroyed) return;
      
      // Silence benign errors caused by manual closure
      const errorStr = String(err?.error || err || '');
      if (errorStr.includes('User-Initiated Abort') || errorStr.includes('Close called')) {
        return;
      }
      
      console.error(`[WebRTC] Channel ${channel.label} error:`, err);
    };

    channel.onmessage = ({ data }) => {
      this._routeMessage(channel.label, peerId, data);
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MESSAGE ROUTER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _routeMessage(channelName, peerId, data) {
    switch (channelName) {
      case 'game-events':
        this._emit('game-event', {
          peerId,
          ...JSON.parse(data),
        });
        break;

      case 'chat-text':
        this._emit('chat-message', {
          peerId,
          peerName: this.peers.get(peerId)?.userName,
          ...JSON.parse(data),
        });
        break;

      case 'media-transfer':
        this._handleMediaData(peerId, data);
        break;

      default:
        break;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SDP HANDLING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async _onSDPOffer(peerId, peerName, sdp) {
    // We received an offer — create connection and answer
    let peer = this.peers.get(peerId);

    if (!peer) {
      const pc = this._createPeerConnection(peerId, peerName);
      
      // If audio is already active, prepare the transceiver
      if (this.localStream) {
        const audioTrack = this.localStream.getAudioTracks()[0];
        const transceiver = pc.getTransceivers().find(t => t.receiver.track.kind === 'audio');
        if (transceiver && audioTrack) {
          transceiver.sender.replaceTrack(audioTrack);
          if (transceiver.sender.setStreams) {
            transceiver.sender.setStreams(this.localStream);
          }
          transceiver.direction = 'sendrecv';
        }
      }
      
      peer = this.peers.get(peerId);
    }

    const { pc } = peer;

    // --- Glare/Collision Handling ---
    const isCollision = (pc.signalingState !== 'stable' || pc.remoteDescription !== null);
    const iAmPolite = this.userId < peerId;
    
    if (isCollision && !iAmPolite) {
      // console.log(`[WebRTC] Glare detected, ignoring offer from ${peerId} (I am impolite)`);
      return; 
    }
    
    if (isCollision && iAmPolite) {
      // console.log(`[WebRTC] Glare detected, rolling back for ${peerId} (I am polite)`);
      await pc.setLocalDescription({ type: 'rollback' });
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Flush any ICE candidates that arrived before the offer
    for (const candidate of peer.pendingCandidates) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    peer.pendingCandidates = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await this._sendTo(peerId, 'sdp-answer', {
      sdp: pc.localDescription.toJSON(),
    });
  }

  async _onSDPAnswer(peerId, sdp) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Flush pending ICE candidates
    for (const candidate of peer.pendingCandidates) {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    peer.pendingCandidates = [];
  }

  async _onICECandidate(peerId, candidate) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    if (peer.pc.remoteDescription) {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Queue it — remote description hasn't been set yet
      peer.pendingCandidates.push(candidate);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUBLIC API: Send Game Events
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async sendGameEvent(event) {
    const payloadObj = {
      ...event,
      senderId: this.userId,
      timestamp: Date.now(),
    };
    const payloadStr = JSON.stringify(payloadObj);
    
    // 1) Try P2P first
    const sentP2P = this._broadcastOnChannel('game-events', payloadStr);
    
    // 2) Fallback to Supabase Broadcast if P2P failed/no peers
    if (!sentP2P && this._signalingChannel) {
      // console.log('[WebRTC] P2P not ready, using Supabase Broadcast fallback');
      await this._signalingChannel.send({
        type: 'broadcast',
        event: 'game-fallback',
        payload: {
          senderId: this.userId,
          event: payloadObj
        }
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUBLIC API: Re-Announce Presence (called after invite accept)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Re-broadcasts peer-join so any connected peers can re-initiate
   * SDP negotiation. Call this when:
   *   (a) A user accepts a game invitation (acceptGame)
   *   (b) State was reset and WebRTC needs to reconnect
   */
  async reAnnounce() {
    if (this._destroyed) return;
    // console.log(`[WebRTC] Re-announcing presence in room ${this.roomId}`);
    await this._broadcast('peer-join', { userName: this.userName });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUBLIC API: Send Chat Message
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  sendChatMessage(text) {
    const msg = {
      id: uuid(),
      text,
      senderId: this.userId,
      senderName: this.userName,
      timestamp: Date.now(),
    };
    const sent = this._broadcastOnChannel('chat-text', JSON.stringify(msg));
    
    // Fallback: If P2P fails, we could potentially use Supabase Broadcast as a backup, 
    // but for now we just emit locally so the user sees their message.
    this._emit('chat-message', { ...msg, isLocal: true });
    
    return sent;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUBLIC API: Live Audio (Voice Chat)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async startAudio() {
    if (this.localStream) return this.localStream;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      
      const audioTrack = this.localStream.getAudioTracks()[0];
      
      for (const [, peer] of this.peers) {
        const transceiver = peer.pc.getTransceivers().find(t => t.receiver.track.kind === 'audio');
        if (transceiver) {
          transceiver.sender.replaceTrack(audioTrack);
          if (transceiver.sender.setStreams) {
            transceiver.sender.setStreams(this.localStream);
          }
          transceiver.direction = 'sendrecv';
        }
      }
      this._emit('local-stream-changed', { stream: this.localStream });
      return this.localStream;
    } catch (err) {
      console.error('[WebRTC] Failed to start audio:', err);
      throw err;
    }
  }

  stopAudio() {
    if (!this.localStream) return;
    this.localStream.getTracks().forEach(track => track.stop());
    
    for (const [, peer] of this.peers) {
      const transceiver = peer.pc.getTransceivers().find(t => t.receiver.track.kind === 'audio');
      if (transceiver) {
        transceiver.sender.replaceTrack(null);
        transceiver.direction = 'recvonly';
      }
    }
    
    this.localStream = null;
    this._emit('local-stream-changed', { stream: null });
  }

  isAudioActive() {
    return !!(this.localStream && this.localStream.getAudioTracks().some(t => t.enabled));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUBLIC API: Send Media (Image/Voice/Video with Chunking)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * @param {File|Blob} file     — the media to send
   * @param {'image'|'voice'|'video'} mediaType
   * @param {(progress: number) => void} onProgress — 0 to 1
   * @returns {Promise<string>} transferId
   */
  async sendMedia(file, mediaType, onProgress) {
    const transferId = uuid();
    const arrayBuffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

    const meta = {
      type: 'media-meta',
      transferId,
      fileName: file.name || `${mediaType}-${Date.now()}`,
      fileType: file.type,
      mediaType,
      fileSize: arrayBuffer.byteLength,
      totalChunks,
      senderId: this.userId,
      senderName: this.userName,
      timestamp: Date.now(),
    };

    // 1) Send metadata (JSON string)
    this._broadcastOnChannel('media-transfer', JSON.stringify(meta));

    // 2) Send chunks (ArrayBuffer with header)
    const encoder = new TextEncoder();
    const idBytes = encoder.encode(transferId); // exactly 36 bytes for UUID

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
      const chunkData = arrayBuffer.slice(start, end);

      // Build packet: [4 bytes index][36 bytes transferId][chunk data]
      const packet = new Uint8Array(HEADER_SIZE + chunkData.byteLength);
      const view = new DataView(packet.buffer);
      view.setUint32(0, i, false); // chunk index, big-endian
      packet.set(idBytes, 4);      // transfer ID
      packet.set(new Uint8Array(chunkData), HEADER_SIZE);

      this._broadcastOnChannel('media-transfer', packet.buffer);

      // Throttle to avoid buffer overflow
      await this._waitForBufferDrain();

      if (onProgress) {
        onProgress((i + 1) / totalChunks);
      }
    }

    // 3) Send completion signal
    this._broadcastOnChannel(
      'media-transfer',
      JSON.stringify({ type: 'media-complete', transferId })
    );

    // Emit locally for sender's own UI
    const localUrl = URL.createObjectURL(file);
    this._objectURLs.add(localUrl);
    this._emit('media-received', {
      transferId,
      ...meta,
      url: localUrl,
      isLocal: true,
    });

    return transferId;
  }

  // ── Receive-side media handling ─────────────────────────

  _handleMediaData(peerId, data) {
    if (typeof data === 'string') {
      const msg = JSON.parse(data);

      if (msg.type === 'media-meta') {
        // Initialize assembly buffer
        this.mediaAssembly.set(msg.transferId, {
          meta: msg,
          chunks: new Array(msg.totalChunks),
          received: 0,
        });
        this._emit('media-progress', {
          transferId: msg.transferId,
          progress: 0,
          meta: msg,
        });
      }

      if (msg.type === 'media-complete') {
        this._assembleMedia(msg.transferId);
      }
      return;
    }

    // Binary data — it's a chunk
    if (data instanceof ArrayBuffer) {
      const view = new DataView(data);
      const chunkIndex = view.getUint32(0, false);
      const decoder = new TextDecoder();
      const transferId = decoder.decode(new Uint8Array(data, 4, 36));
      const chunkData = data.slice(HEADER_SIZE);

      const assembly = this.mediaAssembly.get(transferId);
      if (!assembly) return;

      assembly.chunks[chunkIndex] = chunkData;
      assembly.received += 1;

      this._emit('media-progress', {
        transferId,
        progress: assembly.received / assembly.meta.totalChunks,
        meta: assembly.meta,
      });
    }
  }

  _assembleMedia(transferId) {
    const assembly = this.mediaAssembly.get(transferId);
    if (!assembly) return;

    const blob = new Blob(assembly.chunks, { type: assembly.meta.fileType });
    const url = URL.createObjectURL(blob);
    this._objectURLs.add(url);

    this._emit('media-received', {
      transferId,
      ...assembly.meta,
      url,
      isLocal: false,
    });

    // Free assembly buffer
    this.mediaAssembly.delete(transferId);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INTERNAL HELPERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  _broadcastOnChannel(channelName, data) {
    let sentCount = 0;
    for (const [peerId, peer] of this.peers) {
      const channel = peer.channels.get(channelName);
      if (channel && channel.readyState === 'open') {
        try {
          channel.send(data);
          sentCount++;
        } catch (err) {
          console.error(`[WebRTC] Failed to send on ${channelName} to ${peerId}:`, err);
        }
      } else {
        // console.warn(`[WebRTC] Cannot send on ${channelName} to ${peerId}: state is ${channel?.readyState}`);
      }
    }
    return sentCount > 0;
  }

  _waitForBufferDrain() {
    return new Promise((resolve) => {
      // Check all peers' media channels for buffer backpressure
      const check = () => {
        let allDrained = true;
        for (const [, peer] of this.peers) {
          const ch = peer.channels.get('media-transfer');
          if (ch && ch.bufferedAmount > 1_048_576) { // 1MB threshold
            allDrained = false;
            break;
          }
        }
        if (allDrained) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  _emit(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  _removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    for (const [, channel] of peer.channels) {
      try { channel.close(); } catch {}
    }
    try { peer.pc.close(); } catch {}
    this.peers.delete(peerId);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLEANUP (CRITICAL — prevents memory leaks)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async destroy() {
    this._destroyed = true;

    // Notify peers
    await this._broadcast('peer-leave').catch(() => {});

    // Close all peer connections
    for (const [peerId] of this.peers) {
      this._removePeer(peerId);
    }
    this.peers.clear();

    // Revoke ALL ObjectURLs
    for (const url of this._objectURLs) {
      URL.revokeObjectURL(url);
    }
    this._objectURLs.clear();

    this.stopAudio();
    this.remoteStreams.clear();

    // Clear media assembly buffers
    this.mediaAssembly.clear();

    // Unsubscribe from Supabase channel
    if (this._signalingChannel) {
      await this.supabase.removeChannel(this._signalingChannel);
      this._signalingChannel = null;
    }
  }
}
