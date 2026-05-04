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
      
      // ─── Listen Together (Sync) State ───
      roomId: null,
      isHost: false,
      syncStatus: 'disconnected', // 'disconnected' | 'synced' | 'lagging'
      
      // ─── Actions ───
      
      setCurrentSong: (song) => {
        // Stop current playback if song is null
        if (!song) {
          set({ currentSong: null, isPlaying: false, progress: 0, duration: 0 });
          return;
        }
        
        // If it's a new song, reset progress
        const isNewSong = get().currentSong?.id !== song.id;
        set({ 
          currentSong: song, 
          progress: isNewSong ? 0 : get().progress,
          isPlaying: true 
        });

        // Trigger smart recommendations if it's a new song
        if (isNewSong) {
          get().fetchRecommendations(song.id);
          get().addToHistory(song);
        }
      },

      addToHistory: (song) => {
        if (!song?.id) return;
        const { playbackHistory } = get();
        // Remove duplicate if exists, then add to top
        const updated = [
          song,
          ...playbackHistory.filter(s => s.id !== song.id)
        ].slice(0, 50); // Keep last 50 songs
        set({ playbackHistory: updated });
      },

      clearHistory: () => set({ playbackHistory: [] }),

      setTabCache: (tabId, results) => {
        set((state) => ({
          tabCache: { ...state.tabCache, [tabId]: results }
        }));
      },

      // ─── Liked Songs Sync ───
      fetchLikedSongs: async (userId) => {
        if (!userId) return;
        try {
          const { data, error } = await supabase
            .from('music_likes')
            .select('song_metadata')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          const liked = (data || []).map(item => item.song_metadata);
          set({ likedSongs: liked });
        } catch (err) {
          console.error("[MusicStore] Failed to fetch liked songs:", err);
        }
      },

      toggleLikeSong: async (song, userId) => {
        if (!song?.id) return;
        const { likedSongs } = get();
        const isLiked = likedSongs.some(s => s.id === song.id);

        // 1. Update local state immediately
        let updated;
        if (isLiked) {
          updated = likedSongs.filter(s => s.id !== song.id);
        } else {
          updated = [song, ...likedSongs];
        }
        set({ likedSongs: updated });

        // 2. Sync to Supabase if logged in
        if (userId) {
          try {
            if (isLiked) {
              await supabase.from('music_likes').delete().eq('user_id', userId).eq('song_id', song.id);
            } else {
              await supabase.from('music_likes').upsert({
                user_id: userId,
                song_id: song.id,
                song_metadata: song
              });
            }
          } catch (err) {
            console.error("[MusicStore] Sync failed:", err);
            // Optionally rollback or toast
          }
        }
      },

      fetchRecommendations: async (songId) => {
        if (!songId) return;
        try {
          const res = await fetch(`${MUSIC_API_BASE}/recommendations?song_id=${songId}&limit=20`);
          if (!res.ok) throw new Error("Failed to fetch recommendations");
          const data = await res.json();
          
          if (data.status === 'success') {
            const recs = data.data.results || [];
            if (recs.length > 0) {
              const current = get().currentSong;
              // Mix recommendations with current song at top
              set({ searchResults: [current, ...recs.filter(r => r.id !== current.id)] });
            }
          }
        } catch (err) {
          console.error("[MusicStore] Recs failed:", err);
        }
      },
      
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      
      setProgress: (progress) => set({ progress }),
      
      setDuration: (duration) => set({ duration }),
      
      setVolume: (volume) => set({ volume }),
      
      togglePanel: (isOpen) => set((state) => ({ 
        isPanelOpen: typeof isOpen === 'boolean' ? isOpen : !state.isPanelOpen 
      })),
      
      setSearchLoading: (loading) => set({ isSearchLoading: loading }),
      
      setSearchResults: (results) => set({ searchResults: results }),
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      setPlayerExpanded: (expanded) => set((state) => ({ 
        isPlayerExpanded: typeof expanded === 'boolean' ? expanded : !state.isPlayerExpanded 
      })),
      
      // ─── Listen Together Actions ───
      
      joinRoom: (id, isHost = false) => set({ 
        roomId: id, 
        isHost, 
        syncStatus: 'synced' 
      }),
      
      leaveRoom: () => {
        set({ 
          roomId: null, 
          isHost: false, 
          syncStatus: 'disconnected',
          isPlaying: false,
          currentSong: null,
          progress: 0
        });
        console.log("[MusicStore] Left room and cleaned up playback state");
      },
      
      setSyncStatus: (status) => set({ syncStatus: status }),

      playNext: () => {
        const { currentSong, searchResults, setCurrentSong } = get();
        if (searchResults.length === 0) return null;
        
        const currentIndex = searchResults.findIndex(s => s.id === currentSong?.id);
        const nextIndex = (currentIndex + 1) % searchResults.length;
        const nextSong = searchResults[nextIndex];
        setCurrentSong(nextSong);
        return nextSong;
      },

      playPrevious: () => {
        const { currentSong, searchResults, setCurrentSong } = get();
        if (searchResults.length === 0) return null;
        
        const currentIndex = searchResults.findIndex(s => s.id === currentSong?.id);
        const prevIndex = currentIndex <= 0 ? searchResults.length - 1 : currentIndex - 1;
        const prevSong = searchResults[prevIndex];
        setCurrentSong(prevSong);
        return prevSong;
      },

      refreshCurrentSongMetadata: async () => {
        const { currentSong } = get();
        if (!currentSong?.id) return;
        
        console.log(`[MusicStore] Refreshing metadata for: ${currentSong.id}`);
        try {
          const res = await fetch(`${MUSIC_API_BASE}/song?id=${currentSong.id}`);
          if (!res.ok) throw new Error(`API returned ${res.status}`);
          
          const json = await res.json();
          if (json.status === 'success' && json.data) {
            const details = json.data;
            const freshMediaUrl = details.media_urls?.['320_KBPS'] || details.media_urls?.['160_KBPS'] || details.media_url;

            if (freshMediaUrl) {
              set({ 
                currentSong: { 
                  ...currentSong, 
                  title: details.title || details.name || currentSong.title,
                  artist: details.singers || details.primary_artists || currentSong.artist,
                  media_url: freshMediaUrl,
                  image: details.image || currentSong.image,
                  duration: details.duration || currentSong.duration
                } 
              });
              return true;
            }
          }
        } catch (err) {
          console.error("Metadata refresh failed:", err);
        }
        return false;
      }
    }),
    {
      name: 'elevengram-music-storage',
      // Persist everything for seamless resume
    }
  )
);

export default useMusicStore;
