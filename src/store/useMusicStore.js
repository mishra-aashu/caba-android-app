import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MUSIC_API_BASE } from '../config/musicConfig';
import { supabase } from '../config/supabase';

// Counter to deduplicate recommendation fetches (race condition guard)
let recFetchId = 0;

const useMusicStore = create(
  persist(
    (set, get) => ({
      // ─── Player State ───
      currentSong: null,
      isPlaying: false,
      progress: 0,
      duration: 0,
      volume: 0.8,
      lastSeekTo: null,
      extractedColors: null,

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
      repeatMode: 'off', // 'off', 'all', 'one'
      downloadProgress: {}, // songId -> percentage

      // ─── Listen Together (Sync) State ───
      roomId: null,
      isHost: false,
      syncStatus: 'disconnected',
      activeTab: 'Trending',
      activeSection: 'home', // 'home', 'search', 'library', 'share'
      recentSearches: [],
      songToShare: null,

      // ─── Actions ───

      setActiveTab: (tab) => set({ activeTab: tab }),
      setActiveSection: (section) => set({ activeSection: section }),
      
      addToRecentSearches: (query) => {
        if (!query || query.trim() === '') return;
        set(state => {
          const filtered = state.recentSearches.filter(q => q !== query);
          return { recentSearches: [query, ...filtered].slice(0, 10) };
        });
      },

      clearRecentSearches: () => set({ recentSearches: [] }),

      setCurrentSong: (song, forceReset = false) => {
        const state = get();

        if (!song) {
          set({
            currentSong: null,
            isPlaying: false,
            progress: 0,
            duration: 0,
          });
          return;
        }

        const isNewSong = state.currentSong?.id !== song.id;

        set({
          currentSong: song,
          progress: (isNewSong || forceReset) ? 0 : state.progress,
          duration: song.duration || 0,
          isPlaying: (isNewSong || forceReset) ? true : state.isPlaying, // keep playing state for same song unless forced
        });

        if (isNewSong || forceReset) {
          get().addToHistory(song);
          get().fetchRecommendations(song.id);

          if (!song.media_url) {
            console.log('[MusicStore] Missing media_url for new song, refreshing...');
            get().refreshCurrentSongMetadata();
          }
        }
      },

      addToHistory: (song) => {
        if (!song?.id) return;
        const { playbackHistory } = get();
        const filtered = playbackHistory.filter((s) => s.id !== song.id);
        set({ playbackHistory: [song, ...filtered].slice(0, 50) });
      },

      clearHistory: () => set({ playbackHistory: [] }),

      setTabCache: (tabId, results) => {
        if (!tabId) return;
        set((state) => ({ tabCache: { ...state.tabCache, [tabId]: results } }));
      },

      setSongToShare: (song) => set({ songToShare: song }),

      // ─── Liked Songs Management ───
      fetchLikedSongs: async (userId) => {
        // Always try to load from local DB first for instant UI response (Offline First)
        try {
          const { getDatabase } = await import('../db/DatabaseFactory');
          const db = await getDatabase();
          // Using the new music_likes table
          const localLiked = await db.getAll('music_likes');
          
          // Sort by created_at descending if possible
          const sorted = localLiked.sort((a, b) => 
            new Date(b.created_at || 0) - new Date(a.created_at || 0)
          );

          if (sorted.length > 0) {
            set({ likedSongs: sorted });
            console.log(`[MusicStore] Loaded ${sorted.length} liked songs from Local DB`);
          }
        } catch (err) {
          console.warn('[MusicStore] Local DB load failed:', err);
        }

        if (!userId) {
          set({ likedSongs: [] });
          return;
        }

        try {
          const { data, error } = await supabase
            .from('music_likes')
            .select('song_metadata, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const liked = (data || [])
            .map((item) => ({ 
                ...item.song_metadata, 
                created_at: item.created_at,
                songId: item.song_metadata.id,
                userId: userId,
                synced: true
            }))
            .filter((song) => song && song.id);

          set({ likedSongs: liked });
          
          // Update local cache
          const { getDatabase } = await import('../db/DatabaseFactory');
          const db = await getDatabase();
          
          // Clear and re-fill using abstraction
          const existing = await db.getAll('music_likes');
          for (const item of existing) {
            await db.delete('music_likes', item.id);
          }
          await db.bulkPut('music_likes', liked);
          
          console.log(`[MusicStore] Synced ${liked.length} liked songs from Supabase`);
        } catch (err) {
          console.error('[MusicStore] Supabase fetch failed, staying with local cache:', err);
        }
      },

      toggleLikeSong: async (song, userId) => {
        if (!song?.id) return;

        const { likedSongs } = get();
        const isLiked = likedSongs.some((s) => s.id === song.id);
        const now = new Date().toISOString();

        // 1. Optimistic UI update
        const updatedLiked = isLiked
          ? likedSongs.filter((s) => s.id !== song.id)
          : [{ ...song, created_at: now }, ...likedSongs];

        set({ likedSongs: updatedLiked });

        // 2. Update Local DB
        try {
          const { getDatabase } = await import('../db/DatabaseFactory');
          const db = await getDatabase();
          if (isLiked) {
            await db.delete('music_likes', song.id);
          } else {
            await db.set('music_likes', { 
                ...song, 
                id: song.id,
                songId: song.id,
                userId: userId || '',
                created_at: now,
                synced: false 
            });
          }
        } catch (err) {
          console.warn('[MusicStore] Local DB update failed:', err);
        }

        // 3. Queue for Supabase
        if (userId) {
          try {
            const { getSyncEngine } = await import('../db/SyncEngine');
            const syncEngine = getSyncEngine(supabase);
            await syncEngine.queueChange('music_likes', isLiked ? 'DELETE' : 'INSERT', {
              user_id: userId,
              song_id: song.id,
              song_metadata: song
            });
          } catch (err) {
            console.error('[MusicStore] Failed to queue like action:', err);
          }
        }
      },

      // ─── Smart Recommendations (with race‑condition guard) ───
      fetchRecommendations: async (songId) => {
        if (!songId) {
          set({ recommendations: [] });
          return;
        }

        const currentFetchId = ++recFetchId;

        try {
          const res = await fetch(`${MUSIC_API_BASE}/recommendations?song_id=${songId}&limit=20`);
          if (!res.ok) throw new Error(`API returned ${res.status}`);

          const data = await res.json();

          // Ignore if a newer fetch has been initiated
          if (currentFetchId !== recFetchId) {
            console.log('[MusicStore] Discarding stale recommendations');
            return;
          }

          if (data.status === 'success' && data.data?.results) {
            set({ recommendations: data.data.results.filter((r) => r && r.id) });
          } else {
            set({ recommendations: [] });
          }
        } catch (err) {
          console.error('[MusicStore] Failed to fetch recommendations:', err);
          if (currentFetchId === recFetchId) {
            set({ recommendations: [] });
          }
        }
      },

      // ─── Playback Controls ───
      setIsPlaying: (playing) => {
        if (typeof playing !== 'boolean') return;
        set({ isPlaying: playing });
      },

      setProgress: (progress) => {
        set({ progress: Math.max(0, Number(progress) || 0) });
      },

      seekTo: (time) => {
        set({ progress: Math.max(0, Number(time) || 0), lastSeekTo: Date.now() });
      },

      setDuration: (duration) => {
        set({ duration: Math.max(0, Number(duration) || 0) });
      },

      setVolume: (volume) => {
        set({ volume: Math.max(0, Math.min(1, Number(volume) || 0)) });
      },

      setExtractedColors: (colors) => set({ extractedColors: colors }),

      toggleRepeatMode: () => {
        const modes = ['off', 'all', 'one'];
        const current = get().repeatMode;
        const nextIndex = (modes.indexOf(current) + 1) % modes.length;
        set({ repeatMode: modes[nextIndex] });
      },

      playNext: () => {
        const { currentSong, searchResults, recommendations, repeatMode } = get();

        if (repeatMode === 'one' && currentSong) {
          // Restart current song from beginning
          get().setCurrentSong(currentSong, true);
          return currentSong;
        }

        const playlist = recommendations.length > 0 ? recommendations : searchResults;
        if (playlist.length === 0) {
          console.warn('[MusicStore] No songs in queue to play next');
          return null;
        }

        const currentIndex = playlist.findIndex((s) => s.id === currentSong?.id);
        let nextIndex = currentIndex + 1;

        if (nextIndex >= playlist.length) {
          if (repeatMode === 'all') {
            nextIndex = 0;
          } else {
            return null; // End of playlist
          }
        }

        const nextSong = playlist[nextIndex];
        get().setCurrentSong(nextSong);
        return nextSong;
      },

      playPrevious: () => {
        const { currentSong, searchResults, recommendations } = get();
        const playlist = recommendations.length > 0 ? recommendations : searchResults;

        if (playlist.length === 0) {
          console.warn('[MusicStore] No songs in queue to play previous');
          return null;
        }

        const currentIndex = playlist.findIndex((s) => s.id === currentSong?.id);
        const prevIndex = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1;
        const prevSong = playlist[prevIndex];
        get().setCurrentSong(prevSong);
        return prevSong;
      },

      // ─── UI Controls ───
      togglePanel: (isOpen) =>
        set((state) => ({
          isPanelOpen: typeof isOpen === 'boolean' ? isOpen : !state.isPanelOpen,
        })),

      setSearchLoading: (loading) => {
        if (typeof loading !== 'boolean') return;
        set({ isSearchLoading: loading });
      },

      setSearchResults: (results) => {
        if (Array.isArray(results)) {
          set({ searchResults: results.filter((r) => r && r.id) });
        } else if (typeof results === 'function') {
          set((state) => {
            const newResults = results(state.searchResults);
            return {
              searchResults: Array.isArray(newResults)
                ? newResults.filter((r) => r && r.id)
                : state.searchResults,
            };
          });
        }
      },

      setSearchQuery: (query) => set({ searchQuery: String(query || '') }),

      setBackgroundImages: (images) => {
        if (Array.isArray(images)) set({ backgroundImages: images });
      },

      setPlayerExpanded: (expanded) =>
        set((state) => ({
          isPlayerExpanded: typeof expanded === 'boolean' ? expanded : !state.isPlayerExpanded,
        })),

      // ─── Listen Together Actions ───
      joinRoom: async (id, isHost = false) => {
        let finalId = id;
        if (!finalId && isHost) {
          // Generate a random 6-character room ID for host
          finalId = Math.random().toString(36).substring(2, 8).toUpperCase();
        }
        
        if (!finalId) return false;

        // Validation for listeners joining an existing room
        if (!isHost) {
          try {
            const { data, error } = await supabase
              .from('music_rooms')
              .select('status, song_metadata')
              .eq('id', finalId)
              .maybeSingle();

            if (error) throw error;

            if (!data) {
              const { toast } = await import('react-hot-toast');
              toast.error("Room not found!");
              return false;
            }

            if (data.status === 'ended') {
              const { toast } = await import('react-hot-toast');
              toast.error("This session has ended", { icon: '🚫' });
              return false;
            }

            // Sync song metadata if available
            if (data.song_metadata) {
              set({ currentSong: data.song_metadata });
            }
          } catch (err) {
            console.error('[MusicStore] Failed to verify room status:', err);
            const { toast } = await import('react-hot-toast');
            toast.error("Connection error while joining room");
            return false;
          }
        }
        
        set({ roomId: String(finalId), isHost: Boolean(isHost), syncStatus: 'synced' });
        console.log(`[MusicStore] ${isHost ? 'Created' : 'Joined'} room: ${finalId}`);
        
        if (isHost) {
          // Register room in DB
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('music_rooms').upsert({
                id: finalId,
                host_id: user.id,
                status: 'active',
                song_metadata: get().currentSong,
                created_at: new Date().toISOString()
              });
            }
          } catch (err) {
            console.error('[MusicStore] Failed to register room in DB:', err);
          }

          import('react-hot-toast').then(({ toast }) => {
            toast.success(`Music Room Created: ${finalId}`, { icon: '🔥' });
          });
        }

        return true;
      },

      leaveRoom: async () => {
        const { roomId, isHost } = get();
        
        if (isHost && roomId) {
          // Mark room as ended in DB
          try {
            await supabase.from('music_rooms')
              .update({ status: 'ended', ended_at: new Date().toISOString() })
              .eq('id', roomId);
          } catch (err) {
            console.error('[MusicStore] Failed to end room in DB:', err);
          }
        }

        set({
          roomId: null,
          isHost: false,
          syncStatus: 'disconnected',
          isPlaying: false,
          currentSong: null,
          progress: 0,
        });
        console.log(`[MusicStore] Left room: ${roomId}`);
      },

      setSyncStatus: (status) => {
        if (['disconnected', 'synced', 'lagging'].includes(status)) {
          set({ syncStatus: status });
        } else {
          console.warn(`[MusicStore] Invalid sync status: ${status}`);
        }
      },

      // ─── Metadata Refresh (race‑condition safe) ───
      refreshCurrentSongMetadata: async () => {
        const { currentSong } = get();
        if (!currentSong?.id) {
          console.warn('[MusicStore] No current song to refresh');
          return false;
        }

        const songId = currentSong.id; // capture before fetch
        console.log(`[MusicStore] Refreshing metadata for: ${songId}`);

        try {
          const res = await fetch(`${MUSIC_API_BASE}/song?id=${songId}`);
          if (!res.ok) throw new Error(`API returned ${res.status}`);

          const json = await res.json();
          if (json.status !== 'success' || !json.data) {
            console.warn('[MusicStore] Invalid API response format');
            return false;
          }

          // Only update if the user is still listening to the same song
          const latestSong = get().currentSong;
          if (!latestSong || latestSong.id !== songId) {
            console.log('[MusicStore] Song changed, discarding metadata refresh');
            return false;
          }

          const details = json.data;
          const freshMediaUrl =
            details.media_urls?.[0]?.url ||
            details.media_urls?.['320_KBPS'] ||
            details.media_urls?.['160_KBPS'] ||
            details.media_url;

          if (!freshMediaUrl) {
            console.warn('[MusicStore] No media URL found in refreshed metadata');
            return false;
          }

          const updatedSong = {
            ...latestSong,
            id: details.id || latestSong.id,
            title: details.title || details.name || latestSong.title,
            artist: details.singers || details.primary_artists || latestSong.artist,
            media_url: freshMediaUrl,
            image: details.image?.[2]?.url || details.image || latestSong.image,
            duration: details.duration || latestSong.duration,
          };

          set({ currentSong: updatedSong });
          console.log('[MusicStore] Metadata refreshed successfully');
          return true;
        } catch (err) {
          console.error('[MusicStore] Metadata refresh failed:', err);
          return false;
        }
      },

      setDownloadProgress: (songId, progress) => {
        set(state => ({
          downloadProgress: { ...state.downloadProgress, [songId]: progress }
        }));
      },

      // ─── User Cleanup (call on logout) ───
      resetUserData: () => {
        set({
          likedSongs: [],
          recommendations: [],
          playbackHistory: [],
          isPlaying: false,
          currentSong: null,
          progress: 0,
          duration: 0,
        });
      },
    }),
    {
      name: 'elevengram-music-storage',
      partialize: (state) => ({
        // Strip media_url to avoid storing expiring URLs; it will be re-fetched automatically
        currentSong: state.currentSong
          ? { ...state.currentSong, media_url: undefined }
          : null,
        volume: state.volume,
        playbackHistory: state.playbackHistory,
        likedSongs: state.likedSongs,
        searchQuery: state.searchQuery,
        activeTab: state.activeTab,
        activeSection: state.activeSection,
        recentSearches: state.recentSearches,
        repeatMode: state.repeatMode,
        extractedColors: state.extractedColors,
        roomId: state.roomId,
        isHost: state.isHost,
      }),
      onRehydrateStorage: () => {
        // After rehydration, refresh metadata if persisted song lacks a media_url
        return (rehydratedState, rehydrationError) => {
          if (rehydrationError) {
            console.error('[MusicStore] Hydration error:', rehydrationError);
            return;
          }
          const song = rehydratedState?.currentSong;
          if (song?.id && !song.media_url) {
            console.log('[MusicStore] Rehydrated song lacks media_url, refreshing...');
            setTimeout(() => {
              useMusicStore.getState().refreshCurrentSongMetadata();
            }, 0);
          }
        };
      },
    }
  )
);

export default useMusicStore;