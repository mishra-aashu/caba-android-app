import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Download, Play, Share2, Trash2, Zap, ArrowLeft, Search } from 'lucide-react';
import { db } from '../../db/db';
import useMusicStore from '../../store/useMusicStore';
import MusicPlayerService from '../../services/MusicPlayerService';
import OfflineMusicManager from '../../services/OfflineMusicManager';
import { toast } from 'react-hot-toast';
import './MusicLibrary.css'; // Reuse library styles

const MusicDownloadsPage = ({ onBack }) => {
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const setCurrentSong = useMusicStore(state => state.setCurrentSong);
  const setIsPlaying = useMusicStore(state => state.setIsPlaying);
  const setSongToShare = useMusicStore(state => state.setSongToShare);
  const setActiveSection = useMusicStore(state => state.setActiveSection);

  const fetchDownloads = async () => {
    try {
      const downloads = await db.offline_music_store
        .where('download_status')
        .equals('completed')
        .toArray();
      
      const sorted = downloads.sort((a, b) => {
        const timeA = a.added_at || (a.downloaded_at ? new Date(a.downloaded_at).getTime() : 0);
        const timeB = b.added_at || (b.downloaded_at ? new Date(b.downloaded_at).getTime() : 0);
        return timeB - timeA;
      });
      setDownloadedSongs(sorted);
    } catch (error) {
      console.error('Failed to fetch downloads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDownloads();
    const interval = setInterval(fetchDownloads, 3000);
    return () => clearInterval(interval);
  }, []);

  const handlePlay = (item) => {
    setCurrentSong(item.song_metadata || item);
    setIsPlaying(true);
  };

  const handleDelete = async (e, songId) => {
    e.stopPropagation();
    if (window.confirm('Remove this download from your device?')) {
      await OfflineMusicManager.deleteDownload(songId);
      fetchDownloads();
      toast.success('Download removed');
    }
  };

  const handleShare = (e, item) => {
    e.stopPropagation();
    setSongToShare(item.song_metadata || item);
    setActiveSection('share');
  };

  return (
    <div className="music-downloads-page">
      <header className="library-header">
        <button onClick={onBack} className="action-btn">
          <ArrowLeft size={24} />
        </button>
        <h1>Downloads</h1>
      </header>

      <div className="library-content" style={{ marginTop: '20px' }}>
        {downloadedSongs.length > 0 ? (
          <div className="song-list">
            {downloadedSongs.map(item => {
              const song = item.song_metadata || item;
              const artworkUrl = item.local_artwork_path 
                ? Capacitor.convertFileSrc(item.local_artwork_path) 
                : song.image;

              return (
                <motion.div 
                  key={song.id} 
                  className="song-list-item"
                  onClick={() => handlePlay(item)}
                  whileHover={{ x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
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
                      <Zap size={10} fill="currentColor" />
                      {(item.file_size / (1024 * 1024)).toFixed(1)} MB • Cached
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="action-btn" onClick={(e) => handleShare(e, item)}>
                      <Share2 size={18} />
                    </button>
                    <button className="action-btn" onClick={(e) => handleDelete(e, song.id)} style={{ color: '#ff4b2b' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          !isLoading && (
            <div className="empty-state-card">
              <div className="empty-icon-circle">
                <Download size={32} />
              </div>
              <div className="empty-text">
                <h4>No Offline Music</h4>
                <p>Download your favorite tracks to listen without internet.</p>
              </div>
              <button 
                className="empty-action-btn" 
                onClick={() => setActiveSection('search')}
              >
                <Search size={20} />
                Find Music
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default MusicDownloadsPage;
