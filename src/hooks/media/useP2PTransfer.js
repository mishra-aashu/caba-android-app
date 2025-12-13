import { useState, useCallback } from 'react';
import { supabase } from '../../utils/supabase';

/**
 * React hook for P2P file transfer functionality
 * Adapted from p2p-transfer.js
 */
export const useP2PTransfer = (transferId, roomId, userId) => {
  const [peerConnection, setPeerConnection] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);
  const [channel, setChannel] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);

  const chunkSize = 16384; // 16KB
  const timeout = 30000; // 30 seconds connection timeout

  /**
   * Send file via P2P (upload to Supabase first, then send metadata)
   */
  const sendFile = useCallback(async (file, receiverId, onProgress) => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('📡 Initiating P2P connection...');

        // First, upload file to Supabase
        const uploadResult = await uploadToSupabase(file, onProgress);
        if (!uploadResult.success) {
          reject(new Error(uploadResult.error));
          return;
        }

        // Set connection timeout
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('P2P connection timeout'));
        }, timeout);

        // Initialize peer connection
        await initSenderPeerConnection(uploadResult.metadata, onProgress, () => {
          clearTimeout(timeoutId);
          resolve({ success: true });
        });

        // Subscribe to signals
        await subscribeToSignals(receiverId);

        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        await sendSignal('offer', {
          sdp: offer.sdp,
          type: offer.type,
          transferId: transferId
        });

        console.log('📤 Offer sent');

      } catch (error) {
        reject(error);
      }
    });
  }, [transferId, peerConnection]);

  /**
   * Receive file via P2P (receive metadata, then download from Supabase)
   */
  const receiveFile = useCallback(async (onProgress) => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('📡 Waiting for P2P connection...');

        // Set timeout
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('P2P receive timeout'));
        }, timeout);

        // Initialize receiver peer connection
        await initReceiverPeerConnection(onProgress, async (metadata) => {
          clearTimeout(timeoutId);

          // Download from Supabase
          const downloadResult = await downloadFromSupabase(metadata, onProgress);
          if (downloadResult.success) {
            resolve({ success: true, blob: downloadResult.blob, metadata });
          } else {
            reject(new Error(downloadResult.error));
          }
        });

        // Subscribe to offer
        await subscribeToSignals();

      } catch (error) {
        reject(error);
      }
    });
  }, [peerConnection]);

  /**
   * Upload file to Supabase Storage
   */
  const uploadToSupabase = useCallback(async (file, onProgress) => {
    try {
      console.log('☁️ Uploading file to Supabase for P2P transfer...');

      // Generate storage path
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const storagePath = `transfers/${userId}/${fileName}`;

      // Upload to Supabase
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return { success: false, error: uploadError.message };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(storagePath);

      // Update transfer record with storage info
      await supabase
        .from('media_transfers')
        .update({
          storage_path: storagePath,
          storage_bucket: 'media',
          transfer_method: 'p2p' // Keep as p2p but with storage
        })
        .eq('id', transferId);

      const metadata = {
        transferId: transferId,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath: storagePath,
        storageUrl: urlData.publicUrl
      };

      console.log('✅ File uploaded to Supabase for P2P transfer');
      return { success: true, metadata };

    } catch (error) {
      console.error('Upload to Supabase error:', error);
      return { success: false, error: error.message };
    }
  }, [transferId, userId]);

  /**
   * Download file from Supabase Storage
   */
  const downloadFromSupabase = useCallback(async (metadata, onProgress) => {
    try {
      console.log('☁️ Downloading file from Supabase:', metadata.storagePath);

      // Create signed URL for download
      const { data: signedData, error: signError } = await supabase.storage
        .from('media')
        .createSignedUrl(metadata.storagePath, 3600); // 1 hour expiry

      if (signError) {
        console.error('Signed URL error:', signError);
        return { success: false, error: signError.message };
      }

      // Download file
      const response = await fetch(signedData.signedUrl);

      if (!response.ok) {
        return { success: false, error: 'Download failed' };
      }

      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength, 10);

      let loaded = 0;
      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (onProgress && total > 0) {
          const progress = Math.round((loaded / total) * 100);
          onProgress(progress);
          setTransferProgress(progress);
        }
      }

      const blob = new Blob(chunks, { type: metadata.mimeType });
      console.log('✅ File downloaded from Supabase');

      return { success: true, blob };

    } catch (error) {
      console.error('Download from Supabase error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  /**
   * Initialize sender peer connection
   */
  const initSenderPeerConnection = useCallback(async (metadata, onProgress, onComplete) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    setPeerConnection(pc);

    // Create data channel
    const dc = pc.createDataChannel('fileTransfer', {
      ordered: true
    });

    setDataChannel(dc);
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      console.log('📡 DataChannel opened, sending metadata...');
      sendMetadata(metadata, onComplete);
    };

    dc.onerror = (error) => {
      console.error('DataChannel error:', error);
    };

    // ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await sendSignal('ice', {
          candidate: event.candidate.toJSON()
        });
      }
    };
  }, []);

  /**
   * Initialize receiver peer connection
   */
  const initReceiverPeerConnection = useCallback(async (onProgress, onComplete) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    setPeerConnection(pc);

    // Handle incoming data channel
    pc.ondatachannel = (event) => {
      const dc = event.channel;
      setDataChannel(dc);
      dc.binaryType = 'arraybuffer';

      let metadata = null;

      dc.onmessage = (e) => {
        if (typeof e.data === 'string') {
          const message = JSON.parse(e.data);

          if (message.type === 'metadata') {
            metadata = message;
            console.log('📋 Metadata received:', metadata);
          } else if (message.type === 'complete') {
            console.log('✅ Metadata transfer complete');
            onComplete(metadata);
          }
        }
      };

      dc.onopen = () => {
        console.log('📡 DataChannel opened (receiver)');
      };
    };

    // ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await sendSignal('ice', {
          candidate: event.candidate.toJSON()
        });
      }
    };
  }, []);

  /**
   * Send metadata through data channel
   */
  const sendMetadata = useCallback(async (metadata, onComplete) => {
    // Send metadata
    const message = {
      type: 'metadata',
      ...metadata
    };

    dataChannel.send(JSON.stringify(message));

    // Send complete signal
    dataChannel.send(JSON.stringify({ type: 'complete' }));

    console.log('✅ Metadata sent via P2P');

    // Update status to completed (file is uploaded, metadata sent)
    await supabase
      .from('media_transfers')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', transferId);

    onComplete();
  }, [dataChannel, transferId]);

  /**
   * Subscribe to WebRTC signals
   */
  const subscribeToSignals = useCallback(async (receiverId = null) => {
    const ch = supabase
      .channel(`p2p_transfer:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          const signal = payload.new;

          if (signal.sender_id === userId) return;

          try {
            if (signal.signal_type === 'offer') {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription({
                  type: 'offer',
                  sdp: signal.payload.sdp
                })
              );

              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);

              await sendSignal('answer', {
                sdp: answer.sdp,
                type: answer.type
              });

              console.log('✅ Answer sent');
            } else if (signal.signal_type === 'answer') {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription({
                  type: 'answer',
                  sdp: signal.payload.sdp
                })
              );

              console.log('✅ Answer received');
            } else if (signal.signal_type === 'ice') {
              await peerConnection.addIceCandidate(
                new RTCIceCandidate(signal.payload.candidate)
              );
            }
          } catch (error) {
            console.error('Signal handling error:', error);
          }
        }
      )
      .subscribe();

    setChannel(ch);
  }, [roomId, userId, peerConnection]);

  /**
   * Send WebRTC signal
   */
  const sendSignal = useCallback(async (type, payload) => {
    try {
      await supabase
        .from('webrtc_signals')
        .insert([{
          room_id: roomId,
          sender_id: userId,
          signal_type: type,
          purpose: 'transfer',
          payload: payload
        }]);
    } catch (error) {
      console.error('Send signal error:', error);
    }
  }, [roomId, userId]);

  /**
   * Cleanup
   */
  const cleanup = useCallback(() => {
    if (dataChannel) dataChannel.close();
    if (peerConnection) peerConnection.close();
    if (channel) supabase.removeChannel(channel);

    setDataChannel(null);
    setPeerConnection(null);
    setChannel(null);
    setIsConnected(false);
    setTransferProgress(0);
  }, [dataChannel, peerConnection, channel]);

  return {
    sendFile,
    receiveFile,
    cleanup,
    isConnected,
    transferProgress
  };
};