import React from 'react';
import { Heart, ListMusic, User, ChevronRight, Play } from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';

const MusicLibrary = () => {
  const { likedSongs, setCurrentSong, setIsPlaying } = useMusicStore();

  const handleSongClick = (song) => {
    setCurrentSong(song);
    setIsPlaying(true);
  };

  return (
    <div className="music-library-fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: '#fff' }}>Your Library</h1>
      </header>

      {/* Quick Access List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '40px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px', 
          padding: '16px', 
          background: 'rgba(255,255,255,0.03)', 
          borderRadius: '16px',
          cursor: 'pointer'
        }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #00a884 0%, #00d2ad 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={24} fill="white" />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>Liked Songs</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5 }}>{likedSongs.length} songs</p>
          </div>
          <ChevronRight size={20} style={{ opacity: 0.3 }} />
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px', 
          padding: '16px', 
          background: 'rgba(255,255,255,0.03)', 
          borderRadius: '16px',
          cursor: 'pointer'
        }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ListMusic size={24} style={{ color: 'var(--brand-primary)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>Playlists</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5 }}>Create your own mix</p>
          </div>
          <ChevronRight size={20} style={{ opacity: 0.3 }} />
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px', 
          padding: '16px', 
          background: 'rgba(255,255,255,0.03)', 
          borderRadius: '16px',
          cursor: 'pointer'
        }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={24} style={{ color: 'var(--brand-primary)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>Artists</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5 }}>Followed artists</p>
          </div>
          <ChevronRight size={20} style={{ opacity: 0.3 }} />
        </div>
      </div>

      {/* Liked Songs Preview */}
      {likedSongs.length > 0 && (
        <section>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800 }}>Recent Likes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {likedSongs.slice(0, 5).map(song => (
              <div 
                key={song.id} 
                onClick={() => handleSongClick(song)}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
              >
                <div style={{ position: 'relative', width: '50px', height: '50px', flexShrink: 0 }}>
                  <img src={song.image} alt="" style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }} />
                  <div className="lib-play-overlay">
                    <Play size={18} fill="white" />
                  </div>
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .lib-play-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.3);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        div:hover .lib-play-overlay { opacity: 1; }
      `}</style>
    </div>
  );
};

export default MusicLibrary;
