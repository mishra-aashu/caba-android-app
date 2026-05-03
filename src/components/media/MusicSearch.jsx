import React, { useState, useEffect, memo } from 'react';

import useMusicStore from '../../store/useMusicStore';
import { MUSIC_API_URL } from '../../config/musicConfig';

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
  const [loadingSongId, setLoadingSongId] = useState(null); // Track which song is fetching details
  
  const { currentSong, setCurrentSong, setIsPlaying, roomId, isHost } = useMusicStore();

  const activeChatId = useChatStore(selectActiveChatId);
  const activeChat = useChatStore(state => state.activeChat);
  const user = useAuthStore(state => state.user);


  useEffect(() => {
    // Fetch random trending category on mount
    if (searchResults.length === 0 && !searchQuery) {
      const categories = [
        "Bollywood Trending", "Top Hindi Songs", "Latest Punjabi Hits", 
        "Lofi Beats Hindi", "Arijit Singh Radio", "Top Global 2026",
        "Romantic Melodies", "Party Anthems", "Indian Indie Hits"
      ];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      handleSearch(randomCategory);
    }
  }, []);

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    
    setSearchLoading(true);
    try {
      const res = await fetch(`${MUSIC_API_URL}/api/search?query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("[MusicSearch] Expected JSON but got:", text.substring(0, 50));
        throw new Error("Server returned an invalid response (not JSON). Please use 'npm run dev:vercel' for local API support.");
      }

      const data = await res.json();
      
      const results = data.data?.results || data.results || [];
      setSearchResults(results);

    } catch (err) {
      console.error("Music search failed:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounced search could be added here, but manual Enter/Search button is fine for now
  
  const selectSong = async (song) => {
    let songData = song;
    const cacheBust = `_t=${Date.now()}`;

    setLoadingSongId(song.id);
    try {
      // 1. Fetch fresh details (Try direct API then proxy)
      let res = null;
      if (song.api_url?.song) {
        const directUrl = `${song.api_url.song}&${cacheBust}`;
        res = await fetch(directUrl, { cache: 'no-store' }).catch(() => null);
      }

      if (!res || !res.ok) {
        const proxyUrl = `${MUSIC_API_URL}/api/song?id=${song.id}&${cacheBust}`;
        res = await fetch(proxyUrl, { cache: 'no-store' });
      }

      if (res.ok) {
        const json = await res.json();
        const details = (json.data?.[0] || json.results?.[0] || json?.[0]) ??
                       (json.media_urls || json.media_url ? json : null);
        if (details) songData = details;
      }
    } catch (err) {
      console.warn("[MusicSearch] Detail fetch failed:", err);
    } finally {
      setLoadingSongId(null);
    }

    // 2. Comprehensive URL Extraction (Priority: 320kbps > 160kbps > any)
    const urls = songData.media_urls || songData.download_url || songData.downloadUrl || {};
    let finalMediaUrl = songData.media_url || "";

    if (typeof urls === 'object' && !Array.isArray(urls)) {
      finalMediaUrl = urls['320kbps'] || urls['320_KBPS'] || 
                      urls['160kbps'] || urls['160_KBPS'] || 
                      urls['96kbps'] || Object.values(urls)[0] || finalMediaUrl;
    } else if (Array.isArray(urls) && urls.length > 0) {
      const best = urls.find(u => u.quality === '320kbps') || 
                   urls.find(u => u.quality === '160kbps') || 
                   urls[urls.length - 1];
      finalMediaUrl = best?.link || best?.url || finalMediaUrl;
    }

    // Fallback to preview if no full link (Better than nothing)
    if (!finalMediaUrl || finalMediaUrl.includes('preview')) {
      finalMediaUrl = songData.more_info?.vlink || songData.vlink || songData.preview_url || finalMediaUrl;
    }

    // 3. Map final metadata
    const finalSong = {
      id: song.id,
      title: songData.song || songData.title || song.title || "Unknown Track",
      artist: songData.singers || songData.primary_artists || songData.artist || song.artist || "Unknown Artist",
      image: songData.image || (songData.images?.['500x500'] || songData.images?.['150x150']) || song.image,
      media_url: finalMediaUrl,
      duration: songData.duration || 0
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
    if (!song.downloadUrl && !song.media_urls) {
      try {
        const res = await fetch(`${MUSIC_API_URL}/api/song?id=${song.id}`);
        const json = await res.json();
        const details = json.data?.[0] || json.results?.[0] || json?.[0];
        if (details) songData = details;
      } catch (e) { console.warn("Detail fetch failed for share", e); }
    }

    // Robust meta extraction
    const imgObj = songData.images || {};
    const imgArr = songData.image || [];
    let bestImage = imgObj['500x500'] || imgObj['150x150'] || '';
    if (!bestImage) {
      bestImage = Array.isArray(imgArr) ? (imgArr[imgArr.length - 1]?.url || '') : imgArr;
    }
    
    const downloads = songData.downloadUrl || songData.media_urls || songData.download_url || [];
    let mediaUrl = '';
    if (Array.isArray(downloads)) {
      const best = downloads.find(d => d.quality === '320kbps') || downloads[downloads.length - 1];
      mediaUrl = best?.url || best?.link || '';
    } else {
      mediaUrl = downloads;
    }

    if (!mediaUrl) mediaUrl = songData.more_info?.vlink || '';

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
            placeholder="Songs, Artists, Albums..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
          />
          {isSearchLoading && <Loader2 className="loading-spinner-icon animate-spin" size={18} />}
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
  const imgObj = song.images || {};
  const imgArr = song.image || [];
  const thumbnail = imgObj['150x150'] || imgObj['50x50'] || 
                   (Array.isArray(imgArr) ? (imgArr[1]?.url || imgArr[1]?.link || imgArr[0]?.url || '') : imgArr);

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
        <p className="song-artist-text" dangerouslySetInnerHTML={{ __html: song.artist || song.subtitle || song.primaryArtists }} />
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

