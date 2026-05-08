import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Share2, 
  Heart, 
  MoreVertical,
  Loader2,
  Music,
  Send
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import useMusicStore from '../../store/useMusicStore';
import useAuthStore from '../../store/authStore';
import useChatStore from '../../store/useChatStore';
import { MUSIC_API_BASE } from '../../config/musicConfig';
import { db } from '../../db/db';
import './MusicSearch.css'; // Reuse song item styles
import './MusicCategoryPage.css';

const MusicCategoryPage = ({ category, onBack }) => {
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingSongId, setLoadingSongId] = useState(null);
  const currentSong = useMusicStore(state => state.currentSong);
  const setCurrentSong = useMusicStore(state => state.setCurrentSong);
  const isPlaying = useMusicStore(state => state.isPlaying);
  const setIsPlaying = useMusicStore(state => state.setIsPlaying);
  const likedSongs = useMusicStore(state => state.likedSongs);
  const toggleLikeSong = useMusicStore(state => state.toggleLikeSong);
  const setActiveSection = useMusicStore(state => state.setActiveSection);
  const setSongToShare = useMusicStore(state => state.setSongToShare);
  const tabCache = useMusicStore(state => state.tabCache);
  const setTabCache = useMusicStore(state => state.setTabCache);
  const { user } = useAuthStore();
  const activeChat = useChatStore(state => state.activeChat);

  // Intent-based queries for maximum accuracy
  const categoryQueries = {
    'Trending': 'Bollywood Trending 2024 Hits',
    'Hindi': 'New Hindi Songs Latest 2024',
    'Punjabi': 'Latest Punjabi Songs 2024 New',
    'Haryanvi': 'New Haryanvi Songs Hits',
    'Bhojpuri': 'New Bhojpuri Songs 2024 Bhojpuri',
    'South': 'South Indian Hits Tamil Telugu 2024',
    'Romantic': 'Hindi Romantic Love Songs',
    '90s': '90s Bollywood Evergreen Hits',
    'Party': 'Bollywood Party Dance Songs',
    'Lofi': 'Hindi Lofi Chill Beats',
    'Global': 'Billboard Top Global Hits',
    'Devotional': 'Hindi Bhakti Songs Devotional'
  };

  const fetchSongs = useCallback(async () => {
    setIsLoading(true);
    const query = categoryQueries[category.id] || `${category.label} Songs`;
    
    // Check cache first
    if (tabCache[category.id]) {
      setSongs(tabCache[category.id]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${MUSIC_API_BASE}/search?query=${encodeURIComponent(query)}&page=1`);
      const data = await res.json();
      if (data.status === 'success') {
        const results = data.data.results || [];
        setSongs(results);
        setTabCache(category.id, results);
      }
    } catch (error) {
      console.error("Failed to fetch category songs:", error);
      toast.error("Failed to load category");
    } finally {
      setIsLoading(false);
    }
  }, [category, tabCache, setTabCache]);

  useEffect(() => {
    fetchSongs();
  }, [category.id]);

  const selectSong = async (song) => {
    setLoadingSongId(song.id);
    try {
      const res = await fetch(`${MUSIC_API_BASE}/song?id=${song.id}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const details = json.data;
        const mediaUrl = details.media_urls?.['320_KBPS'] || 
                         details.media_urls?.['160_KBPS'] || 
                         details.media_url;

        if (!mediaUrl) {
          toast.error("Could not get play link");
          return;
        }

        const finalSong = {
          id: details.id,
          title: details.title || details.name,
          artist: details.singers || details.primary_artists || details.artist,
          image: details.image || details.images?.['500x500'],
          media_url: mediaUrl,
          duration: details.duration || 0
        };

        setCurrentSong(finalSong);
        setIsPlaying(true);
      }
    } catch (err) {
      toast.error("Failed to play song");
    } finally {
      setLoadingSongId(null);
    }
  };

  const handleShare = async (song) => {
    const finalSong = {
      id: song.id,
      title: song.title || song.name,
      artist: song.singers || song.primary_artists || song.artist,
      image: song.image || song.images?.['500x500'],
      media_url: song.media_url || ''
    };

    setSongToShare(finalSong);
    setActiveSection('share');
  };

  return (
    <div className="category-view-container">
      {/* Category Header */}
      <header 
        className="category-hero-header"
        style={{ background: category.gradient }}
      >
        <button onClick={onBack} className="category-back-btn">
          <ArrowLeft size={20} />
        </button>

        <div className="category-hero-content">
          <div className="category-hero-icon-box">
            {React.createElement(category.icon, { size: 48, color: '#fff' })}
          </div>
          <div className="category-hero-info">
            <span>Playlist</span>
            <h1>{category.label}</h1>
          </div>
        </div>

        <div className="category-ambient-glow" />
      </header>

      {/* Songs List */}
      <div className="category-songs-section">
        {isLoading ? (
          <div className="shimmer-container">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="shimmer-song-item">
                <div className="shimmer-art" />
                <div className="shimmer-details">
                  <div className="shimmer-line title" />
                  <div className="shimmer-line artist" />
                </div>
              </div>
            ))}
          </div>
        ) : songs.length > 0 ? (
          <div className="category-song-list">
            <div className="category-section-label">
              POPULAR IN {category.label.toUpperCase()}
            </div>
            {songs.map((song, index) => (
              <div 
                key={song.id}
                onClick={() => selectSong(song)}
                className={`category-song-item ${currentSong?.id === song.id ? 'active' : ''}`}
              >
                <div className="song-art">
                  <img src={song.image} alt="" />
                  {currentSong?.id === song.id && (
                    <div className="song-play-indicator">
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1] }} 
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="play-bar"
                      />
                    </div>
                  )}
                </div>
                
                <div className="category-song-details">
                  <div 
                    className="category-song-title" 
                    dangerouslySetInnerHTML={{ __html: song.title }} 
                  />
                  
                  <div className="category-song-meta">
                    <span dangerouslySetInnerHTML={{ __html: song.artist || song.singers }} />
                    {song.album && <span className="song-meta-dot">•</span>}
                    {song.album && <span className="song-album-text" dangerouslySetInnerHTML={{ __html: song.album }} />}
                  </div>

                  <div className="category-song-tags">
                    {song.year && <span className="category-tag">{song.year}</span>}
                    {song.duration && (
                      <span className="category-tag">
                        {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="category-song-actions">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (currentSong?.id === song.id) {
                        setIsPlaying(!isPlaying);
                      } else {
                        selectSong(song);
                      }
                    }}
                    className={`category-action-btn ${currentSong?.id === song.id ? 'active' : ''}`}
                  >
                    {loadingSongId === song.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (currentSong?.id === song.id && isPlaying) ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleLikeSong(song, user?.id); }}
                    className={`category-icon-btn ${likedSongs.some(ls => ls.id === song.id) ? 'liked' : ''}`}
                  >
                    <Heart size={18} fill={likedSongs.some(ls => ls.id === song.id) ? 'currentColor' : 'none'} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleShare(song); }}
                    className="category-icon-btn"
                  >
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="category-empty-state">
            <Music size={48} />
            <p>No songs found for this category</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(MusicCategoryPage);
