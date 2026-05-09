import React, { useState, useEffect } from 'react';
import { Play, Music, Radio, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useMusicStore from '../../store/useMusicStore';
import { supabase } from '../../config/supabase';
import { toast } from 'react-hot-toast';
import styles from './SongMessage.module.css';

/**
 * SongMessage Component
 * Renders a rich media card for shared songs within chat bubbles.
 * Features: Artwork, metadata, and one-tap session joining.
 */
const SongMessage = ({ message, isMine }) => {
  const navigate = useNavigate();
  const [roomStatus, setRoomStatus] = useState('unknown'); // 'active', 'ended', 'unknown'
  const song = message.metadata?.song;
  const { setCurrentSong, joinRoom } = useMusicStore();

  const roomId = message.metadata?.roomId;
  const isSessionShare = message.metadata?.type === 'music_session_share' || 
                        (roomId && message.metadata?.type !== 'music_share');

  // 1. Fetch & Subscribe to Room Status
  useEffect(() => {
    if (!isSessionShare || !roomId) return;

    const fetchStatus = async () => {
      const { data, error } = await supabase
        .from('music_rooms')
        .select('status')
        .eq('id', roomId)
        .single();
      
      if (!error && data) {
        setRoomStatus(data.status);
      }
    };

    fetchStatus();

    // Realtime listener for room status changes
    const channel = supabase
      .channel(`room-status-${roomId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'music_rooms', 
        filter: `id=eq.${roomId}` 
      }, (payload) => {
        setRoomStatus(payload.new.status);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSessionShare, roomId]);

  // Fallback metadata for session invites without an active song
  const isEnded = roomStatus === 'ended';
  const displayTitle = song?.title || (isSessionShare ? 'Music Session' : 'Shared Song');
  
  let displayArtist = song?.artist || (isSessionShare ? 'Join and listen together' : 'Tap to play');
  if (isSessionShare && isEnded) {
    displayArtist = 'This session has ended';
  }

  const displayImage = song?.image || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop';

  const handlePlayAndSync = () => {
    if (isEnded) {
      toast.error("This session has ended");
      return;
    }

    if (song) {
      setCurrentSong(song);
    }
    
    if (roomId) {
      console.log(`[SongMessage] Joining room from chat: ${roomId}`);
      joinRoom(roomId, false);
      toast.success(`Joined Session!`, { icon: '🎧' });
    }
    
    navigate('/listen-together');
  };

  return (
    <div className={`${styles.songContainer} ${isMine ? styles.mine : styles.theirs} ${isSessionShare ? styles.sessionCard : styles.directCard} ${isEnded ? styles.ended : ''}`}>
      <div className={styles.songCard}>
        
        {/* Artwork with Play Overlay */}
        <div className={styles.artworkWrapper}>
          <img src={displayImage} alt={displayTitle} className={`${styles.artwork} ${isEnded ? styles.grayscale : ''}`} />
          {!isEnded && (
            <button className={styles.playBtn} onClick={handlePlayAndSync}>
              <div className={styles.playIconCircle}>
                <Play size={20} fill="currentColor" />
              </div>
            </button>
          )}
          {isEnded && (
            <div className={styles.endedOverlay}>
              <XCircle size={24} color="rgba(255,255,255,0.6)" />
            </div>
          )}
        </div>

        {/* Meta Info */}
        <div className={styles.songMeta}>
          <h4 className={styles.songTitle} dangerouslySetInnerHTML={{ __html: displayTitle }} />
          <p className={styles.songArtist} dangerouslySetInnerHTML={{ __html: displayArtist }} />
          
          <div className={styles.platformBadge}>
            <div className={styles.badgeIcon}>
              {isSessionShare && isEnded ? <Radio size={10} style={{ opacity: 0.5 }} /> : <Music size={10} />}
            </div>
            <span>{isSessionShare && isEnded ? 'SESSION EXPIRED' : 'ELEVENGRAM MUSIC'}</span>
          </div>
        </div>

      </div>

      {/* Action Footer */}
      <button 
        className={`${styles.joinAction} ${isEnded ? styles.disabledAction : ''}`} 
        onClick={handlePlayAndSync}
        disabled={isEnded}
      >
        {isSessionShare ? (
          isEnded ? <XCircle size={14} /> : <Radio size={14} className={styles.radioIcon} />
        ) : (
          <Play size={14} className={styles.radioIcon} />
        )}
        <span>
          {isSessionShare 
            ? (isEnded ? 'SESSION ENDED' : 'JOIN SESSION') 
            : 'PLAY SONG'
          }
        </span>
      </button>
    </div>
  );
};

export default SongMessage;
