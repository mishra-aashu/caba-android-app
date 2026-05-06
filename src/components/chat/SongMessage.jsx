import React from 'react';
import { Play, Music, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useMusicStore from '../../store/useMusicStore';
import { toast } from 'react-hot-toast';
import styles from './SongMessage.module.css';

/**
 * SongMessage Component
 * Renders a rich media card for shared songs within chat bubbles.
 * Features: Artwork, metadata, and one-tap session joining.
 */
const SongMessage = ({ message, isMine }) => {
  const navigate = useNavigate();
  const song = message.metadata?.song;
  const { setCurrentSong, joinRoom } = useMusicStore();

  // Robust detection for session shares vs direct shares
  const isSessionShare = message.metadata?.type === 'music_session_share' || 
                        (message.metadata?.roomId && message.metadata?.type !== 'music_share');

  // Fallback metadata for session invites without an active song
  const displayTitle = song?.title || (isSessionShare ? 'Music Session' : 'Shared Song');
  const displayArtist = song?.artist || (isSessionShare ? 'Join and listen together' : 'Tap to play');
  const displayImage = song?.image || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop';

  const handlePlayAndSync = () => {
    if (song) {
      setCurrentSong(song);
    }
    
    if (message.metadata?.roomId) {
      console.log(`[SongMessage] Joining room from chat: ${message.metadata.roomId}`);
      joinRoom(message.metadata.roomId, false);
      toast.success(`Joined Session!`, { icon: '🎧' });
    }
    
    // Navigate to the player or session page
    navigate('/listen-together');
  };

  return (
    <div className={`${styles.songContainer} ${isMine ? styles.mine : styles.theirs} ${isSessionShare ? styles.sessionCard : styles.directCard}`}>
      <div className={styles.songCard}>
        
        {/* Artwork with Play Overlay */}
        <div className={styles.artworkWrapper}>
          <img src={displayImage} alt={displayTitle} className={styles.artwork} />
          <button className={styles.playBtn} onClick={handlePlayAndSync}>
            <div className={styles.playIconCircle}>
              <Play size={20} fill="currentColor" />
            </div>
          </button>
        </div>

        {/* Meta Info */}
        <div className={styles.songMeta}>
          <h4 className={styles.songTitle} dangerouslySetInnerHTML={{ __html: displayTitle }} />
          <p className={styles.songArtist} dangerouslySetInnerHTML={{ __html: displayArtist }} />
          
          <div className={styles.platformBadge}>
            <div className={styles.badgeIcon}>
              <Music size={10} />
            </div>
            <span>ELEVENGRAM MUSIC</span>
          </div>
        </div>

      </div>

      {/* Action Footer */}
      <button className={styles.joinAction} onClick={handlePlayAndSync}>
        {isSessionShare ? (
          <Radio size={14} className={styles.radioIcon} />
        ) : (
          <Play size={14} className={styles.radioIcon} />
        )}
        <span>{isSessionShare ? 'JOIN SESSION' : 'PLAY SONG'}</span>
      </button>
    </div>
  );
};

export default SongMessage;
