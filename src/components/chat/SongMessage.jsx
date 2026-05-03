import React from 'react';
import { Play, Music, Radio } from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';
import { toast } from 'react-hot-toast';
import styles from './SongMessage.module.css';

/**
 * SongMessage Component
 * Renders a rich media card for shared songs within chat bubbles.
 * Features: Artwork, metadata, and one-tap session joining.
 */
const SongMessage = ({ message, isMine }) => {
  const song = message.metadata?.song;
  const { setCurrentSong, joinRoom, togglePanel } = useMusicStore();

  if (!song) return null;

  const handlePlayAndSync = () => {
    if (song) {
      setCurrentSong(song);
    }
    
    if (message.metadata?.roomId) {
      console.log(`[SongMessage] Joining room from chat: ${message.metadata.roomId}`);
      joinRoom(message.metadata.roomId, false);
      toast.success(`Joined Session: ${message.metadata.roomId}`, { icon: '🎧' });
    }
    
    // Always open panel so user sees the player/room status
    togglePanel(true);
  };

  return (
    <div className={`${styles.songContainer} ${isMine ? styles.mine : styles.theirs}`}>
      <div className={styles.songCard}>
        
        {/* Artwork with Play Overlay */}
        <div className={styles.artworkWrapper}>
          <img src={song.image} alt={song.title} className={styles.artwork} />
          <button className={styles.playBtn} onClick={handlePlayAndSync}>
            <div className={styles.playIconCircle}>
              <Play size={20} fill="currentColor" />
            </div>
          </button>
        </div>

        {/* Meta Info */}
        <div className={styles.songMeta}>
          <h4 className={styles.songTitle} dangerouslySetInnerHTML={{ __html: song.title }} />
          <p className={styles.songArtist} dangerouslySetInnerHTML={{ __html: song.artist }} />
          
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
        <Radio size={14} className={styles.radioIcon} />
        <span>LISTEN TOGETHER</span>
      </button>
    </div>
  );
};

export default SongMessage;
