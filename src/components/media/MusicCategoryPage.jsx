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
    <div className="category-view-container" style={{
      minHeight: '100vh',
      background: '#0b141a',
      paddingBottom: '140px'
    }}>
      {/* Category Header */}
      <header style={{
        padding: '24px 20px 40px 20px',
        background: category.gradient,
        borderBottomLeftRadius: '40px',
        borderBottomRightRadius: '40px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <button 
          onClick={onBack}
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: 'none',
            color: '#fff',
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            {React.createElement(category.icon, { size: 48, color: '#fff' })}
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Playlist</span>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '2.4rem', fontWeight: 900 }}>{category.label}</h1>
          </div>
        </div>

        {/* Ambient Decorative Circle */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '200px',
          height: '200px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '50%',
          filter: 'blur(60px)'
        }} />
      </header>

      {/* Songs List */}
      <div style={{ padding: '30px 16px 0 16px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ marginBottom: '16px', opacity: 0.5, fontSize: '0.85rem', fontWeight: 800, paddingLeft: '8px' }}>
              POPULAR IN {category.label.toUpperCase()}
            </div>
            {songs.map((song, index) => (
              <div 
                key={song.id}
                onClick={() => selectSong(song)}
                className="song-item-row"
                style={{
                  background: currentSong?.id === song.id ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255,255,255,0.03)',
                  padding: '12px 14px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  border: currentSong?.id === song.id ? '1px solid rgba(0, 255, 136, 0.2)' : '1px solid rgba(255,255,255,0.03)',
                  transition: 'background 0.2s ease, transform 0.2s ease'
                }}
              >
                <div style={{ position: 'relative', width: '52px', height: '52px' }}>
                  <img 
                    src={song.image} 
                    alt="" 
                    style={{ width: '100%', height: '100%', borderRadius: '14px', objectFit: 'cover' }} 
                  />
                  {currentSong?.id === song.id && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: '14px', display: 'flex', alignItems: 'center', justify: 'center' }}>
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1] }} 
                        transition={{ repeat: Infinity, duration: 1 }}
                        style={{ width: '4px', height: '16px', background: '#00ff88', borderRadius: '2px' }}
                      />
                    </div>
                  )}
                </div>
                
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ 
                    fontSize: '0.95rem', 
                    fontWeight: 800, 
                    color: currentSong?.id === song.id ? '#00ff88' : '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }} dangerouslySetInnerHTML={{ __html: song.title }} />
                  
                  <div className="song-info-row" style={{ marginTop: 0 }}>
                    <span className="song-artist-text" style={{ fontSize: '0.75rem' }} dangerouslySetInnerHTML={{ __html: song.artist || song.singers }} />
                    {song.album && <span className="song-meta-dot">•</span>}
                    {song.album && <span className="song-album-text" style={{ fontSize: '0.75rem', maxWidth: '100px' }} dangerouslySetInnerHTML={{ __html: song.album }} />}
                  </div>

                  <div className="song-stats-row" style={{ marginTop: '4px' }}>
                    {song.year && <span className="song-year-tag" style={{ fontSize: '0.6rem' }}>{song.year}</span>}
                    {song.duration && (
                      <span className="song-duration-tag" style={{ fontSize: '0.6rem' }}>
                        {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (currentSong?.id === song.id) {
                        setIsPlaying(!isPlaying);
                      } else {
                        selectSong(song);
                      }
                    }}
                    style={{ 
                      background: currentSong?.id === song.id ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255,255,255,0.05)', 
                      border: 'none', 
                      color: currentSong?.id === song.id ? '#00ff88' : '#fff',
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
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
                    style={{ background: 'none', border: 'none', color: likedSongs.some(ls => ls.id === song.id) ? '#ff4b4b' : '#fff', opacity: likedSongs.some(ls => ls.id === song.id) ? 1 : 0.3, padding: '8px' }}
                  >
                    <Heart size={18} fill={likedSongs.some(ls => ls.id === song.id) ? 'currentColor' : 'none'} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleShare(song); }}
                    style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.3, padding: '8px' }}
                  >
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: '60px', opacity: 0.4 }}>
            <Music size={48} style={{ marginBottom: '16px' }} />
            <p>No songs found for this category</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(MusicCategoryPage);
