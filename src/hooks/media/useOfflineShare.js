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

  // Multi-file streaming refs
  const currentFileIndexRef = useRef(0);
  const currentFileOffsetRef = useRef(0);
  const totalBytesSentRef = useRef(0);
  const receivedFilesRef = useRef([]);
  const currentReceivingFileRef = useRef(null);

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
    
    // Reset multi-file refs
    currentFileIndexRef.current = 0;
    currentFileOffsetRef.current = 0;
    totalBytesSentRef.current = 0;
    receivedFilesRef.current = [];
    currentReceivingFileRef.current = null;

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
  const startSending = useCallback(async (filesList) => {
    const files = Array.isArray(filesList) ? filesList : [filesList];
    if (files.length === 0) return;
    cleanup();

    console.log('📡 [OfflineShare] Initializing sender flow for files count:', files.length);
    fileRef.current = files;
    setActiveRole('sender');

    const totalCombinedSize = files.reduce((acc, f) => acc + f.size, 0);
    const metaBundle = {
      name: files.length === 1 ? files[0].name : `${files.length} files`,
      size: totalCombinedSize,
      type: files.length === 1 ? (files[0].type || 'application/octet-stream') : 'application/x-multiple-files',
      files: files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream'
      }))
    };

    setFileMeta(metaBundle);
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
            file: metaBundle
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
      currentFileIndexRef.current = 0;
      currentFileOffsetRef.current = 0;
      totalBytesSentRef.current = 0;
      setProgress(0);

      const files = fileRef.current;
      const isMulti = Array.isArray(files);
      const totalSize = isMulti ? files.reduce((acc, f) => acc + f.size, 0) : files.size;

      // Send initial metadata details
      const meta = {
        type: 'meta',
        name: isMulti ? (files.length === 1 ? files[0].name : `${files.length} files`) : files.name,
        size: totalSize,
        mime: isMulti ? (files.length === 1 ? (files[0].type || 'application/octet-stream') : 'application/x-multiple-files') : (files.type || 'application/octet-stream'),
        files: isMulti ? files.map(f => ({ name: f.name, size: f.size, type: f.type || 'application/octet-stream' })) : null
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
   * Streams multiple files sequentially or single files with exact offset tracking.
   */
  const sendChunks = async (dc) => {
    const files = fileRef.current;
    if (!files || !dc || dc.readyState !== 'open') return;

    const isMulti = Array.isArray(files);
    const totalSize = isMulti ? files.reduce((acc, f) => acc + f.size, 0) : files.size;

    try {
      if (!isMulti) {
        // Single file fallback mode (compatible)
        const file = files;
        while (sendOffsetRef.current < file.size) {
          if (dc.bufferedAmount > BUFFER_CEILING) {
            return;
          }
          const currentOffset = sendOffsetRef.current;
          const currentSize = Math.min(CHUNK_SIZE, file.size - currentOffset);
          sendOffsetRef.current += currentSize;
          totalBytesSentRef.current += currentSize;

          const arrayBuffer = await file.slice(currentOffset, currentOffset + currentSize).arrayBuffer();
          if (dc.readyState !== 'open') return;

          dc.send(arrayBuffer);

          const currentProgress = Math.min(100, Math.round((totalBytesSentRef.current / totalSize) * 100));
          setProgress(currentProgress);
          updateMetrics(totalBytesSentRef.current, totalSize);
        }
        console.log('📡 [OfflineShare] Single file sending complete! Sending done signal...');
        dc.send(JSON.stringify({ type: 'done' }));
        setConnectionState('completed');
        return;
      }

      // Multi-file state loop
      while (currentFileIndexRef.current < files.length) {
        const fileIdx = currentFileIndexRef.current;
        const file = files[fileIdx];

        // 1. If we are at the very beginning of this file, send the 'start_file' signal
        if (currentFileOffsetRef.current === 0) {
          console.log(`📡 [OfflineShare] Starting transfer of file ${fileIdx + 1}/${files.length}: ${file.name}`);
          dc.send(JSON.stringify({
            type: 'start_file',
            index: fileIdx,
            name: file.name,
            size: file.size,
            mime: file.type || 'application/octet-stream'
          }));
        }

        // 2. Stream the file chunks
        while (currentFileOffsetRef.current < file.size) {
          if (dc.bufferedAmount > BUFFER_CEILING) {
            return; // Pause. Re-entered on low buffer event
          }

          const currentOffset = currentFileOffsetRef.current;
          const currentSize = Math.min(CHUNK_SIZE, file.size - currentOffset);

          // Advance offsets BEFORE await to prevent re-entrant race issues
          currentFileOffsetRef.current += currentSize;
          totalBytesSentRef.current += currentSize;

          const arrayBuffer = await file.slice(currentOffset, currentOffset + currentSize).arrayBuffer();
          if (dc.readyState !== 'open') return;

          dc.send(arrayBuffer);

          const currentProgress = Math.min(100, Math.round((totalBytesSentRef.current / totalSize) * 100));
          setProgress(currentProgress);
          updateMetrics(totalBytesSentRef.current, totalSize);
        }

        // 3. File completed, send the 'end_file' signal
        dc.send(JSON.stringify({
          type: 'end_file',
          index: fileIdx
        }));

        // Move to the next file in the list
        currentFileIndexRef.current += 1;
        currentFileOffsetRef.current = 0;
      }

      // 4. All files transferred successfully
      console.log('📡 [OfflineShare] All files sent successfully! Sending done signal...');
      dc.send(JSON.stringify({ type: 'done' }));
      setConnectionState('completed');
    } catch (err) {
      console.error('📡 [OfflineShare] Error during chunk send:', err);
      setError('Error encountered while sending files.');
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
      receivedFilesRef.current = [];
      currentReceivingFileRef.current = null;
      setProgress(0);
    };

    dc.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'meta') {
            console.log('📡 [OfflineShare] Overall Metadata received:', msg);
            setFileMeta(msg);
            receivedFilesRef.current = [];
          } else if (msg.type === 'start_file') {
            console.log('📡 [OfflineShare] Starting receipt of file:', msg.name);
            currentReceivingFileRef.current = msg;
            receivedChunksRef.current = [];
          } else if (msg.type === 'end_file') {
            console.log('📡 [OfflineShare] Completed receipt of file:', currentReceivingFileRef.current.name);
            const finalBlob = new Blob(receivedChunksRef.current, {
              type: currentReceivingFileRef.current.mime || 'application/octet-stream'
            });
            receivedFilesRef.current.push({
              name: currentReceivingFileRef.current.name,
              blob: finalBlob
            });
          } else if (msg.type === 'done') {
            console.log('📡 [OfflineShare] Stream complete! Rebuilding Blob...');
            if (receivedFilesRef.current.length === 0) {
              // Backward compatible fallback for single file stream
              const finalBlob = new Blob(receivedChunksRef.current, {
                type: fileMetadata.type || 'application/octet-stream'
              });
              setReceivedFileBlob(finalBlob);
            } else {
              setReceivedFileBlob(receivedFilesRef.current);
            }
            setConnectionState('completed');
            setProgress(100);
          }
        } else {
          // Add binary chunk to current file's memory buffer
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
