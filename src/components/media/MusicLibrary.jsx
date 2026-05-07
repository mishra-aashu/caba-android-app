import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Heart, ListMusic, User, ChevronRight, Play, Share2, Download, Zap, MoreVertical } from 'lucide-react';
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
      
      // Sort by added_at desc
      const sorted = downloads.sort((a, b) => (b.added_at || 0) - (a.added_at || 0));
      setDownloadedSongs(sorted);

      // Calculate total size
      const bytes = downloads.reduce((acc, curr) => acc + (curr.file_size || 0), 0);
      setTotalSize((bytes / (1024 * 1024)).toFixed(1) + ' MB');
    };

    fetchDownloads();
    
    // Subscribe to changes (simple polling or useLiveQuery if available)
    const interval = setInterval(fetchDownloads, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSongClick = (song) => {
    // If it's from the offline store, we might need to map it back to the expected song format
    // But our offline_music_store stores song_metadata which is already correct.
    setCurrentSong(song.song_metadata || song);
    setIsPlaying(true);
  };

  const handleShare = (e, song) => {
    e.stopPropagation();
    setSongToShare(song.song_metadata || song);
    setActiveSection('share');
  };

  return (
    <div className="music-library-container">
      <header className="library-header">
        <h1>Your Library</h1>
      </header>

      {/* Quick Access List */}
      <div className="quick-access-grid">
        <div className="quick-access-card" onClick={() => setActiveSection('liked')}>
          <div className="card-icon" style={{ background: 'linear-gradient(135deg, #ff4b2b 0%, #ff416c 100%)' }}>
            <Heart size={26} fill="white" color="white" />
          </div>
          <div className="card-content">
            <h4>Liked Songs</h4>
            <p>{likedSongs.length} songs</p>
          </div>
          <ChevronRight size={20} style={{ opacity: 0.3 }} />
        </div>

        <div className="quick-access-card" onClick={() => setActiveSection('downloads')}>
          <div className="card-icon" style={{ background: 'linear-gradient(135deg, #00ff88 0%, #00d1ff 100%)' }}>
            <Download size={26} color="white" />
          </div>
          <div className="card-content">
            <h4>Downloads</h4>
            <p>{downloadedSongs.length} songs • {totalSize}</p>
          </div>
          <ChevronRight size={20} style={{ opacity: 0.3 }} />
        </div>

        <div className="quick-access-card" onClick={() => setActiveSection('playlists')}>
          <div className="card-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ListMusic size={26} color="var(--brand-primary)" />
          </div>
          <div className="card-content">
            <h4>Playlists</h4>
            <p>Your curated mixes</p>
          </div>
          <ChevronRight size={20} style={{ opacity: 0.3 }} />
        </div>
      </div>

      {/* Downloaded Songs Section (New!) */}
      <section className="library-section">
        <h3 className="section-title">
          <Zap size={20} fill="#00ff88" color="#00ff88" />
          Recently Downloaded
        </h3>
        
        {downloadedSongs.length > 0 ? (
          <div className="song-list">
            {downloadedSongs.slice(0, 6).map(item => {
              const song = item.song_metadata || item;
              const artworkUrl = item.local_artwork_path 
                ? Capacitor.convertFileSrc(item.local_artwork_path) 
                : song.image;

              return (
                <div 
                  key={song.id} 
                  className="song-list-item"
                  onClick={() => handleSongClick(item)}
                >
                  <div className="song-artwork-wrapper">
                    <img src={artworkUrl} alt="" className="song-artwork" />
                    <div className="play-overlay">
                      <Play size={20} fill="white" color="white" />
                    </div>
                  </div>
                  <div className="song-info">
                    <h4 className="song-title" dangerouslySetInnerHTML={{ __html: song.title }} />
                    <p className="song-artist" dangerouslySetInnerHTML={{ __html: song.artist }} />
                    <div className="offline-badge">
                      <Zap size={10} fill="currentColor" />
                      Offline
                    </div>
                  </div>
                  <button className="action-btn" onClick={(e) => handleShare(e, item)}>
                    <Share2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state-card">
            <div className="empty-icon-circle">
              <Download size={24} color="rgba(255,255,255,0.2)" />
            </div>
            <div className="empty-text">
              <h4>No Downloads Yet</h4>
              <p>Your offline songs will appear here.</p>
            </div>
            <button className="empty-action-btn" onClick={() => setActiveSection('search')}>
              Find Music
            </button>
          </div>
        )}
      </section>

      {/* Liked Songs Preview */}
      {likedSongs.length > 0 && (
        <section className="library-section">
          <h3 className="section-title">Recent Likes</h3>
          <div className="song-list">
            {likedSongs.slice(0, 5).map(song => (
              <div 
                key={song.id} 
                className="song-list-item"
                onClick={() => handleSongClick(song)}
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
        </section>
      )}
    </div>
  );
};

export default MusicLibrary;
