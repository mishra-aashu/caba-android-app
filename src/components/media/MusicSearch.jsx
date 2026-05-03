import React, { useState, useEffect, memo } from 'react';

import useMusicStore from '../../store/useMusicStore';

import useChatStore, { selectActiveChatId } from '../../store/useChatStore';
import useAuthStore from '../../store/authStore';
import { db } from '../../db/db';
import { frontendToDb } from '../../utils/dbFieldMapping';
import { queueAction, QUEUE_ACTIONS } from '../../services/offlineQueue';
import { Search, Play, Users, Music, Loader2, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './MusicSearch.css';


/**
 * MusicSearch Component
 * Provides a premium interface for searching music via the JioSaavn Media Engine.
 */
const MusicSearch = () => {
  const { 
    searchQuery, setSearchQuery, 
    searchResults, setSearchResults, 
    isSearchLoading, setSearchLoading,
    setCurrentSong
  } = useMusicStore();

  const activeChatId = useChatStore(selectActiveChatId);
  const activeChat = useChatStore(state => state.activeChat);
  const user = useAuthStore(state => state.user);


  const handleSearch = async (query) => {
    if (!query.trim()) return;
    
    setSearchLoading(true);
    try {
      const res = await fetch(`https://listen-together-steel.vercel.app/api/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      // Structure: { status: 'success', data: { results: [...] } }
      // Structure: can be { data: { results: [] } } OR { results: [] }
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

    // 1. Check if we have high-quality download links. If not, fetch full details.
    if (!song.downloadUrl && !song.media_urls && !song.download_url) {
      setSearchLoading(true);
      try {
        const res = await fetch(`https://listen-together-steel.vercel.app/api/songs?id=${song.id}`);
        const json = await res.json();
        // Handle { status: true, data: [...] } or { status: true, results: [...] }
        const details = json.data?.[0] || json.results?.[0] || json?.[0];
        if (details) songData = details;
      } catch (err) {
        console.error("Failed to fetch full song details:", err);
      } finally {
        setSearchLoading(false);
      }
    }

    // 2. Extract media URL (320kbps > 160kbps > any)
    const downloads = songData.downloadUrl || songData.media_urls || songData.download_url || [];
    let mediaUrl = '';
    if (Array.isArray(downloads)) {
      const highQuality = downloads.find(u => u.quality === '320kbps' || u.bitrate === '320') || 
                          downloads.find(u => u.quality === '160kbps' || u.bitrate === '160') ||
                          downloads[downloads.length - 1];
      mediaUrl = highQuality?.url || highQuality?.link || '';
    } else {
      mediaUrl = downloads; // String fallback
    }

    // Fallback to preview vlink if still nothing (better than silence)
    if (!mediaUrl && songData.more_info?.vlink) {
      mediaUrl = songData.more_info.vlink;
    }

    // 3. Extract best image (500x500 > 150x150 > string)
    const imgObj = songData.images || {};
    const imgArr = songData.image || [];
    let bestImage = '';
    
    if (imgObj['500x500']) bestImage = imgObj['500x500'];
    else if (imgObj['150x150']) bestImage = imgObj['150x150'];
    else if (Array.isArray(imgArr)) bestImage = imgArr[imgArr.length - 1]?.url || imgArr[imgArr.length - 1]?.link || '';
    else bestImage = imgArr;

    setCurrentSong({
      id: songData.id,
      title: songData.title || songData.name,
      artist: songData.more_info?.singers || songData.artist || songData.subtitle || songData.primaryArtists || 'Unknown Artist',
      image: bestImage,
      media_url: mediaUrl,
      duration: songData.duration
    });
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
        const res = await fetch(`https://listen-together-steel.vercel.app/api/songs?id=${song.id}`);
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
        song: songData,
        type: 'music_share'
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
              onSelect={selectSong} 
              onInvite={handleInvite}
              onToggle={togglePlayback}
              currentSongId={currentSong?.id}
              isPlaying={useMusicStore.getState().isPlaying}
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
const SongItem = memo(({ song, index, onSelect, onInvite, onToggle, currentSongId, isPlaying }) => {
  const imgObj = song.images || {};
  const imgArr = song.image || [];
  const thumbnail = imgObj['150x150'] || imgObj['50x50'] || 
                   (Array.isArray(imgArr) ? (imgArr[1]?.url || imgArr[1]?.link || imgArr[0]?.url || '') : imgArr);

  const isCurrent = currentSongId === song.id;

  return (
    <div 
      className={`song-result-item ${isCurrent ? 'active' : ''}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="song-artwork-wrapper" onClick={() => onSelect(song)}>
        <img 
          src={thumbnail} 
          alt="" 
          className="song-artwork" 
          loading="lazy"
        />
        <div className="artwork-overlay">
          {isCurrent && isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
        </div>
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

