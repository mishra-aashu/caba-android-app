import React, { useState, useEffect, memo, useRef, useMemo, useCallback } from 'react';
import { motion as m, AnimatePresence } from 'framer-motion';

import useMusicStore from '../../store/useMusicStore';
import { MUSIC_API_URL, MUSIC_API_BASE } from '../../config/musicConfig';

import useChatStore, { selectActiveChatId } from '../../store/useChatStore';
import useAuthStore from '../../store/authStore';
import { db } from '../../db/db';
import { frontendToDb } from '../../utils/dbFieldMapping';
import { queueAction, QUEUE_ACTIONS } from '../../services/offlineQueue';
import { 
  Search, Play, Pause, Users, Music, Loader2, Send, Heart, 
  MoreVertical, List, User, Disc, CloudDownload, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { spotifyService } from '../../services/spotifyService';
import './MusicSearch.css';

// ----------------------------------------------------------------------
// Helper – shared song‑detail fetching
// ----------------------------------------------------------------------
const enrichSongDetail = async (song) => {
  // If media_urls or media_url already exist, return as is
  if (song.media_urls?.['320_KBPS'] || song.media_urls?.['160_KBPS'] || song.media_url) {
    return song;
  }
  try {
    const res = await fetch(`${MUSIC_API_BASE}/song?id=${song.id}`);
    const json = await res.json();
    if (json.status === 'success' && json.data) {
      // Merge original song with fetched data (fetched data takes priority for missing fields)
      return { ...song, ...json.data };
    }
  } catch (e) {
    console.warn('[enrichSongDetail] fetch failed', e);
  }
  return song;
};

// ----------------------------------------------------------------------
// Context menu (unchanged, but now uses the helper if needed)
// ----------------------------------------------------------------------
const SongContextMenu = ({ song, onClose, onPlay, onInvite, onLike, isLiked }) => {
  return (
    <div className="menu-backdrop" onClick={onClose}>
      <m.div 
        className="song-bottom-sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        
        <div className="menu-header">
          <img src={song.image || song.images?.['150x150']} alt="" />
          <div className="menu-song-info">
            <h5 dangerouslySetInnerHTML={{ __html: song.title }} />
            <p dangerouslySetInnerHTML={{ __html: song.artist || song.subtitle }} />
          </div>
        </div>
        
        <div className="menu-divider" />
        
        <button className="menu-item" onClick={onPlay}>
          <Play size={18} />
          <span>Play Now</span>
        </button>
        
        <button className="menu-item" onClick={onLike}>
          <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
          <span>{isLiked ? 'Liked' : 'Like'}</span>
        </button>
        
        <button className="menu-item" onClick={onInvite}>
          <Users size={18} />
          <span>Share to Chat</span>
        </button>
        
        <button className="menu-item" onClick={() => toast.success("Added to Queue")}>
          <List size={18} />
          <span>Add to Queue</span>
        </button>
        
        <div className="menu-divider" />
        
        <button className="menu-item" onClick={() => toast.success("Artist page coming soon")}>
          <User size={18} />
          <span>View Artist</span>
        </button>
      </m.div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Memoized Song Item (unchanged)
// ----------------------------------------------------------------------
const SongItem = memo(({ 
  song, index, onSelect, onInvite, onToggle, onLike, onShowOptions,
  currentSongId, isPlaying, isLiked, isLoadingDetails 
}) => {
  const thumbnail = song.image || (song.images?.['150x150']) || '';
  const isCurrent = currentSongId === song.id;

  return (
    <div 
      className={`song-item ${isCurrent ? 'active' : ''} ${isLoadingDetails ? 'loading-details' : ''}`}
      onClick={() => !isLoadingDetails && onSelect(song)}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="song-item-vibe" style={{ backgroundImage: `url(${thumbnail})` }} />
      <div className="song-art">
        <img src={thumbnail} alt={song.title} loading="lazy" />
        {isLoadingDetails ? (
          <div className="art-overlay loading">
            <Loader2 className="animate-spin text-white" size={24} />
          </div>
        ) : isCurrent ? (
          <div className="art-overlay active" onClick={(e) => onToggle(e, song)}>
            {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
          </div>
        ) : null}
      </div>

      <div className="song-meta" onClick={() => onSelect(song)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h4 className="song-title-text" dangerouslySetInnerHTML={{ __html: song.title || song.name }} />
          {isCurrent && isPlaying && (
            <div className="live-visualizer-mini list-v">
              <div className="bar" />
              <div className="bar" />
              <div className="bar" />
              <div className="bar" />
            </div>
          )}
        </div>
        <p className="song-artist-text" dangerouslySetInnerHTML={{ __html: song.singers || song.artist || song.subtitle || song.primaryArtists }} />
      </div>

      <div className="song-item-actions">
        <button 
          className={`play-btn-circle ${isCurrent && isPlaying ? 'playing' : ''}`}
          onClick={(e) => onToggle(e, song)}
        >
          {isCurrent && isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <button 
          className={`like-btn ${isLiked ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onLike(song);
          }}
          title={isLiked ? "Remove from Likes" : "Add to Likes"}
        >
          <Heart size={18} fill={isLiked ? "currentColor" : "none"} strokeWidth={isLiked ? 0 : 2} />
        </button>
        <button 
          className="more-options-btn"
          onClick={(e) => {
            e.stopPropagation();
            onShowOptions(e, song);
          }}
        >
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
});

// ----------------------------------------------------------------------
// MusicHero (unchanged)
// ----------------------------------------------------------------------
const MusicHero = memo(({ songs, onPlay }) => {
  const { isPlaying, currentSong } = useMusicStore();
  const scrollRef = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const animationRef = useRef(null);
  const scrollPosRef = useRef(0);

  useEffect(() => {
    if (!scrollRef.current || songs.length === 0 || isDragging) return;
    
    let lastTime = performance.now();
    const scroll = (time) => {
      if (!scrollRef.current || isDragging) return;
      
      const deltaTime = time - lastTime;
      lastTime = time;
      
      scrollPosRef.current += 0.05 * deltaTime;
      
      if (scrollPosRef.current >= scrollRef.current.scrollWidth / 2) {
        scrollPosRef.current = 0;
      }
      
      scrollRef.current.style.transform = `translateX(-${scrollPosRef.current}px)`;
      animationRef.current = requestAnimationFrame(scroll);
    };

    const startTimeout = setTimeout(() => {
      animationRef.current = requestAnimationFrame(scroll);
    }, 500);

    return () => {
      clearTimeout(startTimeout);
      cancelAnimationFrame(animationRef.current);
    };
  }, [songs, isDragging]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollPosRef.current;
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollPosRef.current = scrollLeft.current - walk;
    
    if (scrollPosRef.current < 0) scrollPosRef.current = 0;
    if (scrollPosRef.current > scrollRef.current.scrollWidth / 2) scrollPosRef.current = scrollRef.current.scrollWidth / 2;
    
    scrollRef.current.style.transform = `translateX(-${scrollPosRef.current}px)`;
  };

  const handleStopDragging = () => {
    setIsDragging(false);
  };

  const displaySongs = useMemo(() => {
    if (songs.length === 0) return [];
    return [...songs, ...songs];
  }, [songs]);

  if (songs.length === 0) return null;

  return (
    <div className="music-hero-container">
      <div 
        className="hero-scroll-wrapper" 
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleStopDragging}
        onMouseLeave={handleStopDragging}
        onTouchStart={(e) => {
          setIsDragging(true);
          startX.current = e.touches[0].pageX - scrollRef.current.offsetLeft;
          scrollLeft.current = scrollPosRef.current;
        }}
        onTouchMove={(e) => {
          if (!isDragging) return;
          const x = e.touches[0].pageX - scrollRef.current.offsetLeft;
          const walk = (x - startX.current) * 1.5;
          scrollPosRef.current = scrollLeft.current - walk;
          scrollRef.current.style.transform = `translateX(-${scrollPosRef.current}px)`;
        }}
        onTouchEnd={handleStopDragging}
        style={{ 
          willChange: 'transform',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        {displaySongs.map((song, i) => (
          <div 
            key={`${song.id}-${i}`} 
            className="hero-card"
            onClick={() => !isDragging && onPlay(song)}
          >
            <div className="hero-card-inner">
              <img 
                src={song.image || (song.images?.['500x500'])} 
                alt={song.title} 
                className="hero-img"
                draggable="false"
              />
                <div className="hero-overlay">
                  {isPlaying && currentSong?.id === song.id && (
                    <div className="live-visualizer-mini">
                      <div className="bar" />
                      <div className="bar" />
                      <div className="bar" />
                    </div>
                  )}
                  <div className="hero-play-icon">
                    {currentSong?.id === song.id && isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
                  </div>
                  <div className="hero-meta">
                    <h5 dangerouslySetInnerHTML={{ __html: song.title }} />
                    <p dangerouslySetInnerHTML={{ __html: song.artist || song.subtitle }} />
                  </div>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ----------------------------------------------------------------------
// Main MusicSearch component – cleaned & optimised
// ----------------------------------------------------------------------
const MusicSearch = ({ hideHeader = false, defaultTab = 'Trending' }) => {
  const [contextMenu, setContextMenu] = useState(null);
  const [isMoreLoading, setMoreLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingSongId, setLoadingSongId] = useState(null);
  const [heroSongs, setHeroSongs] = useState([]);
  
  // Spotify State
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [spotifyTracks, setSpotifyTracks] = useState([]);
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const tabs = useMemo(() => [
    { id: "Trending", query: "Bollywood Top Hits 2024" },
    { id: "Hindi", query: "New Hindi Songs 2024" },
    { id: "Punjabi", query: "Punjabi New Songs" },
    { id: "Haryanvi", query: "Haryanvi Hits" },
    { id: "Bhojpuri", query: "Bhojpuri New Songs" },
    { id: "90s", query: "90s Bollywood Hits" },
    { id: "Romantic", query: "Hindi Romantic Songs" },
    { id: "South", query: "South Indian Hits Tamil Telugu" },
    { id: "Lofi", query: "Hindi Lofi Chill" },
    { id: "Global", query: "Global Top Hits" },
    { id: "Party", query: "Bollywood Party Songs" },
    { id: "Devotional", query: "Hindi Bhakti Devotional" },
    { id: "Spotify", query: "" },
    { id: "History", query: "" },
    { id: "Liked", query: "" }
  ], []);
  
  const currentSong = useMusicStore(state => state.currentSong);
  const setCurrentSong = useMusicStore(state => state.setCurrentSong);
  const isPlaying = useMusicStore(state => state.isPlaying);
  const setIsPlaying = useMusicStore(state => state.setIsPlaying);
  const roomId = useMusicStore(state => state.roomId);
  const playbackHistory = useMusicStore(state => state.playbackHistory);
  const tabCache = useMusicStore(state => state.tabCache);
  const setTabCache = useMusicStore(state => state.setTabCache);
  const likedSongs = useMusicStore(state => state.likedSongs);
  const toggleLikeSong = useMusicStore(state => state.toggleLikeSong);
  const fetchLikedSongs = useMusicStore(state => state.fetchLikedSongs);
  const searchResults = useMusicStore(state => state.searchResults);
  const setSearchResults = useMusicStore(state => state.setSearchResults);
  const activeTab = useMusicStore(state => state.activeTab);
  const setActiveTab = useMusicStore(state => state.setActiveTab);
  const searchQuery = useMusicStore(state => state.searchQuery);
  const isSearchLoading = useMusicStore(state => state.isSearchLoading);
  const setSearchLoading = useMusicStore(state => state.setSearchLoading);
  const setActiveSection = useMusicStore(state => state.setActiveSection);
  const setSongToShare = useMusicStore(state => state.setSongToShare);
  const recentSearches = useMusicStore(state => state.recentSearches);
  const clearRecentSearches = useMusicStore(state => state.clearRecentSearches);
  const clearHistory = useMusicStore(state => state.clearHistory);
  const addToRecentSearches = useMusicStore(state => state.addToRecentSearches);

  const activeChatId = useChatStore(selectActiveChatId);
  const activeChat = useChatStore(state => state.activeChat);
  const user = useAuthStore(state => state.user);

  // ----------------------------------------------------------------
  // 1. Fetch liked songs on mount & handle Spotify callback
  // ----------------------------------------------------------------
  useEffect(() => {
    if (user?.id) {
      fetchLikedSongs(user.id);
    }
    const handleSpotifyAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('code')) {
        const token = await spotifyService.handleCallback();
        if (token) {
          setSpotifyToken(token);
          setActiveTab("Spotify");
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    };
    handleSpotifyAuth();
  }, [user?.id]);

  // ----------------------------------------------------------------
  // 2. Set default tab on mount (if not already active)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (defaultTab && activeTab !== defaultTab && !searchQuery) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, setActiveTab]);

  // ----------------------------------------------------------------
  // 3. Search handler (used for both tabs and manual search)
  // ----------------------------------------------------------------
  const handleSearch = useCallback(async (query, tabId = null, page = 1) => {
    const isTabRefresh = tabId && tabCache[tabId];
    
    if (page === 1 && !isTabRefresh) setSearchLoading(true);
    else if (page > 1) setMoreLoading(true);

    if (!tabId && page === 1) {
      addToRecentSearches(query);
    }

    try {
      const res = await fetch(`${MUSIC_API_BASE}/search?query=${encodeURIComponent(query)}&page=${page}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      
      const data = await res.json();
      if (data.status === 'success') {
        const results = data.data.results || [];
        
        if (page === 1) {
          let finalResults = results;
          // Shuffle Trending for discovery; always set hero songs for Trending
          if (tabId === "Trending") {
            finalResults = [...results].sort(() => Math.random() - 0.5);
            setHeroSongs(finalResults.slice(0, 10));
          } else {
            // For other tabs, clear hero songs (non‑Trending shouldn't show hero)
            setHeroSongs([]);
          }
          setSearchResults(finalResults);
          setCurrentPage(1);
          setHasMore(results.length > 10);
        } else {
          setSearchResults(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNewResults = results.filter(s => !existingIds.has(s.id));
            return [...prev, ...uniqueNewResults];
          });
          setCurrentPage(page);
          setHasMore(results.length > 0);
        }
        
        // Cache first page results for tab‑based queries
        if (tabId && page === 1) {
          setTabCache(tabId, results);
          if (tabId === "Trending") {
            // Update global background images for Trending
            useMusicStore.getState().setBackgroundImages(results);
          }
        }
      } else {
        if (page === 1) {
          setSearchResults([]);
          setHeroSongs([]);
        }
        setHasMore(false);
      }
    } catch (error) {
      console.error("Search error:", error);
      if (page === 1 && !isTabRefresh) {
        setSearchResults([]);
        setHeroSongs([]);
      }
    } finally {
      setSearchLoading(false);
      setMoreLoading(false);
    }
  }, [setSearchLoading, setSearchResults, setTabCache, addToRecentSearches, tabCache]);

  // 4. Unified effect for tab switching and data synchronisation
  useEffect(() => {
    // If user is actively searching, handleSearch (via debounce) will take over
    if (searchQuery && searchQuery.trim().length > 0) {
      return;
    }

    if (activeTab === "History") {
      setSearchResults(playbackHistory);
      setHeroSongs([]);
      return;
    }

    if (activeTab === "Liked") {
      setSearchResults(likedSongs);
      setHeroSongs([]);
      return;
    }

    if (activeTab === "Spotify") {
      if (spotifyToken) {
        handleFetchSpotifyTracks();
      } else {
        setSearchResults([]);
        setHeroSongs([]);
      }
      return;
    }

    // Normal music tabs: Show cache for speed, but always fetch fresh in background
    const cachedResults = tabCache[activeTab];
    if (cachedResults) {
      if (activeTab === "Trending") {
        setHeroSongs(cachedResults.slice(0, 12));
      } else {
        setHeroSongs([]);
      }
      setSearchResults(cachedResults);
    }
    
    // Always trigger a fresh search for the current tab in the background
    const tab = tabs.find(t => t.id === activeTab);
    if (tab && tab.query) {
      handleSearch(tab.query, activeTab);
    }
  }, [
    activeTab,
    searchQuery,
    playbackHistory,
    likedSongs,
    spotifyToken,
    tabCache,
    tabs,
    handleSearch,
    setSearchResults,
  ]);

  // 5. Debounced Search Effect
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // ----------------------------------------------------------------
  // 6. Spotify helpers
  // ----------------------------------------------------------------
  const handleFetchSpotifyTracks = async () => {
    if (!spotifyToken) return;
    setIsSpotifyLoading(true);
    try {
      const tracks = await spotifyService.getLikedTracks(spotifyToken);
      setSpotifyTracks(tracks);
      setSearchResults(tracks); // temporarily show them in the list
    } catch (err) {
      toast.error("Failed to fetch Spotify tracks");
    } finally {
      setIsSpotifyLoading(false);
    }
  };

  const handleImportSpotifyTracks = async () => {
    if (spotifyTracks.length === 0) return;
    
    setImportProgress({ current: 0, total: spotifyTracks.length });
    let importedCount = 0;

    toast.promise(
      (async () => {
        for (let i = 0; i < spotifyTracks.length; i++) {
          const track = spotifyTracks[i];
          setImportProgress(prev => ({ ...prev, current: i + 1 }));

          try {
            const res = await fetch(`${MUSIC_API_BASE}/search?query=${encodeURIComponent(`${track.title} ${track.artist}`)}&page=1`);
            const data = await res.json();

            if (data.status === 'success' && data.data.results?.length > 0) {
              const matchedSong = data.data.results[0];
              const alreadyLiked = likedSongs.some(ls => ls.id === matchedSong.id);
              if (!alreadyLiked) {
                await toggleLikeSong(matchedSong, user?.id);
                importedCount++;
              }
            }
          } catch (e) {
            console.error(`Import failed for ${track.title}:`, e);
          }
        }
        setImportProgress({ current: 0, total: 0 });
        return importedCount;
      })(),
      {
        loading: 'Matching and importing songs...',
        success: (count) => `Successfully imported ${count} new songs!`,
        error: 'Import process encountered issues.',
      }
    );
  };

  // ----------------------------------------------------------------
  // 6. Load more (pagination)
  // ----------------------------------------------------------------
  const handleLoadMore = () => {
    const query = searchQuery || tabs.find(t => t.id === activeTab)?.query;
    if (query && hasMore && !isMoreLoading) {
      handleSearch(query, null, currentPage + 1);
    }
  };

  // ----------------------------------------------------------------
  // 7. Core actions – play, toggle, like, invite
  // ----------------------------------------------------------------
  const selectSong = useCallback(async (song) => {
    setLoadingSongId(song.id);
    try {
      const enriched = await enrichSongDetail(song);
      const mediaUrl = enriched.media_urls?.['320_KBPS'] ||
                       enriched.media_urls?.['160_KBPS'] ||
                       enriched.media_url;

      if (!mediaUrl) {
        toast.error("Could not get play link");
        return;
      }

      const finalSong = {
        id: enriched.id,
        title: enriched.title || enriched.name || "Unknown Track",
        artist: enriched.singers || enriched.primary_artists || enriched.artist || "Unknown Artist",
        image: enriched.image || (enriched.images?.['500x500'] || enriched.images?.['150x150']),
        media_url: mediaUrl,
        duration: enriched.duration || 0
      };

      setCurrentSong(finalSong);
      setIsPlaying(true);
    } catch (err) {
      console.error("[selectSong] error", err);
      toast.error("Failed to play song");
    } finally {
      setLoadingSongId(null);
    }
  }, [setCurrentSong, setIsPlaying]);

  const togglePlayback = useCallback((e, song) => {
    e.stopPropagation();
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
    } else {
      selectSong(song);
    }
  }, [currentSong?.id, isPlaying, setIsPlaying, selectSong]);

  const handleInvite = async (song) => {
    // Enrich song data for better metadata (image, etc.)
    const enriched = await enrichSongDetail(song);
    const imgObj = enriched.images || {};
    const bestImage = imgObj['500x500'] || imgObj['150x150'] || enriched.image || '';
    const mediaUrl = enriched.media_urls?.['320_KBPS'] ||
                     enriched.media_urls?.['160_KBPS'] ||
                     enriched.media_url || '';

    const finalSong = {
      id: enriched.id,
      title: enriched.title || enriched.name,
      artist: enriched.more_info?.singers || enriched.artist || enriched.subtitle,
      image: bestImage,
      media_url: mediaUrl
    };

    setSongToShare(finalSong);
    setActiveSection('share');
  };

  // ----------------------------------------------------------------
  // 8. Render helpers – clean if/else structure
  // ----------------------------------------------------------------
  const renderContent = () => {
    // Shimmer during a search
    if (isSearchLoading) {
      return (
        <div className="shimmer-container">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="shimmer-song-item">
              <div className="shimmer-art" />
              <div className="shimmer-details">
                <div className="shimmer-line title" />
                <div className="shimmer-line artist" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Spotify tab: not connected / loading / importing
    if (activeTab === "Spotify") {
      if (isSpotifyLoading) {
        return (
          <div className="shimmer-container">
            {[1, 2, 3].map(i => (
              <div key={i} className="shimmer-song-item">
                <div className="shimmer-art" />
                <div className="shimmer-details">
                  <div className="shimmer-line title" />
                  <div className="shimmer-line artist" />
                </div>
              </div>
            ))}
          </div>
        );
      }

      if (!spotifyToken) {
        return (
          <div className="spotify-tab-container">
            <div className="spotify-login-prompt">
              <div className="spotify-icon-big">
                <Music size={48} color="#1DB954" />
              </div>
              <h3>Connect to Spotify</h3>
              <p>Import your liked songs and playlists from Spotify to Elevengram.</p>
              <button className="spotify-connect-btn" onClick={spotifyService.login}>
                Login with Spotify
              </button>
            </div>
          </div>
        );
      }

      return (
        <>
          <div className="spotify-tab-container">
            <div className="spotify-import-header">
              <div className="spotify-info">
                <span className="spotify-status">Connected to Spotify</span>
                <span className="spotify-track-count">{spotifyTracks.length} liked songs found</span>
              </div>
              <button 
                className="spotify-import-all-btn" 
                onClick={handleImportSpotifyTracks}
                disabled={importProgress.total > 0}
              >
                <CloudDownload size={18} />
                {importProgress.total > 0 
                  ? `Importing (${importProgress.current}/${importProgress.total})` 
                  : "Import All to Liked"}
              </button>
            </div>
          </div>
          {/* Spotify tracks list rendered using normal results */}
          {searchResults.length > 0 ? (
            <>
              <div className="section-header-title">Your Spotify Likes</div>
              {searchResults.map((song, index) => (
                <SongItem 
                  key={song.id || index} 
                  song={song} 
                  index={index} 
                  onSelect={selectSong} 
                  onInvite={handleInvite}
                  onToggle={togglePlayback}
                  onLike={(s) => toggleLikeSong(s, user?.id)}
                  onShowOptions={(e, s) => setContextMenu({ song: s })}
                  isLiked={likedSongs.some(ls => ls.id === song.id)}
                  currentSongId={currentSong?.id}
                  isPlaying={isPlaying}
                  isLoadingDetails={loadingSongId === song.id}
                />
              ))}
            </>
          ) : (
            <div className="search-empty-state">
              <div className="empty-icon-circle"><Music size={32} /></div>
              <h3>No Spotify tracks</h3>
              <p>Login and fetch your liked songs.</p>
            </div>
          )}
        </>
      );
    }

    // History / Liked / normal results
    if (searchResults.length > 0) {
      return (
        <>
          {activeTab === "History" && playbackHistory.length > 0 && !searchQuery && (
            <div className="history-header">
              <span className="history-count">{playbackHistory.length} recently played</span>
              <button className="clear-history-btn" onClick={clearHistory}>Clear All</button>
            </div>
          )}
          <div className="section-header-title">
            {searchQuery ? `Results for "${searchQuery}"` : (activeTab === "Trending" ? "Trending Now" : "Top Results")}
          </div>
          {searchResults.map((song, index) => (
            <SongItem 
              key={song.id || index} 
              song={song} 
              index={index} 
              onSelect={selectSong} 
              onInvite={handleInvite}
              onToggle={togglePlayback}
              onLike={(s) => toggleLikeSong(s, user?.id)}
              onShowOptions={(e, s) => setContextMenu({ song: s })}
              isLiked={likedSongs.some(ls => ls.id === song.id)}
              currentSongId={currentSong?.id}
              isPlaying={isPlaying}
              isLoadingDetails={loadingSongId === song.id}
            />
          ))}
          {hasMore && (
            <button 
              className="load-more-btn" 
              onClick={handleLoadMore}
              disabled={isMoreLoading}
            >
              {isMoreLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "Load More Results"
              )}
            </button>
          )}
        </>
      );
    }

    // Default empty state
    return (
      <div className="search-empty-state">
        <div className="empty-icon-circle">
          <Music size={32} />
        </div>
        <h3>{searchQuery ? "No tracks found" : "Discover Music"}</h3>
        <p>{searchQuery ? "Try different keywords" : "Search for millions of songs"}</p>
      </div>
    );
  };

  // ----------------------------------------------------------------
  // Main render
  return (
    <div className="music-search-container">
      {!hideHeader && (
        <div className="search-header">
          {!searchQuery && <MusicHero songs={heroSongs} onPlay={selectSong} />}

          <div className="sticky-search-wrapper">
            <div className="brand-header">
              <div className="brand-dot" />
              <span className="brand-name">ELEVENgram Music</span>
            </div>
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                placeholder="Search songs, artists..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              />
              {isSearchLoading && <Loader2 className="loading-spinner-icon animate-spin" size={18} />}
              {searchQuery && (
                <X 
                  size={18} 
                  className="search-clear-icon" 
                  onClick={() => setSearchQuery("")} 
                />
              )}
            </div>

            {searchQuery && recentSearches.length > 0 ? (
              <div className="recent-searches-quick">
                <div className="recent-header">
                  <span>Recent</span>
                  <button onClick={clearRecentSearches}>Clear</button>
                </div>
                <div className="recent-chips">
                  {recentSearches.slice(0, 5).map(q => (
                    <button key={q} onClick={() => setSearchQuery(q)}>{q}</button>
                  ))}
                </div>
              </div>
            ) : !searchQuery && (
              <div className="category-tabs-container">
                {tabs.map(tab => (
                  <button 
                    key={tab.id}
                    className={`category-tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSearchQuery("");
                    }}
                  >
                    {tab.id}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="search-results-list">
        {renderContent()}
      </div>

      {/* Context Menu Modal */}
      <AnimatePresence>
        {contextMenu && (
          <SongContextMenu 
            song={contextMenu.song} 
            onClose={() => setContextMenu(null)}
            onPlay={() => {
              selectSong(contextMenu.song);
              setContextMenu(null);
            }}
            onInvite={() => {
              handleInvite(contextMenu.song);
              setContextMenu(null);
            }}
            onLike={() => {
              toggleLikeSong(contextMenu.song, user?.id);
              setContextMenu(null);
            }}
            isLiked={likedSongs.some(ls => ls.id === contextMenu.song.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

MusicHero.displayName = 'MusicHero';
SongItem.displayName = 'SongItem';
SongContextMenu.displayName = 'SongContextMenu';

export default MusicSearch;