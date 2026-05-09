import { useEffect, useCallback, useRef } from 'react';
import useMusicStore from '../../store/useMusicStore';
import { supabase } from '../../config/supabase';

/**
 * useMusicSync - Custom hook for Listen Together synchronization
 * Uses Supabase Realtime Broadcast for ultra-low latency sync.
 * (Note: Broadcast does NOT write to database, it's transient like WebRTC).
 */
const useMusicSync = () => {
  const { 
    roomId, 
    isHost, 
    currentSong, 
    isPlaying, 
    progress, 
    setSyncStatus, 
    setCurrentSong, 
    setIsPlaying, 
    setProgress,
    leaveRoom
  } = useMusicStore();
  
  const channelRef = useRef(null);
  const lastBroadcastRef = useRef(0);
  const isInternalUpdate = useRef(false);

  // 1. Channel Lifecycle: Join/Leave room
  useEffect(() => {
    if (!roomId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase.channel(`music-sync:${roomId}`, {
      config: { broadcast: { self: false, ack: false } }
    });

    channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
      handleSyncEvent(payload);
    });

    // Handle host leaving
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      if (!isHost && leftPresences.some(p => p.isHost)) {
        console.log("[MusicSync] Host left the room");
        leaveRoom();
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[MusicSync] Joined room: ${roomId}`);
        setSyncStatus('synced');
        
        // Track presence to know when host leaves
        if (isHost) {
          await channel.track({ isHost: true, user_id: 'host' });
        }
      } else {
        setSyncStatus('disconnected');
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, isHost]);

  // 2. Host Side: Broadcast state changes
  useEffect(() => {
    if (!isHost || !channelRef.current) return;

    const broadcastState = (isImmediate = false) => {
      const now = Date.now();
      
      // Throttle heartbeat broadcasts, but allow immediate events
      if (!isImmediate && now - lastBroadcastRef.current < 2000) return;

      channelRef.current.send({
        type: 'broadcast',
        event: 'sync',
        payload: {
          songId: currentSong?.id || null,
          songMeta: currentSong || null,
          playing: isPlaying,
          pos: progress,
          sent_at: now
        }
      });
      
      lastBroadcastRef.current = now;
    };

    // Heartbeat for keeping guests in sync
    const interval = setInterval(() => broadcastState(false), 2000);
    
    // Immediate broadcast on any major state change
    broadcastState(true);

    return () => clearInterval(interval);
  }, [isHost, isPlaying, currentSong?.id, roomId]);

  // 3. Guest Side: Handle incoming sync events
  const handleSyncEvent = useCallback((payload) => {
    if (isHost) return;

    const { songId, songMeta, playing, pos, sent_at } = payload;
    
    isInternalUpdate.current = true;

    // A. Sync Song Selection (Master Control)
    if (!songId) {
      if (currentSong) {
        setCurrentSong(null);
      }
    } else if (!currentSong || currentSong.id !== songId) {
      console.log(`[MusicSync] Host changed song: ${songMeta.title}`);
      setCurrentSong(songMeta);
    }

    // B. Sync Playback Status (Master Control)
    if (playing !== isPlaying) {
      setIsPlaying(playing);
    }

    // C. Sync Progress (Latency compensated)
    const latency = (Date.now() - sent_at) / 1000;
    const targetPos = pos + (playing ? latency : 0);

    const drift = Math.abs(progress - targetPos);
    if (drift > 2.0 || (!isPlaying && drift > 0.5)) {
      // Significant drift or host stopped at different position
      console.log(`[MusicSync] Correcting drift: ${drift.toFixed(2)}s`);
      setProgress(targetPos);
      
      // Physically seek the player
      import('../../services/MusicPlayerService').then(m => {
        m.default.seekTo(targetPos);
      });

      setSyncStatus('lagging');
      setTimeout(() => setSyncStatus('synced'), 500);
    } else {
      setSyncStatus('synced');
    }

    setTimeout(() => { isInternalUpdate.current = false; }, 100);
  }, [isHost, currentSong, isPlaying, progress]);

  return null;
};

export default useMusicSync;
