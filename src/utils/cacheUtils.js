/**
 * cacheUtils.js
 * Utilities for interacting with the Service Worker Cache API.
 */

const AUDIO_CACHE_NAME = 'audio-cache';

/**
 * Checks if a song's media URL is present in the local audio cache.
 * @param {string} url - The media URL of the song.
 * @returns {Promise<boolean>} - True if cached, false otherwise.
 */
export async function isSongCached(url) {
  if (!url || !('caches' in window)) return false;
  
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const match = await cache.match(url);
    return !!match;
  } catch (error) {
    console.error('[CacheUtils] Failed to check cache:', error);
    return false;
  }
}

/**
 * Deletes a song from the local audio cache.
 * @param {string} url - The media URL of the song.
 * @returns {Promise<boolean>} - True if deleted successfully.
 */
export async function deleteFromCache(url) {
  if (!url || !('caches' in window)) return false;
  
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    return await cache.delete(url);
  } catch (error) {
    console.error('[CacheUtils] Failed to delete from cache:', error);
    return false;
  }
}
