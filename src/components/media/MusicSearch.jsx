import React, { useState, useEffect, memo, useRef, useMemo } from 'react';

import useMusicStore from '../../store/useMusicStore';
import { MUSIC_API_URL, MUSIC_API_BASE } from '../../config/musicConfig';

import useChatStore, { selectActiveChatId } from '../../store/useChatStore';
import useAuthStore from '../../store/authStore';
import { db } from '../../db/db';
import { frontendToDb } from '../../utils/dbFieldMapping';
import { queueAction, QUEUE_ACTIONS } from '../../services/offlineQueue';
import { 
  Search, Play, Pause, Users, Music, Loader2, Send, Heart, 
  MoreVertical, List, User, Disc, CloudDownload
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { spotifyService } from '../../services/spotifyService';
import './MusicSearch.css';


/**
 * MusicSearch Component
 * Provides a premium interface for searching music via the JioSaavn Media Engine.
 */
const MusicSearch = () => {
  const [contextMenu, setContextMenu] = useState(null); // { song, x, y }
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchLoading, setSearchLoading] = useState(false);
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
    { id: "Trending", query: "Bollywood Trending" },
    { id: "Hindi", query: "Top Hindi Songs" },
    { id: "Punjabi", query: "Latest Punjabi Hits" },
    { id: "Haryanvi", query: "Latest Haryanvi Songs" },
    { id: "Lofi", query: "Lofi Beats Hindi" },
    { id: "Global", query: "Top Global Hits" },
    { id: "Party", query: "Party Anthems" },
    { id: "Spotify", query: "" },
    { id: "History", query: "" },
    { id: "Liked", query: "" }
  ], []);
  
  const { 
    currentSong, setCurrentSong, isPlaying, setIsPlaying, roomId, isHost, 
    playbackHistory, clearHistory, tabCache, setTabCache,
    likedSongs, toggleLikeSong, fetchLikedSongs,
    searchResults, setSearchResults, recommendations,
    activeTab, setActiveTab
  } = useMusicStore();

  const activeChatId = useChatStore(selectActiveChatId);
  const activeChat = useChatStore(state => state.activeChat);
  const user = useAuthStore(state => state.user);


  useEffect(() => {
    if (user?.id) {
      fetchLikedSongs(user.id);
    }

    // Check for Spotify callback (PKCE)
    const handleSpotifyAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('code')) {
        const token = await spotifyService.handleCallback();
        if (token) {
          setSpotifyToken(token);
          setActiveTab("Spotify");
          // Remove code from URL for cleanliness
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    };

    handleSpotifyAuth();
  }, [user?.id]);

  useEffect(() => {
    // 1. Handle History/Liked separately
    if (activeTab === "History") {
      setSearchResults(playbackHistory);
      return;
    }
    
    if (activeTab === "Liked") {
      setSearchResults(likedSongs);
      return;
    }

    if (activeTab === "Spotify") {
      if (spotifyToken) {
        handleFetchSpotifyTracks();
      } else {
        setSearchResults([]);
      }
      return;
    }

    // 2. Check Cache
    if (tabCache[activeTab] && !searchQuery) {
      const cachedResults = tabCache[activeTab];
      setSearchResults(cachedResults);
      
      // Also populate Hero if it's Trending
      if (activeTab === "Trending") {
        const shuffled = [...cachedResults].sort(() => Math.random() - 0.5);
        setHeroSongs(shuffled.slice(0, 10));
      }
      return;
    }

    // 3. Fetch if not cached
    const tab = tabs.find(t => t.id === activeTab);
    if (tab && !searchQuery) {
      handleSearch(tab.query, activeTab);
    }
  }, [activeTab, playbackHistory, likedSongs]); // We don't include tabCache here to avoid re-fetch loops if cache updates

  useEffect(() => {
    // If user starts searching, maybe switch to a search mode or just clear results if query empty
    if (!searchQuery) {
      const tab = tabs.find(t => t.id === activeTab);
      if (tab) handleSearch(tab.query);
    }
  }, [searchQuery]);

  const handleSearch = async (query, tabId = null, page = 1) => {
    if (!query.trim()) return;
    
    if (page === 1) setSearchLoading(true);
    else setMoreLoading(true);

    try {
      const res = await fetch(`${MUSIC_API_BASE}/search?query=${encodeURIComponent(query)}&page=${page}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      
      const data = await res.json();
      if (data.status === 'success') {
        const results = data.data.results || [];
        
        if (page === 1) {
          setSearchResults(results);
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
        
        // Populate Hero with random Trending songs (only on first page)
        if (tabId === "Trending" && page === 1) {
          const shuffled = [...results].sort(() => Math.random() - 0.5);
          setHeroSongs(shuffled.slice(0, 10));
        }

        // Save to cache if it's a tab-initiated search (only first page for cache)
        if (tabId && page === 1) {
          setTabCache(tabId, results);
          // Sync with global background if it's Trending
          if (tabId === "Trending") {
            useMusicStore.getState().setBackgroundImages(results);
          }
        }
      } else {
        if (page === 1) setSearchResults([]);
        setHasMore(false);
      }
    } finally {
      setSearchLoading(false);
      setMoreLoading(false);
    }
  };

  const handleFetchSpotifyTracks = async () => {
    if (!spotifyToken) return;
    setIsSpotifyLoading(true);
    try {
      const tracks = await spotifyService.getLikedTracks(spotifyToken);
      setSpotifyTracks(tracks);
      setSearchResults(tracks); // Temporarily show spotify tracks in search results
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
            // 1. Search for track on JioSaavn
            const res = await fetch(`${MUSIC_API_BASE}/search?query=${encodeURIComponent(`${track.title} ${track.artist}`)}&page=1`);
            const data = await res.json();

            if (data.status === 'success' && data.data.results?.length > 0) {
              const matchedSong = data.data.results[0];
              
              // 2. Check if already liked
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

  const handleLoadMore = () => {
    const query = searchQuery || tabs.find(t => t.id === activeTab)?.query;
    if (query && hasMore && !isMoreLoading) {
      handleSearch(query, null, currentPage + 1);
    }
  };

  // Debounced search could be added here, but manual Enter/Search button is fine for now
  
  const selectSong = async (song) => {
    // 1. Check if we already have the media URL (New API provides it in results)
    let finalMediaUrl = song.media_urls?.['320_KBPS'] || song.media_urls?.['160_KBPS'] || song.media_url;

    if (!finalMediaUrl) {
      setLoadingSongId(song.id);
      try {
        const res = await fetch(`${MUSIC_API_BASE}/song?id=${song.id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success' && json.data) {
            finalMediaUrl = json.data.media_urls?.['320_KBPS'] || json.data.media_urls?.['160_KBPS'] || json.data.media_url;
          }
        }
      } catch (err) {
        console.warn("[MusicSearch] Detail fetch failed:", err);
      } finally {
        setLoadingSongId(null);
      }
    }

    if (!finalMediaUrl) {
      toast.error("Could not get play link");
      return;
    }

    // 2. Map final metadata
    const finalSong = {
      id: song.id,
      title: song.title || song.name || "Unknown Track",
      artist: song.singers || song.primary_artists || song.artist || "Unknown Artist",
      image: song.image || (song.images?.['500x500'] || song.images?.['150x150']),
      media_url: finalMediaUrl,
      duration: song.duration || 0
    };

    console.log(`[MusicEngine] Playing: ${finalSong.title}`, finalSong.media_url);
    
    setCurrentSong(finalSong);
    setIsPlaying(true);
  };



  const handleInvite = async (song) => {
    if (!activeChatId || !user) {
      toast.error("Open a chat to share music", {
        icon: '💬',
        style: { borderRadius: '12px', background: '#333', color: '#fff' }
      });
      return;
    }

    let songData = song;

    // Fetch details if missing (for sharing high-quality links)
    if (!songData.media_urls && !songData.media_url) {
      try {
        const res = await fetch(`${MUSIC_API_BASE}/song?id=${song.id}`);
        const json = await res.json();
        if (json.status === 'success' && json.data) songData = json.data;
      } catch (e) { console.warn("Detail fetch failed for share", e); }
    }

    // Robust meta extraction
    const imgObj = songData.images || {};
    const imgArr = songData.image || [];
    let bestImage = imgObj['500x500'] || imgObj['150x150'] || '';
    if (!bestImage) {
      bestImage = Array.isArray(imgArr) ? (imgArr[imgArr.length - 1]?.url || '') : imgArr;
    }
    
    const mediaUrl = songData.media_urls?.['320_KBPS'] || songData.media_urls?.['160_KBPS'] || songData.media_url || '';

    const finalSong = {
      id: songData.id,
      title: songData.title || songData.name,
      artist: songData.more_info?.singers || songData.artist || songData.subtitle || songData.primaryArtists,
      image: bestImage,
      media_url: mediaUrl
    };



    const tempId = String(Date.now());
    const taskId = crypto.randomUUID();

    const frontendMsg = {
      chatId: activeChatId,
      senderId: user.id,
      receiverId: activeChat.isGroup ? user.id : activeChat.otherUserId,
      content: `Shared a song: ${songData.title}`,
      metadata: {
        song: finalSong,
        type: 'music_share',
        roomId: roomId
      },
      isGroupMessage: Boolean(activeChat.isGroup),
      messageType: 'song',
      createdAt: new Date().toISOString(),
      status: 'sending',
      tempId,
    };

    try {
      await db.transaction('rw', [db.messages, db.chats_list], async () => {
        await db.messages.put({ ...frontendMsg, id: `temp_${tempId}` });
        await db.chats_list.update(String(activeChatId), {
          lastMessageAt: frontendMsg.createdAt,
          timestamp: frontendMsg.createdAt,
          lastMessage: `🎵 ${songData.title}`,
          status: 'sending'
        }).catch(() => {});
      });

      const dbData = frontendToDb(frontendMsg);
      await queueAction(QUEUE_ACTIONS.INSERT_MESSAGE, 'messages', dbData, { taskId });
      
      toast.success("Shared to chat!");
    } catch (error) {
      console.error("Music share failed:", error);
      toast.error("Failed to share");
    }
  };

  const togglePlayback = (e, song) => {
    e.stopPropagation();
    
    if (roomId && !isHost) {
      toast.error("Only Host can control playback", { id: 'host-only-warn' });
      return;
    }

    const isCurrent = currentSong?.id === song.id;
    if (isCurrent) {
      useMusicStore.getState().setIsPlaying(!useMusicStore.getState().isPlaying);
    } else {
      selectSong(song);
      useMusicStore.getState().setIsPlaying(true);
    }
  };


  return (
    <div className="music-search-container">


      <div className="search-header">
        <MusicHero songs={heroSongs} onPlay={selectSong} />

        <div className="sticky-search-wrapper">
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
          </div>

          <div className="category-tabs-container">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                className={`category-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery(""); // Clear search when switching tabs
                }}
              >
                {tab.id}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="search-results-list">
        {activeTab === "Spotify" && (
          <div className="spotify-tab-container">
            {!spotifyToken ? (
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
            ) : (
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
            )}
          </div>
        )}

        {isSpotifyLoading && (
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
        )}

        {activeTab === "History" && playbackHistory.length > 0 && (
          <div className="history-header">
            <span className="history-count">{playbackHistory.length} recently played</span>
            <button className="clear-history-btn" onClick={clearHistory}>Clear All</button>
          </div>
        )}

        {isSearchLoading ? (
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
        ) : searchResults.length > 0 ? (
          <>
            <div className="section-header-title">Top Results</div>
            {searchResults.map((song, index) => (
              <SongItem 
                key={song.id || index} 
                song={song} 
                index={index} 
                onSelect={(s) => {
                  if (roomId && !isHost) {
                    toast.error("Only Host can change songs", { id: 'host-only-warn' });
                    return;
                  }
                  selectSong(s);
                }} 
                onInvite={handleInvite}
                onToggle={togglePlayback}
                onLike={(s) => toggleLikeSong(s, user?.id)}
                onShowOptions={(e, s) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setContextMenu({ song: s, x: rect.left - 180, y: rect.top });
                }}
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
        ) : (
          <div className="search-empty-state">
            <div className="empty-icon-circle">
              <Music size={32} />
            </div>
            <h3>{searchQuery ? "No tracks found" : "Discover Music"}</h3>
            <p>{searchQuery ? "Try different keywords" : "Search for millions of songs"}</p>
          </div>
        )}
      </div>

      {/* Context Menu Modal */}
      {contextMenu && (
        <SongContextMenu 
          song={contextMenu.song} 
          x={contextMenu.x} 
          y={contextMenu.y} 
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
    </div>
  );
};

/**
 * Memoized Song Item
 * Prevents heavy list re-renders.
 */
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
        <h4 className="song-title-text" dangerouslySetInnerHTML={{ __html: song.title || song.name }} />
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


SongItem.displayName = 'SongItem';

/**
 * MusicHero Component
 * Provides a smooth, parallax-style sliding gallery of songs.
 */
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
    }, 500); // 500ms delay to allow page transition to finish

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
    
    // Bounds check
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

/**
 * SongContextMenu Component
 * A Spotify-style context menu for song actions.
 */
const SongContextMenu = ({ song, x, y, onClose, onPlay, onInvite, onLike, isLiked }) => {
  useEffect(() => {
    const handleGlobalClick = () => onClose();
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [onClose]);

  return (
    <div 
      className="song-context-menu"
      style={{ top: `${y}px`, left: `${x}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="menu-header">
        <img src={song.image || song.images?.['50x50']} alt="" />
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
    </div>
  );
};

MusicHero.displayName = 'MusicHero';

export default MusicSearch;

