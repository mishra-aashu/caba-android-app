import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      
      // ─── Listen Together Actions ───
      
      joinRoom: (id, isHost = false) => set({ 
        roomId: id, 
        isHost, 
        syncStatus: 'synced' 
      }),
      
      leaveRoom: () => set({ 
        roomId: null, 
        isHost: false, 
        syncStatus: 'disconnected' 
      }),
      
      setSyncStatus: (status) => set({ syncStatus: status }),
      
      resetPlayer: () => set({ 
        currentSong: null, 
        isPlaying: false, 
        progress: 0, 
        duration: 0,
        roomId: null, 
        isHost: false, 
        syncStatus: 'disconnected' 
      }),
    }),
    {
      name: 'elevengram-music-storage',
      partialize: (state) => ({ 
        volume: state.volume,
        // Optional: Persist last played song metadata without the actual stream URL
        currentSong: state.currentSong ? { ...state.currentSong, media_url: null } : null 
      }),
    }
  )
);

export default useMusicStore;
