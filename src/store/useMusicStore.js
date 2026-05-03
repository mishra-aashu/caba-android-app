import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MUSIC_API_URL } from '../config/musicConfig';

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
      
      refreshCurrentSongMetadata: async () => {
        const { currentSong } = get();
        if (!currentSong?.id) return;
        
        console.log(`[MusicStore] Refreshing metadata for: ${currentSong.id}`);
        try {
          // Cache-bust to prevent Vercel from serving expired CDN tokens
          const cacheBust = `_t=${Date.now()}`;
          const proxyUrl = `${MUSIC_API_URL}/api/song?id=${currentSong.id}&${cacheBust}`;
          
          // Also try jiosaavn-api.vercel.app directly (bypasses our proxy's cache)
          const directUrl = `https://jiosaavn-api.vercel.app/song?id=${currentSong.id}&${cacheBust}`;
          
          let res = await fetch(directUrl, { cache: 'no-store' }).catch(() => null);
          if (!res || !res.ok) {
            res = await fetch(proxyUrl, { cache: 'no-store' });
          }
          if (!res.ok) throw new Error(`API returned ${res.status}`);
          
          const json = await res.json();
          // API returns flat object or wrapped in data/results
          const details = (json.data?.[0] || json.results?.[0] || json?.[0]) ??
            (json.media_urls || json.media_url ? json : null);
          
          if (details) {
            // 2. Comprehensive URL Extraction (Priority: 320kbps > 160kbps > any)
            const urls = details.media_urls || details.download_url || details.downloadUrl || {};
            let freshMediaUrl = details.media_url || "";

            if (typeof urls === 'object' && !Array.isArray(urls)) {
              freshMediaUrl = urls['320kbps'] || urls['320_KBPS'] || 
                             urls['160kbps'] || urls['160_KBPS'] || 
                             urls['96kbps'] || Object.values(urls)[0] || freshMediaUrl;
            } else if (Array.isArray(urls) && urls.length > 0) {
              const best = urls.find(u => u.quality === '320kbps') || 
                           urls.find(u => u.quality === '160kbps') || 
                           urls[urls.length - 1];
              freshMediaUrl = best?.link || best?.url || freshMediaUrl;
            }

            // Fallback to preview
            if (!freshMediaUrl || freshMediaUrl.includes('preview')) {
              freshMediaUrl = details.more_info?.vlink || details.vlink || details.preview_url || freshMediaUrl;
            }

            const finalTitle = details.song || details.title || details.name || currentSong.title;
            const finalArtist = details.primary_artists || details.singers || details.artist || currentSong.artist;

            if (freshMediaUrl) {
              set({ 
                currentSong: { 
                  ...currentSong, 
                  title: finalTitle,
                  artist: finalArtist,
                  media_url: freshMediaUrl,
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
