import React, { useState, useEffect, memo } from 'react';

import useMusicStore from '../../store/useMusicStore';
import { MUSIC_API_URL, MUSIC_API_BASE } from '../../config/musicConfig';

import useChatStore, { selectActiveChatId } from '../../store/useChatStore';
import useAuthStore from '../../store/authStore';
import { db } from '../../db/db';
import { frontendToDb } from '../../utils/dbFieldMapping';
import { queueAction, QUEUE_ACTIONS } from '../../services/offlineQueue';
import { Search, Play, Pause, Users, Music, Loader2, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './MusicSearch.css';


/**
 * MusicSearch Component
 * Provides a premium interface for searching music via the JioSaavn Media Engine.
 */
const MusicSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchLoading, setSearchLoading] = useState(false);
  const [loadingSongId, setLoadingSongId] = useState(null);
  const [activeTab, setActiveTab] = useState("Trending");

  const tabs = [
    { id: "Trending", query: "Bollywood Trending" },
    { id: "Hindi", query: "Top Hindi Songs" },
    { id: "Punjabi", query: "Latest Punjabi Hits" },
    { id: "Haryanvi", query: "Latest Haryanvi Songs" },
    { id: "Lofi", query: "Lofi Beats Hindi" },
    { id: "Global", query: "Top Global Hits" },
    { id: "Party", query: "Party Anthems" }
  ];
  
  const { currentSong, setCurrentSong, setIsPlaying, roomId, isHost } = useMusicStore();

  const activeChatId = useChatStore(selectActiveChatId);
  const activeChat = useChatStore(state => state.activeChat);
  const user = useAuthStore(state => state.user);


  useEffect(() => {
    // Fetch based on active tab
    const tab = tabs.find(t => t.id === activeTab);
    if (tab && !searchQuery) {
      handleSearch(tab.query);
    }
  }, [activeTab]);

  useEffect(() => {
    // If user starts searching, maybe switch to a search mode or just clear results if query empty
    if (!searchQuery) {
      const tab = tabs.find(t => t.id === activeTab);
      if (tab) handleSearch(tab.query);
    }
  }, [searchQuery]);

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    
    setSearchLoading(true);
    try {
      const res = await fetch(`${MUSIC_API_BASE}/search?query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      
      const data = await res.json();
      if (data.status === 'success') {
        setSearchResults(data.data.results || []);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Music search failed:", err);
      toast.error("Search failed. Check your connection.");
    } finally {
      setSearchLoading(false);
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

      <div className="search-results-list">
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
          searchResults.map((song, index) => (
            <SongItem 
              key={song.id} 
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
              currentSongId={currentSong?.id}
              isPlaying={useMusicStore.getState().isPlaying}
              isLoadingDetails={loadingSongId === song.id}
            />
          ))

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
    </div>
  );
};

/**
 * Memoized Song Item
 * Prevents heavy list re-renders.
 */
const SongItem = memo(({ song, index, onSelect, onInvite, onToggle, currentSongId, isPlaying, isLoadingDetails }) => {
  const thumbnail = song.image || (song.images?.['150x150']) || '';
  const isCurrent = currentSongId === song.id;

  return (
    <div 
      className={`song-item ${isCurrent ? 'active' : ''} ${isLoadingDetails ? 'loading-details' : ''}`}
      onClick={() => !isLoadingDetails && onSelect(song)}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
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
          className="invite-btn" 
          onClick={() => onInvite(song)}
          title="Share to Chat"
        >
          <Users size={18} />
        </button>
      </div>
    </div>
  );
});


SongItem.displayName = 'SongItem';

export default MusicSearch;

