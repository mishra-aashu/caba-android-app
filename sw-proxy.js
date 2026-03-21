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
    // Check if we have this asset in our OTA mirror cache
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        
        if (cachedResponse) {
          // console.log('[SW-Proxy] Serving mirrored asset:', url.pathname);
          return cachedResponse;
        }

        // If not in cache and it's a critical asset, try to fetch from Vercel as fallback
        if (url.pathname === '/' || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
          try {
            const remoteUrl = VERCEL_ORIGIN + url.pathname + url.search;
            const remoteResponse = await fetch(remoteUrl, { mode: 'cors' });
            if (remoteResponse.ok) {
              // Optionally cache it here too (Lazy Mirroring)
              cache.put(event.request, remoteResponse.clone());
              return remoteResponse;
            }
          } catch (e) {
            // Fallback to local APK assets if network/cors fails
          }
        }

        return fetch(event.request);
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
  const assets = ['/', '/index.html', '/version.json']; 
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
