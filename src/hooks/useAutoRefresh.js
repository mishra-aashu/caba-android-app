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

// ── Remote Origin ──
// This is where your app is deployed on Vercel
const REMOTE_ORIGIN = 'https://caba-android-app.vercel.app';

export const useAutoRefresh = () => {
  // ── State ──
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

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
    });

    // ── 1c. Clean up session guard from previous refresh ──
    if (sessionStorage.getItem(OTA_SESSION_GUARD)) {
      sessionStorage.removeItem(OTA_SESSION_GUARD);
    }
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
      const online = navigator.onLine !== false; // Treat "undefined" as "maybe online"
      const freshnessOk = Date.now() - mountTimeRef.current >= FRESHNESS_WINDOW;

      if (online && freshnessOk) {
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

        setNeedsRefresh(true);
      }
    } catch (error) {
      // Non-fatal — will retry on next interval
      console.warn('[AutoRefresh] Version check failed:', error.message);
    } finally {
      // ── Schedule next check ──
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = setTimeout(checkForUpdates, VERSION_CHECK_INTERVAL);
    }
  }, [isRefreshing, isDismissed]);

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Start polling + visibility listener
  //
  // - Initial check after 4 seconds (let app settle)
  // - Re-check when tab becomes visible (user returning to app)
  // - Regular interval every 5 minutes
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    // Initial delayed check
    const initialTimer = setTimeout(checkForUpdates, INITIAL_CHECK_DELAY);

    // Re-check when user returns to app/tab
    const handleVisibility = () => {
      if (!document.hidden && navigator.onLine !== false) {
        // Small delay to avoid check during tab-switch animation
        setTimeout(checkForUpdates, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Cleanup
    return () => {
      clearTimeout(initialTimer);
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
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
      if (isNative && !isAlreadyOnRemote) {
        // ═══════════════════════════════════════════
        // INITIAL REDIRECT: Local → Vercel
        // ═══════════════════════════════════════════
        console.log('[AutoRefresh] Native update — initial switch to Vercel...');

        const targetUrl = REMOTE_ORIGIN + '/';

        // 1. Save in localStorage (READ by early redirect script in index.html)
        //    This is the PRIMARY storage — synchronous, fast, reliable
        localStorage.setItem(OTA_TARGET_KEY, targetUrl);
        console.log('[AutoRefresh] ✅ Target URL saved in localStorage');

        // 2. Also persist in Capacitor Preferences (backup — survives app data clear)
        // AND handle session migration (allows staying logged in on Vercel)
        try {
          const { Preferences } = await import('@capacitor/preferences');
          await Preferences.set({ key: OTA_TARGET_KEY, value: targetUrl });
          
          // --- session migration ---
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await Preferences.set({ 
              key: 'ota-migrated-session', 
              value: JSON.stringify(session) 
            });
            console.log('[AutoRefresh] ✅ Session migrated to Preferences');
          }
          // -------------------------

          console.log('[AutoRefresh] ✅ Target URL backed up in Capacitor Preferences');
        } catch (e) {
          // Not critical — localStorage is primary
          console.warn('[AutoRefresh] Preferences backup failed (non-critical):', e.message);
        }

        // 3. Unregister local SW (no longer needed — Vercel has its own)
        if ('serviceWorker' in navigator) {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(r => r.unregister()));
            console.log('[AutoRefresh] ✅ Local service workers unregistered');
          } catch (e) {
            console.warn('[AutoRefresh] SW unregister failed:', e.message);
          }
        }

        // 4. Clear local caches (free up storage)
        if ('caches' in window) {
          try {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
            console.log('[AutoRefresh] ✅ Local caches cleared');
          } catch (e) {
            console.warn('[AutoRefresh] Cache clear failed:', e.message);
          }
        }

        // 5. Brief delay for UI to show "Updating..." state
        await new Promise(resolve => setTimeout(resolve, 600));

        // 6. Redirect!
        // On Vercel: new SW will register and cache everything for offline
        console.log('[AutoRefresh] 🚀 Redirecting to:', targetUrl);
        window.location.replace(targetUrl);

      } else {
        // ═══════════════════════════════════════════
        // SILENT UPDATE: Web OR Already on Vercel
        // ═══════════════════════════════════════════
        console.log('[AutoRefresh] Silent update (SW/Reload)...');

        if (swUpdateReadyRef.current) {
          // Best case: SW has new version waiting — activate it
          // registerSW's controllerchange handler will reload the page
          console.log('[AutoRefresh] Activating waiting service worker...');
          activateSWUpdate();
          // Page will reload automatically after SW activation
        } else {
          // Fallback: No waiting SW (maybe detected via version.json only)
          // Clean everything and hard reload
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
      // Ultimate fallback — just reload and hope for the best
      window.location.reload();
    }
  }, [isRefreshing]);

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

  // ── Return API ──
  return {
    needsRefresh: needsRefresh && !isDismissed,
    handleRefresh,
    handleDismiss,
    checkForUpdates,
    isRefreshing,
  };
};