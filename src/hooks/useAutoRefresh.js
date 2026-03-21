/**
 * useAutoRefresh.js
 *
 * Detects new deployments and provides update UI controls.
 *
 * ═══════════════════════════════════════════════════════════
 * TWO DETECTION METHODS (belt + suspenders):
 * ═══════════════════════════════════════════════════════════
 *
 * METHOD 1: Service Worker Update Events
 *   - Workbox precaches all JS/CSS/HTML with content hashes
 *   - When new deploy happens, hashes change
 *   - SW detects mismatch → onNeedRefresh fires
 *   - Most reliable on WEB (Vercel domain)
 *
 * METHOD 2: /version.json Polling
 *   - Every 5 min, fetch /version.json from Vercel
 *   - Compare remote buildTime with local <meta> tag buildTime
 *   - Most reliable for NATIVE (Capacitor local bundle)
 *   - Also works as fallback on web
 *
 * ═══════════════════════════════════════════════════════════
 * UPDATE FLOW:
 * ═══════════════════════════════════════════════════════════
 *
 * WEB (on Vercel):
 *   1. SW detects new precache → banner shows
 *   2. User clicks "Update"
 *   3. activateSWUpdate() → waiting SW activates → page reloads
 *   4. New assets served from new SW cache ✅
 *
 * NATIVE (Capacitor APK):
 *   1. version.json mismatch detected → banner shows
 *   2. User clicks "Update"
 *   3. Save Vercel URL in localStorage (for early redirect)
 *   4. Clean up local SW + caches
 *   5. Redirect to Vercel
 *   6. On Vercel: new SW registers, caches everything
 *   7. Next cold start: early redirect script in index.html
 *      reads localStorage → instant redirect (no flash) ✅
 *
 * ═══════════════════════════════════════════════════════════
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins } from '../utils/platformCheck';
import { onSWNeedRefresh, activateSWUpdate } from '../pwa';
import { supabase } from '../config/supabase';


// ── Configuration ──
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000;  // 5 minutes between checks
const INITIAL_CHECK_DELAY = 6500;               // ~6.5s after mount (avoid freshness-window skip)
const FRESHNESS_WINDOW = 5000;                  // Skip checks within 5s of mount

// ── Storage Keys ──
// Uses localStorage (synchronous) because the early redirect script
// in index.html reads it synchronously before React boots
const OTA_TARGET_KEY = 'ota-target-url';
const OTA_SESSION_GUARD = 'ota-just-refreshed';
const OTA_ACTIVE_VERSION_KEY = 'ota-active-build';

// ── Remote Origin ──
const REMOTE_ORIGIN = 'https://caba-android-app.vercel.app';

// ── IDEA 2: Graceful Moments (Safe Routes) ──
const SAFE_UPDATE_ROUTES = ['/', '/settings', '/contacts', '/profile', '/history'];
const UNSAFE_UPDATE_PREFIXES = ['/chat/', '/call/', '/room/'];

export const useAutoRefresh = () => {
  // ── State ──
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState({ changelog: [], priority: 'normal' });

  // ── Refs (persist across renders without triggering re-renders) ──
  const currentBuildTimeRef = useRef(null);    // Local build time from <meta> tag
  const checkTimeoutRef = useRef(null);        // setTimeout ID for next check
  const mountTimeRef = useRef(Date.now());     // When this hook mounted
  const swUpdateReadyRef = useRef(false);      // Whether SW has a waiting worker
  const isNativeRef = useRef(Capacitor.isNativePlatform());

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Initialize on mount
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    // ── 1a. Read local build time from HTML meta tag ──
    // This was injected by vite-plugin-html during build:
    //   <meta name="build-time" content="1749811200000" />
    const metaTag = document.querySelector('meta[name="build-time"]');
    const buildTime = metaTag?.content || null;
    currentBuildTimeRef.current = buildTime;

    if (!buildTime) {
      console.error(
        '[AutoRefresh] ❌ CRITICAL: <meta name="build-time"> not found!\n' +
        'This means version detection will NOT work.\n' +
        'Make sure index.html has: <meta name="build-time" content="<%= buildTime %>" />\n' +
        'And vite.config.js has createHtmlPlugin with buildTime data.'
      );
    } else {
      const dateStr = new Date(Number(buildTime)).toLocaleString();
      console.log(`[AutoRefresh] Local build: ${buildTime} (${dateStr})`);
      console.log(`[AutoRefresh] Platform: ${isNativeRef.current ? 'Native (Capacitor)' : 'Web'}`);
    }

    // ── 1b. Listen for SW update events ──
    // When Workbox detects that precached file hashes changed,
    // it installs a new SW and fires this callback
    onSWNeedRefresh(() => {
      swUpdateReadyRef.current = true;

      // Don't show banner if we just completed a refresh
      // (prevents banner flash right after reload)
      if (sessionStorage.getItem(OTA_SESSION_GUARD)) {
        sessionStorage.removeItem(OTA_SESSION_GUARD);
        console.log('[AutoRefresh] SW update detected, but just refreshed — ignoring');
        return;
      }

      console.log('[AutoRefresh] SW detected new precached content — update available');
      setNeedsRefresh(true);

      // Native OTA redirect ke baad, waiting SW ko auto-activate kar dete hain,
      // taki user ko banner par dobara tap na karna pade.
      try {
        const shouldAutoActivate = localStorage.getItem(OTA_AUTO_ACTIVATE_SW_KEY) === 'true';
        if (shouldAutoActivate) {
          localStorage.removeItem(OTA_AUTO_ACTIVATE_SW_KEY);
          sessionStorage.setItem(OTA_SESSION_GUARD, 'true');

          const root = document.getElementById('root');
          if (root) root.style.display = 'none';

          console.log('[AutoRefresh] Auto-activating waiting SW (OTA redirect flow)');
          activateSWUpdate();
        }
      } catch (e) {
        // Non-fatal — banner-based update hamesha fallback rahega.
        console.warn('[AutoRefresh] Auto-activate SW flag handling failed:', e?.message || e);
      }
    });

    // ── 1c. Clean up session guard from previous refresh ──
    if (sessionStorage.getItem(OTA_SESSION_GUARD)) {
      sessionStorage.removeItem(OTA_SESSION_GUARD);
    }

    // ── 1d. IDEA 4 Success Signal: Clear crash count after 60s of stability ──
    const stabilityTimer = setTimeout(() => {
      console.log('[AutoRefresh] Stability period reached — clearing crash count');
      localStorage.removeItem('ota-crash-count');
    }, 60000);

    return () => clearTimeout(stabilityTimer);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // STEP 2: version.json polling
  //
  // Fetches /version.json from Vercel (native) or same origin (web)
  // and compares buildTime with local meta tag value.
  //
  // This is the PRIMARY detection method for native apps
  // (since the local bundle's SW won't detect Vercel changes).
  // On web, it serves as a backup to SW detection.
  // ═══════════════════════════════════════════════════════════
  const checkForUpdates = useCallback(async () => {
    // ── Guards ──
    if (isRefreshing) return;   // Already updating
    if (isDismissed) return;    // User dismissed banner
    try {
      // Important: early-return cases (offline / freshness-window / missing meta) MUST NOT stop polling.
      const freshnessOk = Date.now() - mountTimeRef.current >= FRESHNESS_WINDOW;
      // Android WebView me `navigator.onLine` kabhi-kabhi false aata hai despite internet.
      // Native (Capacitor) ke liye fetch try karna better hai; errors catch me handle hote hain.
      const shouldFetch = (isNativeRef.current || navigator.onLine !== false) && freshnessOk;

      if (shouldFetch) {
        // Can't compare without local build time
        if (!currentBuildTimeRef.current) {
          console.warn('[AutoRefresh] Skipping check — no local buildTime to compare against');
          return;
        }

        // Native: fetch from Vercel domain
        // Web: fetch from same origin (relative URL), supporting subpaths if any
        const baseUrl = isNativeRef.current
          ? REMOTE_ORIGIN
          : (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

        const response = await fetch(
          `${baseUrl}/version.json?_t=${Date.now()}`,
          {
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const remoteBuildTime = data.buildTime ? String(data.buildTime) : null;
        const changelog = data.changelog || [];
        const priority = data.priority || 'normal';

        // ── Validate remote data ──
        if (!remoteBuildTime) {
          console.warn('[AutoRefresh] Remote version.json has no buildTime field');
          return;
        }

        // ── Compare ──
        const localBuildTime = String(currentBuildTimeRef.current);

        if (remoteBuildTime === localBuildTime) {
          // Same version — no update needed (silent, no log spam)
          return;
        }

        // ── Session guard: don't show if we just refreshed ──
        if (sessionStorage.getItem(OTA_SESSION_GUARD)) {
          return;
        }

        // ── New version detected! ──
        const remoteDate = new Date(Number(remoteBuildTime)).toLocaleString();
        const localDate = new Date(Number(localBuildTime)).toLocaleString();

        console.log(
          '[AutoRefresh] ✨ New version available!\n' +
          `  Remote: ${remoteBuildTime} (${remoteDate})\n` +
          `  Local:  ${localBuildTime} (${localDate})`
        );

        setUpdateInfo({ changelog, priority });
        setNeedsRefresh(true);
      }
    } catch (error) {
      // Non-fatal — will retry on next trigger
      console.warn('[AutoRefresh] Version check failed:', error.message);
    }
  }, [isRefreshing, isDismissed]);

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Start polling + visibility listener
  //
  // - Initial check after ~6.5 seconds (let app settle)
  // - Re-check when tab becomes visible (user returning to app)
  // - Regular interval every 5 minutes
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    // Initial delayed check (Cold Start)
    const initialTimer = setTimeout(checkForUpdates, INITIAL_CHECK_DELAY);

    // ── IDEA 7: Smart Scheduling (Background Return) ──
    // Re-check when user returns to app/tab, but only if some time has passed
    let lastCheckTime = Date.now();

    const handleVisibility = () => {
      if (!document.hidden && navigator.onLine !== false) {
        const now = Date.now();
        const minutesSinceLastCheck = (now - lastCheckTime) / (1000 * 60);

        if (minutesSinceLastCheck >= 30) {
          console.log(`[AutoRefresh] Checking after ${Math.round(minutesSinceLastCheck)}m background duration...`);
          lastCheckTime = now;
          setTimeout(checkForUpdates, 1000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(initialTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForUpdates]);

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Handle "Update" button click
  //
  // NATIVE PATH:
  //   Save Vercel URL → clear caches → redirect
  //   Next cold start: early redirect script handles instant boot
  //
  // WEB PATH:
  //   Activate waiting SW → page reloads with new assets
  //   Or: clear caches + hard reload (fallback)
  // ═══════════════════════════════════════════════════════════
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    // Session guard — prevents banner flash on the reload
    sessionStorage.setItem(OTA_SESSION_GUARD, 'true');

    const isNative = isNativeRef.current;
    
    // ── Detect if we are already running from Vercel ──
    // Even if it's a native APK, if it redirected once, the origin is now Vercel
    const isAlreadyOnRemote = window.location.origin === new URL(REMOTE_ORIGIN).origin;

    try {
      if (isNative) {
        // ═══════════════════════════════════════════
        // ROOT OTA: Mirror Vercel to Localhost
        // ═══════════════════════════════════════════
        console.log('[AutoRefresh] Native update — mirroring Vercel to Localhost...');

        // 1. Tell the SW-Proxy to activate
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.register('/sw-proxy.js', { scope: '/' });
            await reg.update();
            
            // 2. Trigger the "Mirror Now" process
            if (reg.active) {
              reg.active.postMessage({ type: 'MIRROR_NOW' });
            } else if (reg.installing) {
              reg.installing.postMessage({ type: 'MIRROR_NOW' });
            }
            console.log('[AutoRefresh] ✅ SW-Proxy registered and MIRROR_NOW triggered');
            
            // Wait slightly for mirroring to start
            await new Promise(r => setTimeout(r, 800));
          } catch (e) {
            console.error('[AutoRefresh] SW registration failed:', e);
          }
        }

        // 2. Clear flags from any old "Redirect" attempt
        localStorage.removeItem(OTA_TARGET_KEY);
        
        // 3. Mark the new version and reload
        localStorage.setItem(OTA_ACTIVE_VERSION_KEY, updateInfo?.buildTime || 'latest');
        
        console.log('[AutoRefresh] 🚀 Reloading to apply local mirror...');
        window.location.reload();

      } else {
        // ═══════════════════════════════════════════
        // SILENT UPDATE: Web OR Already on Vercel
        // ═══════════════════════════════════════════
        console.log('[AutoRefresh] Silent update (SW/Reload)...');

        if (swUpdateReadyRef.current) {
          console.log('[AutoRefresh] Activating waiting service worker...');
          activateSWUpdate();
        } else {
          console.log('[AutoRefresh] No waiting SW — doing hard reload...');
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
          }
          if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
          }
          await new Promise(resolve => setTimeout(resolve, 300));
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('[AutoRefresh] ❌ Update failed:', error);
      window.location.reload();
    }
  }, [isRefreshing, updateInfo]);

  // ═══════════════════════════════════════════════════════════
  // STEP 5: Dismiss banner
  //
  // User can dismiss the update banner. It won't show again
  // until the next mount (page refresh or app reopen).
  // ═══════════════════════════════════════════════════════════
  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    setNeedsRefresh(false);
    console.log('[AutoRefresh] Banner dismissed by user');
  }, []);

  // ── IDEA 2: Graceful Moments logic ──
  const isSafeRoute = () => {
    try {
      // HashRouter context might not be available if hook used outside provider,
      // but usually App level is safe.
      const path = window.location.hash.replace(/^#/, '') || '/';
      
      // Specifically unsafe prefixes
      if (UNSAFE_UPDATE_PREFIXES.some(prefix => path.startsWith(prefix))) return false;
      
      // Explicitly safe routes
      if (SAFE_UPDATE_ROUTES.includes(path)) return true;
      
      // Default to true for standard pages
      return true;
    } catch (e) { return true; }
  };

  const shouldShowPrompt = needsRefresh && !isDismissed && isSafeRoute();

  // ── Return API ──
  return {
    needsRefresh: shouldShowPrompt,
    handleRefresh,
    handleDismiss,
    checkForUpdates,
    isRefreshing,
    updateInfo,
  };
};