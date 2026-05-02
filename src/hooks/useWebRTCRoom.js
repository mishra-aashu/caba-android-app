// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// useWebRTCRoom.js — React Hook wrapping WebRTCRoomManager
//
// ROOT FIX: Uses the webrtcSingleton registry so that the SAME
// manager instance is shared across all re-mounts for a given
// roomId. This prevents:
//   - Duplicate signaling channels
//   - Missed peer-join broadcasts during re-mounts
//   - Game events not flowing after invitation acceptance
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect, useRef, useCallback } from 'react';
import { getOrCreateManager, releaseManager } from '../services/webrtcSingleton';

export default function useWebRTCRoom({ roomId, userId, userName, supabase }) {
  const managerRef = useRef(null);
  const [peers, setPeers] = useState([]);                // [{ peerId, userName }]
  const [connectionState, setConnectionState] = useState('initializing');
  const [chatMessages, setChatMessages] = useState([]);  // all chat + media msgs
  const [lastGameEvent, setLastGameEvent] = useState(null);
  const [mediaProgress, setMediaProgress] = useState({}); // { transferId: 0-1 }
  const [lastPeerId, setLastPeerId] = useState(null);
  
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: MediaStream }

  // ── Initialize Manager (via Singleton) ─────────────────
  useEffect(() => {
    if (!roomId || !userId || !supabase) return;

    // Get or create a shared manager for this roomId
    const manager = getOrCreateManager({
      roomId,
      userId,
      userName: userName || 'Player',
      supabase,
    });
    managerRef.current = manager;

    // ── Event Listeners ────────────────────────────────
    const onPeerConnected = (e) => {
      setLastPeerId(e.detail.peerId);
      setPeers((prev) => {
        if (prev.some((p) => p.peerId === e.detail.peerId)) return prev;
        return [...prev, { peerId: e.detail.peerId, userName: e.detail.userName }];
      });
    };

    const onPeerDisconnected = (e) => {
      setPeers((prev) => prev.filter((p) => p.peerId !== e.detail.peerId));
    };

    const onPeerLeft = (e) => {
      setPeers((prev) => prev.filter((p) => p.peerId !== e.detail.peerId));
    };

    const onConnectionState = (e) => {
      setConnectionState(e.detail.state);
    };

    const onChatMessage = (e) => {
      setChatMessages((prev) => [
        ...prev,
        { type: 'text', ...e.detail },
      ]);
    };

    const onGameEvent = (e) => {
      // Root Fix: Only store the latest event to prevent state bloat and loops
      setLastGameEvent({ ...e.detail, _ts: Date.now() });
    };

    const onMediaProgress = (e) => {
      setMediaProgress((prev) => ({
        ...prev,
        [e.detail.transferId]: e.detail.progress,
      }));
    };

    const onMediaReceived = (e) => {
      const { transferId, url, mediaType, senderName, senderId, isLocal, timestamp } =
        e.detail;

      // Remove from progress tracking
      setMediaProgress((prev) => {
        const next = { ...prev };
        delete next[transferId];
        return next;
      });

      // Add to chat feed as a media message
      setChatMessages((prev) => [
        ...prev,
        {
          type: 'media',
          id: transferId,
          mediaType,
          url,
          senderName,
          senderId,
          isLocal,
          timestamp,
        },
      ]);
    };

    const onLocalStreamChanged = (e) => {
      setLocalStream(e.detail.stream);
      setIsAudioEnabled(!!e.detail.stream);
    };

    const onTrackReceived = (e) => {
      console.log(`[useWebRTCRoom] Track received from ${e.detail.peerId}`);
      setRemoteStreams(prev => ({
        ...prev,
        [e.detail.peerId]: e.detail.stream
      }));
    };

    manager.addEventListener('peer-connected', onPeerConnected);
    manager.addEventListener('peer-disconnected', onPeerDisconnected);
    manager.addEventListener('peer-left', onPeerLeft);
    manager.addEventListener('connection-state', onConnectionState);
    manager.addEventListener('chat-message', onChatMessage);
    manager.addEventListener('game-event', onGameEvent);
    manager.addEventListener('media-progress', onMediaProgress);
    manager.addEventListener('media-received', onMediaReceived);
    manager.addEventListener('local-stream-changed', onLocalStreamChanged);
    manager.addEventListener('track-received', onTrackReceived);

    setConnectionState('waiting');

    // ── Cleanup on unmount ─────────────────────────────
    return () => {
      manager.removeEventListener('peer-connected', onPeerConnected);
      manager.removeEventListener('peer-disconnected', onPeerDisconnected);
      manager.removeEventListener('peer-left', onPeerLeft);
      manager.removeEventListener('connection-state', onConnectionState);
      manager.removeEventListener('chat-message', onChatMessage);
      manager.removeEventListener('game-event', onGameEvent);
      manager.removeEventListener('media-progress', onMediaProgress);
      manager.removeEventListener('media-received', onMediaReceived);
      manager.removeEventListener('local-stream-changed', onLocalStreamChanged);
      manager.removeEventListener('track-received', onTrackReceived);

      // Release singleton reference — destroys only when refCount hits 0
      releaseManager(roomId);
      managerRef.current = null;
    };
  }, [roomId, userId, userName, supabase]);

  // ── Exposed Actions ─────────────────────────────────────

  const sendChat = useCallback((text) => {
    managerRef.current?.sendChatMessage(text);
  }, []);

  const sendGameEvent = useCallback((event) => {
    managerRef.current?.sendGameEvent(event);
  }, []);

  const sendMedia = useCallback(async (file, mediaType, onProgress) => {
    return managerRef.current?.sendMedia(file, mediaType, onProgress);
  }, []);

  /**
   * Re-announce presence after invitation acceptance.
   * Triggers SDP re-negotiation so peers that already exist in the
   * channel will re-connect to this client.
   */
  const reAnnounce = useCallback(async () => {
    await managerRef.current?.reAnnounce();
  }, []);

  const toggleAudio = useCallback(async () => {
    if (isAudioEnabled) {
      managerRef.current?.stopAudio();
    } else {
      try {
        await managerRef.current?.startAudio();
      } catch (err) {
        console.error('[WebRTC] Voice error:', err);
        toast.error('Could not access microphone. Please check permissions.');
      }
    }
  }, [isAudioEnabled]);

  return {
    peers,
    connectionState,
    chatMessages,
    lastGameEvent,
    mediaProgress,
    lastPeerId,
    isAudioEnabled,
    localStream,
    remoteStreams,
    sendChat,
    sendGameEvent,
    sendMedia,
    reAnnounce,
    toggleAudio,
  };
}
