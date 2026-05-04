/**
 * Spotify Service
 * Handles OAuth2 Implicit Grant flow and API requests for Spotify.
 */

const CLIENT_ID = '9671353a99d746eaa9de005714b1760e';

// Use dynamic origin for the redirect URI to support localhost, network IPs, and production
const REDIRECT_URI = window.location.origin;

// PKCE Helpers
const generateRandomString = (length) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

const sha256 = async (plain) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

const base64urlencode = (a) => {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const SCOPES = [
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative'
].join(' '); 

export const spotifyService = {
  /**
   * Redirects user to Spotify Authorization page with PKCE
   */
  login: async () => {
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);

    localStorage.setItem('spotify_code_verifier', codeVerifier);

    const params = {
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      redirect_uri: REDIRECT_URI,
    };

    const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams(params).toString()}`;
    window.location.href = authUrl;
  },

  /**
   * Exchanges authorization code for access token (PKCE)
   */
  handleCallback: async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const codeVerifier = localStorage.getItem('spotify_code_verifier');

    if (!code || !codeVerifier) return null;

    try {
      const payload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      };

      const response = await fetch('https://accounts.spotify.com/api/token', payload);
      const data = await response.json();

      if (data.access_token) {
        localStorage.removeItem('spotify_code_verifier');
        return data.access_token;
      }
      return null;
    } catch (error) {
      console.error('Spotify Token Exchange Error:', error);
      return null;
    }
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
