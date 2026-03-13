// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// useWebRTCRoom.js — React Hook wrapping WebRTCRoomManager
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect, useRef, useCallback } from 'react';
import WebRTCRoomManager from '../services/WebRTCRoomManager';

export default function useWebRTCRoom({ roomId, userId, userName, supabase }) {
  const managerRef = useRef(null);
  const [peers, setPeers] = useState([]);                // [{ peerId, userName }]
  const [connectionState, setConnectionState] = useState('initializing');
  const [chatMessages, setChatMessages] = useState([]);  // all chat + media msgs
  const [gameEvents, setGameEvents] = useState([]);
  const [mediaProgress, setMediaProgress] = useState({}); // { transferId: 0-1 }

  // ── Initialize Manager ─────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId || !supabase) return;

    const manager = new WebRTCRoomManager({ roomId, userId, userName, supabase });
    managerRef.current = manager;

    // ── Event Listeners ────────────────────────────────
    const onPeerConnected = (e) => {
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
      setGameEvents((prev) => [...prev, e.detail]);
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

    manager.addEventListener('peer-connected', onPeerConnected);
    manager.addEventListener('peer-disconnected', onPeerDisconnected);
    manager.addEventListener('peer-left', onPeerLeft);
    manager.addEventListener('connection-state', onConnectionState);
    manager.addEventListener('chat-message', onChatMessage);
    manager.addEventListener('game-event', onGameEvent);
    manager.addEventListener('media-progress', onMediaProgress);
    manager.addEventListener('media-received', onMediaReceived);

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
      manager.destroy();
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

  return {
    peers,
    connectionState,
    chatMessages,
    gameEvents,
    mediaProgress,
    sendChat,
    sendGameEvent,
    sendMedia,
  };
}
