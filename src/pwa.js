/**
 * pwa.js — Service Worker Registration
 *
 * Rules:
 *   On localhost (Capacitor local bundle): DON'T register SW
 *     → SW can't register on localhost in Android WebView
 *     → Updates detected via version.json polling instead
 *
 *   On Vercel domain (after OTA redirect): REGISTER SW
 *     → SW precaches all assets for offline
 *     → SW detects new deploys via precache hash change
 *     → Both detection methods work (SW + version.json)
 *
 *   On web browser: REGISTER SW
 *     → Normal PWA behavior
 *
 * KEY FIX: After skipWaiting(), the new SW fires 'controllerchange'.
 * We listen to that event and do window.location.reload() so React
 * re-boots with the new SW's cached assets. Without this reload,
 * the new SW is active but the old React bundle keeps running.
 */

import { isNativeWithPlugins } from './utils/platformCheck';

let _onNeedRefreshCallback = null;
let _updateSW = null;
let _reloadOnController = false; // guard: only reload once per activation

export function onSWNeedRefresh(callback) {
  _onNeedRefreshCallback = callback;
}

export function activateSWUpdate() {
  if (_updateSW) {
    console.log('[PWA] Activating waiting service worker...');
    _reloadOnController = true; // next controllerchange → reload
    _updateSW(true);            // calls skipWaiting on the waiting SW
  } else {
    console.warn('[PWA] No waiting SW — hard reload');
    window.location.reload();
  }
}

// ── Decide whether to register SW ──
const isLocalNative = isNativeWithPlugins();

if (isLocalNative) {
  // On Capacitor localhost: SW doesn't work, skip it
  console.log('[PWA] Native localhost — SW registration skipped');
  console.log('[PWA] Updates will be detected via version.json polling');
} else {
  // ── Listen for the new SW taking control ──
  // When skipWaiting() succeeds, controllerchange fires.
  // At that point we reload so the fresh SW caches are used.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (_reloadOnController) {
        _reloadOnController = false;
        console.log('[PWA] Controller changed → reloading for new version');
        window.location.reload();
      }
    });
  }

  // On Vercel domain or web browser: register VitePWA's SW
  import('virtual:pwa-register').then(({ registerSW }) => {
    _updateSW = registerSW({
      immediate: true,

      onNeedRefresh() {
        console.log('[PWA] ✨ New content available — update ready');
        if (_onNeedRefreshCallback) _onNeedRefreshCallback();
      },

      onOfflineReady() {
        console.log('[PWA] ✅ Cached for offline use');
      },

      onRegisteredSW(swUrl, registration) {
        console.log('[PWA] SW registered:', swUrl);
        if (registration) {
          // Poll for updates every 5 minutes while online
          setInterval(() => {
            if (navigator.onLine) {
              registration.update().catch(() => {});
            }
          }, 5 * 60 * 1000);
        }
      },

      onRegisterError(error) {
        console.info('[PWA] SW registration skipped:', error.message);
      },
    });
  }).catch(err => {
    console.info('[PWA] Could not load SW module:', err.message);
  });
}