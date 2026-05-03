import { useEffect, useCallback, useRef } from 'react';
import useMusicStore from '../../store/useMusicStore';
import { supabase } from '../../config/supabase';

/**
 * useMusicSync - Custom hook for Listen Together synchronization
 * Uses Supabase Realtime Broadcast to sync playback state between Host and Guest.
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
    setProgress 
  } = useMusicStore();
  
  const channelRef = useRef(null);
  const lastBroadcastRef = useRef(0);

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

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[MusicSync] Joined room: ${roomId}`);
        setSyncStatus('synced');
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
  }, [roomId]);

  // 2. Host Side: Broadcast state changes
  useEffect(() => {
    if (!isHost || !channelRef.current || !currentSong) return;

    const broadcastState = (isImmediate = false) => {
      const now = Date.now();
      
      // Throttle broadcasts unless it's an immediate event (play/pause)
      if (!isImmediate && now - lastBroadcastRef.current < 2000) return;

      channelRef.current.send({
        type: 'broadcast',
        event: 'sync',
        payload: {
          songId: currentSong.id,
          songMeta: currentSong,
          playing: isPlaying,
          pos: progress,
          sent_at: now
        }
      });
      
      lastBroadcastRef.current = now;
    };

    // Broadcast on progress update (throttled by useEffect dependency or internal timer)
    const interval = setInterval(() => broadcastState(false), 3000);
    
    // Immediate broadcast on play/pause or song change
    broadcastState(true);

    return () => clearInterval(interval);
  }, [isHost, isPlaying, currentSong?.id, roomId]);

  // 3. Guest Side: Handle incoming sync events
  const handleSyncEvent = useCallback((payload) => {
    if (isHost) return; // Host ignores sync messages

    const { songId, songMeta, playing, pos, sent_at } = payload;
    
    // A. Sync Song Selection
    if (!currentSong || currentSong.id !== songId) {
      console.log(`[MusicSync] Syncing new song: ${songMeta.title}`);
      setCurrentSong(songMeta);
    }

    // B. Sync Playback Status
    if (playing !== isPlaying) {
      setIsPlaying(playing);
    }

    // C. Sync Progress (with latency compensation)
    const latency = (Date.now() - sent_at) / 1000;
    const targetPos = pos + (playing ? latency : 0);

    // Only seek if drift is significant (> 1.5s) to avoid jitter
    const drift = Math.abs(progress - targetPos);
    if (drift > 1.5) {
      console.log(`[MusicSync] Correcting drift: ${drift.toFixed(2)}s`);
      setProgress(targetPos);
      
      // If we are significantly behind/ahead, we might show "lagging" status
      setSyncStatus('lagging');
      setTimeout(() => setSyncStatus('synced'), 1000);
    } else {
      setSyncStatus('synced');
    }
  }, [isHost, currentSong, isPlaying, progress]);

  return null;
};

export default useMusicSync;
