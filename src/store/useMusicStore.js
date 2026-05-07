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

      setCurrentSong: (song) => {
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
          progress: isNewSong ? 0 : state.progress,
          duration: song.duration || 0,
          isPlaying: isNewSong ? true : state.isPlaying, // keep playing state for same song
        });

        if (isNewSong) {
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
        if (!userId) {
          // Clear liked songs when no user is provided (e.g., logout)
          set({ likedSongs: [] });
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
            .map((item) => item.song_metadata)
            .filter((song) => song && song.id);

          set({ likedSongs: liked });
          console.log(`[MusicStore] Fetched ${liked.length} liked songs`);
        } catch (err) {
          console.error('[MusicStore] Failed to fetch liked songs:', err);
          set({ likedSongs: [] });
        }
      },

      toggleLikeSong: async (song, userId) => {
        if (!song?.id) {
          console.warn('[MusicStore] Invalid song object');
          return;
        }

        const { likedSongs } = get();
        const isLiked = likedSongs.some((s) => s.id === song.id);

        // 1. Optimistic UI update
        set({
          likedSongs: isLiked
            ? likedSongs.filter((s) => s.id !== song.id)
            : [song, ...likedSongs],
        });

        if (userId) {
          const { queueAction, QUEUE_ACTIONS } = await import('../services/offlineQueue');
          
          try {
            // 2. Queue the action instead of direct call
            await queueAction(
              QUEUE_ACTIONS.TOGGLE_MUSIC_LIKE,
              'music_likes',
              {
                userId,
                songId: song.id,
                songMetadata: song,
                isLiked // Pass current state so processor knows whether to insert or delete
              }
            );
            
            console.log(`[MusicStore] Song ${isLiked ? 'unlike' : 'like'} queued successfully`);
          } catch (err) {
            console.error('[MusicStore] Failed to queue like action:', err);
            // Rollback optimistic update on queue failure (rare)
            set((state) => ({
              likedSongs: isLiked
                ? [song, ...state.likedSongs]
                : state.likedSongs.filter((s) => s.id !== song.id),
            }));
            
            import('react-hot-toast').then(({ toast }) => {
              toast.error('Failed to save like action');
            });
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
          // Restart current song (addToHistory will deduplicate)
          get().setCurrentSong(currentSong);
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
      joinRoom: (id, isHost = false) => {
        let finalId = id;
        if (!finalId && isHost) {
          // Generate a random 6-character room ID for host
          finalId = Math.random().toString(36).substring(2, 8).toUpperCase();
        }
        
        if (!finalId) return;
        
        set({ roomId: String(finalId), isHost: Boolean(isHost), syncStatus: 'synced' });
        console.log(`[MusicStore] ${isHost ? 'Created' : 'Joined'} room: ${finalId}`);
        
        if (isHost) {
          import('react-hot-toast').then(({ toast }) => {
            toast.success(`Music Room Created: ${finalId}`, { icon: '🔥' });
          });
        }
      },

      leaveRoom: () => {
        const { roomId } = get();
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