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
      <header className="library-header">
        <button onClick={onBack} className="action-btn">
          <ArrowLeft size={24} />
        </button>
        <h1>Liked Songs</h1>
      </header>

      <div className="library-content" style={{ marginTop: '20px' }}>
        {likedSongs.length > 0 ? (
          <div className="song-list">
            {likedSongs.map(song => (
              <motion.div 
                key={song.id} 
                className="song-list-item"
                onClick={() => handlePlay(song)}
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="song-artwork-wrapper">
                  <img src={song.image} alt="" className="song-artwork" />
                  <div className="play-overlay">
                    <Play size={24} fill="white" color="white" />
                  </div>
                </div>
                <div className="song-info">
                  <h4 className="song-title" dangerouslySetInnerHTML={{ __html: song.title }} />
                  <p className="song-artist" dangerouslySetInnerHTML={{ __html: song.artist }} />
                </div>
                <button className="action-btn" onClick={(e) => handleShare(e, song)}>
                  <Share2 size={18} />
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="empty-state-card">
            <div className="empty-icon-circle">
              <Heart size={32} />
            </div>
            <div className="empty-text">
              <h4>No Liked Songs</h4>
              <p>Tap the heart icon on any song to save it here.</p>
            </div>
            <button 
              className="empty-action-btn" 
              onClick={() => setActiveSection('search')}
            >
              <Search size={20} />
              Find Music
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicLikedPage;
