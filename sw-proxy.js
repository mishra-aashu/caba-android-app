/**
 * sw-proxy.js
 * 
 * ROOT OTA MIRROR for Capacitor
 */

const VERCEL_ORIGIN = 'https://caba-android-app.vercel.app';
const CACHE_NAME = 'ota-mirror-cache';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

  // ── Intercept Fetches ──
  self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Only intercept local requests on the app origin
    if (url.origin === self.location.origin) {
      event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
          try {
            const cachedResponse = await cache.match(event.request);
            
            if (cachedResponse) {
              return cachedResponse;
            }

            // Fallback logic for critical assets or media
            const isMedia = url.pathname.match(/\.(ogg|mp3|wav|png|jpg|jpeg|svg|webp|gif)$/i);
            const isCritical = url.pathname === '/' || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.json');

            if (isCritical || isMedia) {
              try {
                const remoteUrl = VERCEL_ORIGIN + url.pathname + url.search;
                const remoteResponse = await fetch(remoteUrl, { mode: 'cors' });
                if (remoteResponse.ok) {
                  // Optionally cache it here too (Lazy Mirroring)
                  // For media, we clone the response before returning
                  cache.put(event.request, remoteResponse.clone());
                  return remoteResponse;
                }
              } catch (e) {
                // Fallback to local APK assets if network/cors fails
                console.warn('[SW-Proxy] Vercel fallback failed for:', url.pathname, e.message);
              }
            }

            // Final fallback to the real local server
            return fetch(event.request).catch(err => {
              console.error('[SW-Proxy] Local fetch failed for:', url.pathname, err.message);
              // Return a custom error if both fail
              return new Response('Asset not found', { status: 404 });
            });
          } catch (e) {
            console.error('[SW-Proxy] Unexpected error in fetch handler:', e.message);
            return fetch(event.request);
          }
        })
      );
    }
  });

// ── Message channel for triggers ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'MIRROR_NOW') {
    // Explicitly seed the cache with critical assets from Vercel
    event.waitUntil(mirrorAssets());
  }
});

async function mirrorAssets() {
  const cache = await caches.open(CACHE_NAME);
  const assets = [
    '/', 
    '/index.html', 
    '/version.json', 
    '/assets/audio/outgoing_ring.ogg',
    '/assets/audio/fm-freemusic-give-me-a-smile(chosic.com).ogg'
  ]; 
  // Note: Deep mirroring requires parsing manifest.json, which useAutoRefresh.js can do.
  
  for (const path of assets) {
    try {
      const resp = await fetch(VERCEL_ORIGIN + path, { mode: 'cors' });
      if (resp.ok) await cache.put(path, resp);
    } catch (e) {
      console.error('[SW-Proxy] Mirror failed for:', path, e);
    }
  }
}
