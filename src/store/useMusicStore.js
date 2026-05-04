import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MUSIC_API_URL, MUSIC_API_BASE } from '../config/musicConfig';
import { supabase } from '../config/supabase';

/**
 * useMusicStore - Global state for Elevengram Music System
 * Handles player state, UI state for the music panel, and Listen Together sync state.
 */
const useMusicStore = create(
  persist(
    (set, get) => ({
      // ─── Player State ───
      currentSong: null,
      isPlaying: false,
      progress: 0,
      duration: 0,
      volume: 0.8,
      
      // ─── UI State ───
      isPanelOpen: false,
      isSearchLoading: false,
      searchResults: [],
      searchQuery: '',
      isPlayerExpanded: false,
      playbackHistory: [],
      tabCache: {},
      likedSongs: [],
      backgroundImages: [],
      recommendations: [],
      
      // ─── Listen Together (Sync) State ───
      roomId: null,
      isHost: false,
      syncStatus: 'disconnected', // 'disconnected' | 'synced' | 'lagging'
      
      // ─── Actions ───
      
      setCurrentSong: (song) => {
        const state = get();
        
        // Stop current playback if song is null
        if (!song) {
          set({ 
            currentSong: null, 
            isPlaying: false, 
            progress: 0, 
            duration: 0 
          });
          return;
        }
        
        // Check if it's a new song
        const isNewSong = state.currentSong?.id !== song.id;
        
        // Update state
        set({ 
          currentSong: song, 
          progress: isNewSong ? 0 : state.progress,
          duration: song.duration || state.duration,
          isPlaying: true 
        });

        // Trigger side effects only for new songs
        if (isNewSong) {
          get().addToHistory(song);
          get().fetchRecommendations(song.id);
        }
      },

      addToHistory: (song) => {
        if (!song?.id) return;
        
        const { playbackHistory } = get();
        
        // Remove duplicate and add to top
        const filtered = playbackHistory.filter(s => s.id !== song.id);
        const updated = [song, ...filtered].slice(0, 50); // Keep last 50 songs
        
        set({ playbackHistory: updated });
      },

      clearHistory: () => {
        set({ playbackHistory: [] });
      },

      setTabCache: (tabId, results) => {
        if (!tabId) return;
        
        set((state) => ({
          tabCache: { 
            ...state.tabCache, 
            [tabId]: results 
          }
        }));
      },

      // ─── Liked Songs Management ───
      fetchLikedSongs: async (userId) => {
        if (!userId) {
          console.warn("[MusicStore] Cannot fetch liked songs: No userId provided");
          return;
        }

        try {
          const { data, error } = await supabase
            .from('music_likes')
            .select('song_metadata')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const liked = (data || [])
            .map(item => item.song_metadata)
            .filter(song => song && song.id); // Filter out invalid entries

          set({ likedSongs: liked });
          
          console.log(`[MusicStore] Fetched ${liked.length} liked songs`);
        } catch (err) {
          console.error("[MusicStore] Failed to fetch liked songs:", err);
          set({ likedSongs: [] });
        }
      },

      toggleLikeSong: async (song, userId) => {
        if (!song?.id) {
          console.warn("[MusicStore] Invalid song object");
          return;
        }

        const { likedSongs } = get();
        const isLiked = likedSongs.some(s => s.id === song.id);

        // Optimistic update
        const updatedLikes = isLiked
          ? likedSongs.filter(s => s.id !== song.id)
          : [song, ...likedSongs];

        set({ likedSongs: updatedLikes });

        // Sync to Supabase if user is logged in
        if (userId) {
          try {
            if (isLiked) {
              // Unlike song
              const { error } = await supabase
                .from('music_likes')
                .delete()
                .eq('user_id', userId)
                .eq('song_id', song.id);

              if (error) throw error;
            } else {
              // Like song
              const { error } = await supabase
                .from('music_likes')
                .upsert({
                  user_id: userId,
                  song_id: song.id,
                  song_metadata: song,
                  created_at: new Date().toISOString()
                }, {
                  onConflict: 'user_id,song_id'
                });

              if (error) throw error;
            }
            
            console.log(`[MusicStore] Song ${isLiked ? 'unliked' : 'liked'} successfully`);
          } catch (err) {
            console.error("[MusicStore] Sync failed:", err);
            
            // Rollback optimistic update
            set({ likedSongs });
          }
        }
      },

      // ─── Smart Recommendations ───
      fetchRecommendations: async (songId) => {
        if (!songId) {
          console.warn("[MusicStore] Cannot fetch recommendations: No songId");
          return;
        }

        try {
          const res = await fetch(
            `${MUSIC_API_BASE}/recommendations?song_id=${songId}&limit=20`
          );
          
          if (!res.ok) {
            throw new Error(`API returned ${res.status}: ${res.statusText}`);
          }

          const data = await res.json();
          
          if (data.status === 'success' && data.data?.results) {
            const recs = data.data.results.filter(r => r && r.id); // Filter valid songs
            
            set({ recommendations: recs });
            console.log(`[MusicStore] Fetched ${recs.length} recommendations`);
          } else {
            set({ recommendations: [] });
          }
        } catch (err) {
          console.error("[MusicStore] Failed to fetch recommendations:", err);
          set({ recommendations: [] });
        }
      },
      
      // ─── Playback Controls ───
      setIsPlaying: (playing) => {
        if (typeof playing !== 'boolean') return;
        set({ isPlaying: playing });
      },
      
      setProgress: (progress) => {
        const value = Math.max(0, Number(progress) || 0);
        set({ progress: value });
      },
      
      setDuration: (duration) => {
        const value = Math.max(0, Number(duration) || 0);
        set({ duration: value });
      },
      
      setVolume: (volume) => {
        const value = Math.max(0, Math.min(1, Number(volume) || 0));
        set({ volume: value });
      },

      playNext: () => {
        const { currentSong, searchResults, recommendations } = get();
        
        // Use recommendations if available, otherwise use search results
        const playlist = recommendations.length > 0 ? recommendations : searchResults;
        
        if (playlist.length === 0) {
          console.warn("[MusicStore] No songs in queue to play next");
          return null;
        }
        
        const currentIndex = playlist.findIndex(s => s.id === currentSong?.id);
        const nextIndex = (currentIndex + 1) % playlist.length;
        const nextSong = playlist[nextIndex];
        
        get().setCurrentSong(nextSong);
        return nextSong;
      },

      playPrevious: () => {
        const { currentSong, searchResults, recommendations } = get();
        
        // Use recommendations if available, otherwise use search results
        const playlist = recommendations.length > 0 ? recommendations : searchResults;
        
        if (playlist.length === 0) {
          console.warn("[MusicStore] No songs in queue to play previous");
          return null;
        }
        
        const currentIndex = playlist.findIndex(s => s.id === currentSong?.id);
        const prevIndex = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1;
        const prevSong = playlist[prevIndex];
        
        get().setCurrentSong(prevSong);
        return prevSong;
      },
      
      // ─── UI Controls ───
      togglePanel: (isOpen) => {
        set((state) => ({ 
          isPanelOpen: typeof isOpen === 'boolean' ? isOpen : !state.isPanelOpen 
        }));
      },
      
      setSearchLoading: (loading) => {
        if (typeof loading !== 'boolean') return;
        set({ isSearchLoading: loading });
      },
      
      setSearchResults: (results) => {
        if (Array.isArray(results)) {
          const validResults = results.filter(r => r && r.id);
          set({ searchResults: validResults });
        } else if (typeof results === 'function') {
          set((state) => {
            const newResults = results(state.searchResults);
            return { searchResults: Array.isArray(newResults) ? newResults : state.searchResults };
          });
        }
      },
      
      setSearchQuery: (query) => {
        set({ searchQuery: String(query || '') });
      },
      
      setBackgroundImages: (images) => {
        if (!Array.isArray(images)) return;
        set({ backgroundImages: images });
      },
      
      setPlayerExpanded: (expanded) => {
        set((state) => ({ 
          isPlayerExpanded: typeof expanded === 'boolean' ? expanded : !state.isPlayerExpanded 
        }));
      },
      
      // ─── Listen Together Actions ───
      joinRoom: (id, isHost = false) => {
        if (!id) {
          console.warn("[MusicStore] Cannot join room: No room ID");
          return;
        }

        set({ 
          roomId: String(id), 
          isHost: Boolean(isHost), 
          syncStatus: 'synced' 
        });
        
        console.log(`[MusicStore] Joined room: ${id} as ${isHost ? 'host' : 'participant'}`);
      },
      
      leaveRoom: () => {
        const { roomId } = get();
        
        set({ 
          roomId: null, 
          isHost: false, 
          syncStatus: 'disconnected',
          isPlaying: false,
          currentSong: null,
          progress: 0
        });
        
        console.log(`[MusicStore] Left room: ${roomId}`);
      },
      
      setSyncStatus: (status) => {
        const validStatuses = ['disconnected', 'synced', 'lagging'];
        
        if (validStatuses.includes(status)) {
          set({ syncStatus: status });
        } else {
          console.warn(`[MusicStore] Invalid sync status: ${status}`);
        }
      },

      // ─── Metadata Refresh ───
      refreshCurrentSongMetadata: async () => {
        const { currentSong } = get();
        
        if (!currentSong?.id) {
          console.warn("[MusicStore] No current song to refresh");
          return false;
        }
        
        console.log(`[MusicStore] Refreshing metadata for: ${currentSong.id}`);
        
        try {
          const res = await fetch(`${MUSIC_API_BASE}/song?id=${currentSong.id}`);
          
          if (!res.ok) {
            throw new Error(`API returned ${res.status}: ${res.statusText}`);
          }
          
          const json = await res.json();
          
          if (json.status === 'success' && json.data) {
            const details = json.data;
            
            // Get best quality media URL
            const freshMediaUrl = 
              details.media_urls?.[0]?.url ||
              details.media_urls?.['320_KBPS'] || 
              details.media_urls?.['160_KBPS'] || 
              details.media_url;

            if (freshMediaUrl) {
              const updatedSong = {
                ...currentSong,
                id: details.id || currentSong.id,
                title: details.title || details.name || currentSong.title,
                artist: details.singers || details.primary_artists || currentSong.artist,
                media_url: freshMediaUrl,
                image: details.image?.[2]?.url || details.image || currentSong.image,
                duration: details.duration || currentSong.duration
              };

              set({ currentSong: updatedSong });
              
              console.log("[MusicStore] Metadata refreshed successfully");
              return true;
            } else {
              console.warn("[MusicStore] No media URL found in refreshed metadata");
            }
          } else {
            console.warn("[MusicStore] Invalid API response format");
          }
        } catch (err) {
          console.error("[MusicStore] Metadata refresh failed:", err);
        }
        
        return false;
      }
    }),
    {
      name: 'elevengram-music-storage',
      partialize: (state) => ({
        // Persist only essential data
        currentSong: state.currentSong,
        volume: state.volume,
        playbackHistory: state.playbackHistory,
        likedSongs: state.likedSongs,
        searchQuery: state.searchQuery,
        // Don't persist: isPlaying, progress, isPanelOpen, searchResults, etc.
      })
    }
  )
);

export default useMusicStore;