import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Play, Share2, ArrowLeft, Search } from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';
import './MusicLibrary.css';

const MusicLikedPage = ({ onBack }) => {
  const likedSongs = useMusicStore(state => state.likedSongs);
  const setCurrentSong = useMusicStore(state => state.setCurrentSong);
  const setIsPlaying = useMusicStore(state => state.setIsPlaying);
  const setSongToShare = useMusicStore(state => state.setSongToShare);
  const setActiveSection = useMusicStore(state => state.setActiveSection);

  const handlePlay = (song) => {
    setCurrentSong(song);
    setIsPlaying(true);
  };

  const handleShare = (e, song) => {
    e.stopPropagation();
    setSongToShare(song);
    setActiveSection('share');
  };

  return (
    <div className="music-liked-page">
      <header className="library-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={onBack} className="action-btn" style={{ padding: '8px', opacity: 1 }}>
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ margin: 0 }}>Liked Songs</h1>
      </header>

      <div className="library-content" style={{ marginTop: '20px' }}>
        {likedSongs.length > 0 ? (
          <div className="song-list">
            {likedSongs.map(song => (
              <div 
                key={song.id} 
                className="song-list-item"
                onClick={() => handlePlay(song)}
              >
                <div className="song-artwork-wrapper">
                  <img src={song.image} alt="" className="song-artwork" />
                  <div className="play-overlay">
                    <Play size={20} fill="white" color="white" />
                  </div>
                </div>
                <div className="song-info">
                  <h4 className="song-title" dangerouslySetInnerHTML={{ __html: song.title }} />
                  <p className="song-artist" dangerouslySetInnerHTML={{ __html: song.artist }} />
                </div>
                <button className="action-btn" onClick={(e) => handleShare(e, song)}>
                  <Share2 size={18} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state-card" style={{ marginTop: '40px' }}>
            <div className="empty-icon-circle">
              <Heart size={32} fill="rgba(255,255,255,0.1)" color="rgba(255,255,255,0.2)" />
            </div>
            <div className="empty-text">
              <h4 style={{ fontSize: '1.4rem' }}>No Liked Songs</h4>
              <p>Tap the heart icon on any song to save it here.</p>
            </div>
            <button 
              className="empty-action-btn" 
              onClick={() => setActiveSection('search')}
              style={{ padding: '14px 32px', fontSize: '1rem', background: '#ff416c', color: '#fff' }}
            >
              <Search size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Discover Music
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicLikedPage;
