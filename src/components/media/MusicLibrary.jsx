import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Heart, ListMusic, User, ChevronRight, Play, Share2, Download, Zap, MoreVertical, Search as SearchIcon } from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';
import { db } from '../../db/db';
import './MusicLibrary.css';

const MusicLibrary = () => {
  const likedSongs = useMusicStore(state => state.likedSongs);
  const setCurrentSong = useMusicStore(state => state.setCurrentSong);
  const setIsPlaying = useMusicStore(state => state.setIsPlaying);
  const setActiveSection = useMusicStore(state => state.setActiveSection);
  const setSongToShare = useMusicStore(state => state.setSongToShare);

  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [totalSize, setTotalSize] = useState('0 MB');

  // ── 0. Fetch Downloaded Songs ──────────────────────────────────
  useEffect(() => {
    const fetchDownloads = async () => {
      const downloads = await db.offline_music_store
        .where('download_status')
        .equals('completed')
        .toArray();
      
      const sorted = downloads.sort((a, b) => (b.added_at || 0) - (a.added_at || 0));
      setDownloadedSongs(sorted);

      const bytes = downloads.reduce((acc, curr) => acc + (curr.file_size || 0), 0);
      setTotalSize((bytes / (1024 * 1024)).toFixed(1) + ' MB');
    };

    fetchDownloads();
    const interval = setInterval(fetchDownloads, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSongClick = (song) => {
    setCurrentSong(song.song_metadata || song);
    setIsPlaying(true);
  };

  const handleShare = (e, song) => {
    e.stopPropagation();
    setSongToShare(song.song_metadata || song);
    setActiveSection('share');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  };

  return (
    <motion.div 
      className="music-library-container"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <header className="library-header">
        <motion.h1 variants={itemVariants}>Your Library</motion.h1>
      </header>

      {/* Quick Access List */}
      <div className="quick-access-grid">
        <motion.div 
          className="quick-access-card" 
          onClick={() => setActiveSection('liked')}
          variants={itemVariants}
        >
          <div className="card-icon" style={{ background: 'linear-gradient(135deg, #ff4b2b 0%, #ff416c 100%)' }}>
            <Heart size={28} fill="white" color="white" />
          </div>
          <div className="card-content">
            <h4>Liked Songs</h4>
            <p>{likedSongs.length} songs</p>
          </div>
          <ChevronRight size={20} style={{ opacity: 0.3 }} />
        </motion.div>

        <motion.div 
          className="quick-access-card" 
          onClick={() => setActiveSection('downloads')}
          variants={itemVariants}
        >
          <div className="card-icon" style={{ background: 'linear-gradient(135deg, #00ff88 0%, #00d1ff 100%)' }}>
            <Download size={28} color="white" />
          </div>
          <div className="card-content">
            <h4>Downloads</h4>
            <p>{downloadedSongs.length} songs • {totalSize}</p>
          </div>
          <ChevronRight size={20} style={{ opacity: 0.3 }} />
        </motion.div>

        <motion.div 
          className="quick-access-card" 
          onClick={() => setActiveSection('playlists')}
          variants={itemVariants}
        >
          <div className="card-icon" style={{ background: 'linear-gradient(135deg, #a8caba 0%, #5d4157 100%)' }}>
            <ListMusic size={28} color="white" />
          </div>
          <div className="card-content">
            <h4>Playlists</h4>
            <p>Your curated mixes</p>
          </div>
          <ChevronRight size={20} style={{ opacity: 0.3 }} />
        </motion.div>
      </div>

      {/* Recently Downloaded Section */}
      <motion.section className="library-section" variants={itemVariants}>
        <h3 className="section-title">
          <Zap size={22} fill="#00ff88" color="#00ff88" />
          Offline Hits
        </h3>
        
        {downloadedSongs.length > 0 ? (
          <div className="song-list">
            {downloadedSongs.slice(0, 6).map(item => {
              const song = item.song_metadata || item;
              const artworkUrl = item.local_artwork_path 
                ? Capacitor.convertFileSrc(item.local_artwork_path) 
                : song.image;

              return (
                <motion.div 
                  key={song.id} 
                  className="song-list-item"
                  onClick={() => handleSongClick(item)}
                  whileHover={{ x: 5 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="song-artwork-wrapper">
                    <img src={artworkUrl} alt="" className="song-artwork" />
                    <div className="play-overlay">
                      <Play size={24} fill="white" color="white" />
                    </div>
                  </div>
                  <div className="song-info">
                    <h4 className="song-title" dangerouslySetInnerHTML={{ __html: song.title }} />
                    <p className="song-artist" dangerouslySetInnerHTML={{ __html: song.artist }} />
                    <div className="offline-badge">
                      <Zap size={12} fill="currentColor" />
                      Cached
                    </div>
                  </div>
                  <button className="action-btn" onClick={(e) => handleShare(e, item)}>
                    <Share2 size={18} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state-card">
            <div className="empty-icon-circle">
              <Download size={32} color="rgba(255,255,255,0.2)" />
            </div>
            <div className="empty-text">
              <h4>Ready for Offline?</h4>
              <p>Download tracks to keep the vibe going anywhere.</p>
            </div>
            <button className="empty-action-btn" onClick={() => setActiveSection('search')}>
              <SearchIcon size={20} />
              Find Music
            </button>
          </div>
        )}
      </motion.section>

      {/* Liked Songs Preview */}
      {likedSongs.length > 0 && (
        <motion.section className="library-section" variants={itemVariants}>
          <h3 className="section-title">Favorite Vibes</h3>
          <div className="song-list">
            {likedSongs.slice(0, 5).map(song => (
              <motion.div 
                key={song.id} 
                className="song-list-item"
                onClick={() => handleSongClick(song)}
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.98 }}
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
        </motion.section>
      )}
    </motion.div>
  );
};

export default MusicLibrary;
