/**
 * pwa.js — Manual Service Worker Registration
 *
 * WHY THIS FILE EXISTS:
 * vite.config.js has `injectRegister: null` which means VitePWA
 * generates sw.js in dist/ but does NOT auto-register it.
 * Without this file, sw.js sits unused — no caching, no offline,
 * no update detection.
 *
 * HOW IT WORKS:
 * 1. Imports `registerSW` from VitePWA's virtual module
 * 2. Registers the SW immediately on app load
 * 3. Exposes callbacks for useAutoRefresh to listen for updates
 *
 * MUST be imported in main.jsx (early, before React renders).
 */

import { registerSW } from 'virtual:pwa-register';

// ══════════════════════════════════════════════════════════════
// Shared state — useAutoRefresh hooks into these
// ══════════════════════════════════════════════════════════════

/** @type {Function|null} Callback when SW detects new precached assets */
let _onNeedRefreshCallback = null;

/** @type {Function|null} Function to activate waiting SW */
let _updateSW = null;

/**
 * Subscribe to "new content available" events.
 * Called by useAutoRefresh on mount.
 *
 * When Workbox detects that precached file hashes have changed
 * (i.e., a new deploy happened), this callback fires.
 *
 * @param {Function} callback - Called when update is ready
 */
export function onSWNeedRefresh(callback) {
  _onNeedRefreshCallback = callback;
}

/**
 * Activate the waiting Service Worker and reload the page.
 * Called by useAutoRefresh when user clicks "Update".
 *
 * This tells the waiting SW to call skipWaiting(),
 * which triggers a controllerchange event,
 * which reloads the page with new assets.
 */
export function activateSWUpdate() {
  if (_updateSW) {
    console.log('[PWA] Activating waiting service worker...');
    _updateSW(true); // true = reload page after activation
  } else {
    console.warn('[PWA] No waiting SW found — doing hard reload');
    window.location.reload();
  }
}

// ══════════════════════════════════════════════════════════════
// Conditional Registration: OTA Proxy vs Normal SW
// ══════════════════════════════════════════════════════════════
const OTA_BUILD = localStorage.getItem('ota-active-build');

if (OTA_BUILD) {
  console.log('[PWA] 🛡️ Service Worker Proxy mode for build:', OTA_BUILD);
  
  // Register the proxy and setup a simple update listener
  navigator.serviceWorker.register('/sw-proxy.js', { scope: '/' }).then(reg => {
    reg.onupdatefound = () => {
      const newWorker = reg.installing;
      newWorker.onstatechange = () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          if (_onNeedRefreshCallback) _onNeedRefreshCallback();
        }
      };
    };
  }).catch(err => {
    console.log('[PWA] SW-Proxy registration failed (expected in dev):', err.message);
  });

  _updateSW = (reload) => {
    if (reload) window.location.reload();
  };

} else {
  _updateSW = registerSW({
  // Register immediately on import (don't wait for user action)
  immediate: true,

  /**
   * Called when a new SW is installed and waiting to activate.
   * This means new precached assets are available but not yet active.
   * We show a banner to let the user choose when to update.
   */
  onNeedRefresh() {
    console.log('[PWA] ✨ New content available — update ready');
    if (_onNeedRefreshCallback) {
      _onNeedRefreshCallback();
    }
  },

  /**
   * Called when the SW has cached all assets for offline use.
   * First-time install or after update activation.
   */
  onOfflineReady() {
    console.log('[PWA] ✅ App cached for offline use');
  },

  /**
   * Called after successful SW registration.
   * Sets up periodic update checks (every 5 minutes).
   */
  onRegisteredSW(swUrl, registration) {
    console.log('[PWA] Service Worker registered:', swUrl);

    if (registration) {
      // Periodically check for new SW versions
      // This catches updates even if the user never closes the app
      setInterval(() => {
        if (navigator.onLine) {
          registration.update().catch((err) => {
            console.warn('[PWA] Periodic update check failed:', err);
          });
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
  },

  /**
   * Called if SW registration fails entirely.
   * Non-fatal — app still works, just without offline support.
   */
  onRegisterError(error) {
    // Non-fatal — happens in some dev environments or when SW is blocked by WebView.
    // We log it as a info/warn to keep the console clean for the user.
    console.info('[PWA] Service Worker registration skipped or failed. This is normal in dev-mode.', error.message);
  },
});
}
