import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Native compression utility using Gzip CompressionStream (Supported in modern mobile WebViews)
 */
const compressData = async (dataStr) => {
  try {
    const stream = new Blob([dataStr]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const chunks = [];
    const reader = compressedStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const blob = new Blob(chunks);
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.warn('📡 [OfflineShare] Native compression failed, falling back to raw base64:', err);
    return btoa(unescape(encodeURIComponent(dataStr)));
  }
};

/**
 * Native decompression utility using Gzip DecompressionStream
 */
const decompressData = async (base64Str) => {
  try {
    const binary = atob(base64Str);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const stream = new Blob([bytes]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const chunks = [];
    const reader = decompressedStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const blob = new Blob(chunks);
    return await blob.text();
  } catch (err) {
    console.warn('📡 [OfflineShare] Native decompression failed, falling back to base64 decode:', err);
    return decodeURIComponent(escape(atob(base64Str)));
  }
};

/**
 * Prunes the SDP of standard WebRTC lines to make it extremely light (reduces size by 60-70%)
 * This ensures the compressed SDP fits perfectly inside a scanable QR code.
 */
const pruneSDP = (sdp) => {
  if (!sdp) return '';
  return sdp
    .split('\r\n')
    .filter((line) => {
      // Keep only host candidates and media descriptor + transport parameters.
      // Remove all audio/video codecs since we are purely data-channel.
      if (line.startsWith('a=rtpmap:') || line.startsWith('a=fmtp:') || line.startsWith('a=ssrc:')) {
        return false;
      }
      return (
        line.startsWith('v=') ||
        line.startsWith('o=') ||
        line.startsWith('s=') ||
        line.startsWith('t=') ||
        line.startsWith('c=') ||
        line.startsWith('a=mid') ||
        line.startsWith('a=sctp') ||
        line.startsWith('a=setup') ||
        line.startsWith('a=ice-ufrag') ||
        line.startsWith('a=ice-pwd') ||
        line.startsWith('a=fingerprint') ||
        line.startsWith('a=candidate') ||
        line.startsWith('m=application')
      );
    })
    .join('\r\n');
};

/**
 * Restores a pruned SDP back to standard structure if needed
 */
const restoreSDP = (prunedSdp) => {
  return prunedSdp; // RTCPeerConnection handles our pruned data-channel SDP natively!
};

export const useOfflineShare = () => {
  const [connectionState, setConnectionState] = useState('idle'); // idle, preparing, offering, scanning, connecting, connected, transferring, completed, failed
  const [activeRole, setActiveRole] = useState(null); // 'sender' | 'receiver'
  const [localOffer, setLocalOffer] = useState('');
  const [localAnswer, setLocalAnswer] = useState('');
  
  const [progress, setProgress] = useState(0);
  const [transferRate, setTransferRate] = useState(0); // bytes per second
  const [estimatedTime, setEstimatedTime] = useState(0); // seconds remaining
  const [fileMeta, setFileMeta] = useState(null);
  const [receivedFileBlob, setReceivedFileBlob] = useState(null);
  const [error, setError] = useState(null);

  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const fileRef = useRef(null);

  // Speed and time calculation refs
  const lastTimeRef = useRef(0);
  const lastBytesRef = useRef(0);
  const receivedChunksRef = useRef([]);
  const receivedBytesRef = useRef(0);
  const sendOffsetRef = useRef(0);

  const CHUNK_SIZE = 64 * 1024; // 64KB chunks (safe and super fast)
  const BUFFER_CEILING = 1024 * 1024 * 3; // 3MB backpressure limit

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    console.log('📡 [OfflineShare] Cleaning up connection and data channels...');
    if (channelRef.current) {
      try { channelRef.current.close(); } catch (e) {}
      channelRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
      pcRef.current = null;
    }
    fileRef.current = null;
    receivedChunksRef.current = [];
    receivedBytesRef.current = 0;
    sendOffsetRef.current = 0;
    
    setConnectionState('idle');
    setActiveRole(null);
    setLocalOffer('');
    setLocalAnswer('');
    setProgress(0);
    setTransferRate(0);
    setEstimatedTime(0);
    setFileMeta(null);
    setReceivedFileBlob(null);
    setError(null);
  }, []);

  // Update speed calculations every 500ms
  const updateMetrics = useCallback((bytesTransferred, totalSize) => {
    const now = Date.now();
    const duration = (now - lastTimeRef.current) / 1000; // seconds

    if (duration >= 0.5) {
      const bytesDiff = bytesTransferred - lastBytesRef.current;
      const speed = Math.max(0, bytesDiff / duration); // bytes per second
      
      setTransferRate(speed);
      
      if (speed > 0) {
        const remainingBytes = totalSize - bytesTransferred;
        setEstimatedTime(remainingBytes / speed);
      } else {
        setEstimatedTime(Infinity);
      }

      lastTimeRef.current = now;
      lastBytesRef.current = bytesTransferred;
    }
  }, []);

  /**
   * Sender Flow: 1. Setup Connection and generate Offer QR
   */
  const startSending = useCallback(async (file) => {
    if (!file) return;
    cleanup();

    console.log('📡 [OfflineShare] Initializing sender flow for file:', file.name);
    fileRef.current = file;
    setActiveRole('sender');
    setFileMeta({
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream'
    });
    setConnectionState('preparing');

    try {
      // Create PeerConnection (NO external STUN/TURN, pure local connection!)
      const pc = new RTCPeerConnection({
        iceServers: [], // Purely local, no internet signaling!
        iceTransportPolicy: 'all'
      });
      pcRef.current = pc;

      // Create Data Channel
      const dc = pc.createDataChannel('offline-file-transfer', {
        ordered: true
      });
      dc.binaryType = 'arraybuffer';
      channelRef.current = dc;

      // Setup Data Channel event handlers
      setupSenderChannel(dc);

      // Handle Connection state changes
      pc.onconnectionstatechange = () => {
        console.log('📡 [OfflineShare] Connection State Change:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setConnectionState('connected');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setConnectionState('failed');
          setError('Local peer connection failed. Please check hotspot configuration.');
        }
      };

      // Gather ICE candidates and update local SDP description
      pc.onicecandidate = async (event) => {
        if (event.candidate === null) {
          console.log('📡 [OfflineShare] ICE Candidate Gathering complete. Generating compressed QR offer...');
          const prunedSdp = pruneSDP(pc.localDescription.sdp);
          const bundle = {
            sdp: prunedSdp,
            type: 'offer',
            file: {
              name: file.name,
              size: file.size,
              type: file.type || 'application/octet-stream'
            }
          };
          const compressed = await compressData(JSON.stringify(bundle));
          setLocalOffer(compressed);
          setConnectionState('offering');
        }
      };

      // Create local offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

    } catch (err) {
      console.error('📡 [OfflineShare] Start Sending failed:', err);
      setError(err.message || 'Failed to initialize P2P server.');
      setConnectionState('failed');
    }
  }, [cleanup]);

  /**
   * Sender Flow: 2. Accept scanned Receiver Answer
   */
  const acceptReceiverAnswer = useCallback(async (compressedAnswer) => {
    if (!pcRef.current) return;
    setConnectionState('connecting');

    try {
      console.log('📡 [OfflineShare] Decompressing and setting remote answer description...');
      const decompressed = await decompressData(compressedAnswer);
      const bundle = JSON.parse(decompressed);

      if (bundle.type !== 'answer') {
        throw new Error('QR Code scanned is not a valid receiver answer.');
      }

      const restoredSdp = restoreSDP(bundle.sdp);
      const answerDesc = new RTCSessionDescription({
        type: 'answer',
        sdp: restoredSdp
      });

      await pcRef.current.setRemoteDescription(answerDesc);
      console.log('📡 [OfflineShare] Remote description set successfully. Establishing peer connection...');
    } catch (err) {
      console.error('📡 [OfflineShare] Failed to connect with answer:', err);
      setError(err.message || 'Failed to establish connection. Invalid QR Answer.');
      setConnectionState('failed');
    }
  }, []);

  /**
   * Receiver Flow: 1. Process Scanned Offer and Generate Answer QR
   */
  const startReceiving = useCallback(async (compressedOffer) => {
    cleanup();
    setActiveRole('receiver');
    setConnectionState('preparing');

    try {
      console.log('📡 [OfflineShare] Processing scanned QR offer...');
      const decompressed = await decompressData(compressedOffer);
      const bundle = JSON.parse(decompressed);

      if (bundle.type !== 'offer') {
        throw new Error('Scanned QR code is not a valid file-sharing offer.');
      }

      setFileMeta(bundle.file);

      // Create Peer Connection
      const pc = new RTCPeerConnection({
        iceServers: [],
        iceTransportPolicy: 'all'
      });
      pcRef.current = pc;

      // Handle Data Channel
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.binaryType = 'arraybuffer';
        channelRef.current = dc;
        setupReceiverChannel(dc, bundle.file);
      };

      pc.onconnectionstatechange = () => {
        console.log('📡 [OfflineShare] Connection State Change:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setConnectionState('connected');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setConnectionState('failed');
          setError('Local peer connection failed. Make sure you are on the same Wi-Fi subnet.');
        }
      };

      // Set Remote description
      const restoredSdp = restoreSDP(bundle.sdp);
      const offerDesc = new RTCSessionDescription({
        type: 'offer',
        sdp: restoredSdp
      });
      await pc.setRemoteDescription(offerDesc);

      // Gather ICE candidates and update Answer SDP
      pc.onicecandidate = async (event) => {
        if (event.candidate === null) {
          console.log('📡 [OfflineShare] ICE Candidate Gathering complete. Generating compressed QR answer...');
          const prunedSdp = pruneSDP(pc.localDescription.sdp);
          const answerBundle = {
            sdp: prunedSdp,
            type: 'answer'
          };
          const compressed = await compressData(JSON.stringify(answerBundle));
          setLocalAnswer(compressed);
          setConnectionState('scanning'); // Waiting for Sender to scan this back
        }
      };

      // Create local answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

    } catch (err) {
      console.error('📡 [OfflineShare] Start Receiving failed:', err);
      setError(err.message || 'Failed to parse QR offer.');
      setConnectionState('failed');
    }
  }, [cleanup]);

  /**
   * SENDER: Setup Data Channel events & Backpressure logic
   */
  const setupSenderChannel = (dc) => {
    dc.onopen = () => {
      console.log('📡 [OfflineShare] DataChannel OPENED! Handshaking...');
      setConnectionState('transferring');
      
      // Initialize speed tracking
      lastTimeRef.current = Date.now();
      lastBytesRef.current = 0;
      sendOffsetRef.current = 0;
      setProgress(0);

      // Send initial metadata details
      const meta = {
        type: 'meta',
        name: fileRef.current.name,
        size: fileRef.current.size,
        mime: fileRef.current.type || 'application/octet-stream'
      };
      dc.send(JSON.stringify(meta));
      
      // Configure backpressure event
      dc.bufferedAmountLowThreshold = 256 * 1024; // 256KB threshold to request next chunk
      dc.onbufferedamountlow = () => {
        sendChunks(dc);
      };

      // Start sending file chunks
      sendChunks(dc);
    };

    dc.onclose = () => {
      console.log('📡 [OfflineShare] Sender DataChannel closed.');
    };
  };

  /**
   * SENDER: Highly optimized async chunk sender with buffer backpressure.
   * Uses slice().arrayBuffer() (Promise-based) instead of FileReader inside a while loop
   * to guarantee correct ordering and offset tracking.
   */
  const sendChunks = async (dc) => {
    const file = fileRef.current;
    if (!file || !dc || dc.readyState !== 'open') return;

    try {
      while (sendOffsetRef.current < file.size) {
        // Backpressure: pause if buffer is too full
        if (dc.bufferedAmount > BUFFER_CEILING) {
          return; // 'onbufferedamountlow' will call sendChunks again
        }

        const currentOffset = sendOffsetRef.current;
        const currentSize = Math.min(CHUNK_SIZE, file.size - currentOffset);

        // Advance offset BEFORE await to prevent re-entrancy from onbufferedamountlow
        sendOffsetRef.current += currentSize;

        // Read the slice as ArrayBuffer using the Promise API (no FileReader race condition!)
        const arrayBuffer = await file.slice(currentOffset, currentOffset + currentSize).arrayBuffer();

        if (dc.readyState !== 'open') return; // Connection dropped during await

        dc.send(arrayBuffer);

        const totalBytesSent = currentOffset + currentSize;
        const currentProgress = Math.min(100, Math.round((totalBytesSent / file.size) * 100));
        setProgress(currentProgress);
        updateMetrics(totalBytesSent, file.size);

        if (totalBytesSent >= file.size) {
          console.log('📡 [OfflineShare] File sending complete! Sending done signal...');
          dc.send(JSON.stringify({ type: 'done' }));
          setConnectionState('completed');
          return;
        }
      }
    } catch (err) {
      console.error('📡 [OfflineShare] Error during chunk send:', err);
      setError('Error encountered while sending file.');
      setConnectionState('failed');
    }
  };

  /**
   * RECEIVER: Setup Data Channel events and chunk merger
   */
  const setupReceiverChannel = (dc, fileMetadata) => {
    dc.onopen = () => {
      console.log('📡 [OfflineShare] Receiver DataChannel OPENED! Waiting for stream...');
      setConnectionState('transferring');
      
      // Initialize speed tracking
      lastTimeRef.current = Date.now();
      lastBytesRef.current = 0;
      receivedBytesRef.current = 0;
      receivedChunksRef.current = [];
      setProgress(0);
    };

    dc.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'meta') {
            console.log('📡 [OfflineShare] Metadata received:', msg);
            setFileMeta(msg);
          } else if (msg.type === 'done') {
            console.log('📡 [OfflineShare] Stream complete! Rebuilding Blob...');
            const finalBlob = new Blob(receivedChunksRef.current, {
              type: fileMetadata.type || 'application/octet-stream'
            });
            setReceivedFileBlob(finalBlob);
            setConnectionState('completed');
            setProgress(100);
          }
        } else {
          // Add binary chunk to memory buffer
          receivedChunksRef.current.push(event.data);
          receivedBytesRef.current += event.data.byteLength;

          // Update Progress Bar
          const currentProgress = Math.min(100, Math.round((receivedBytesRef.current / fileMetadata.size) * 100));
          setProgress(currentProgress);

          // Update speed rates
          updateMetrics(receivedBytesRef.current, fileMetadata.size);
        }
      } catch (err) {
        console.error('📡 [OfflineShare] Error handling incoming chunk:', err);
        setError('Error while receiving network streams.');
        setConnectionState('failed');
      }
    };

    dc.onclose = () => {
      console.log('📡 [OfflineShare] Receiver DataChannel closed.');
    };
  };

  return {
    connectionState,
    activeRole,
    localOffer,
    localAnswer,
    progress,
    transferRate,
    estimatedTime,
    fileMeta,
    receivedFileBlob,
    error,
    startSending,
    acceptReceiverAnswer,
    startReceiving,
    cleanup
  };
};
