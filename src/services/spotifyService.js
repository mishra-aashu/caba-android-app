/**
 * Spotify Service
 * Handles OAuth2 Implicit Grant flow and API requests for Spotify.
 */

const CLIENT_ID = '9671353a99d746eaa9de005714b1760e';

// Detect if we are on localhost or production
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
// Removing trailing slash for better compatibility
const REDIRECT_URI = isLocal 
  ? `http://${window.location.hostname}:5173` 
  : 'https://caba-android-app.vercel.app'; 

const SCOPES = [
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative'
].join(' '); 

export const spotifyService = {
  /**
   * Redirects user to Spotify Authorization page
   */
  login: () => {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&show_dialog=true`;
    window.location.href = authUrl;
  },

  /**
   * Extracts access token from URL hash after redirect
   */
  getAccessTokenFromUrl: () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('access_token');
  },

  /**
   * Fetches user's liked tracks (Saved tracks)
   */
  getLikedTracks: async (token) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch liked tracks');
      const data = await response.json();
      return data.items.map(item => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map(a => a.name).join(', '),
        image: item.track.album.images[0]?.url,
        duration: Math.floor(item.track.duration_ms / 1000)
      }));
    } catch (error) {
      console.error('Spotify API Error:', error);
      return [];
    }
  },

  /**
   * Fetches user's playlists
   */
  getPlaylists: async (token) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch playlists');
      const data = await response.json();
      return data.items.map(p => ({
        id: p.id,
        title: p.name,
        image: p.images[0]?.url,
        trackCount: p.tracks.total,
        owner: p.owner.display_name
      }));
    } catch (error) {
      console.error('Spotify API Error:', error);
      return [];
    }
  },

  /**
   * Fetches tracks from a specific playlist
   */
  getPlaylistTracks: async (token, playlistId) => {
    try {
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch playlist tracks');
      const data = await response.json();
      return data.items.map(item => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map(a => a.name).join(', '),
        image: item.track.album.images[0]?.url,
        duration: Math.floor(item.track.duration_ms / 1000)
      }));
    } catch (error) {
      console.error('Spotify API Error:', error);
      return [];
    }
  }
};
