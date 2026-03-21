/**
 * useAutoRefresh.js
 *
 * Detects new Vercel deploys and handles update.
 *
 * NATIVE (localhost):
 *   Detection: version.json polling from Vercel
 *   Update: Save redirect URL → clear caches → redirect to Vercel
 *
 * WEB (Vercel domain, after redirect):
 *   Detection: SW events + version.json polling
 *   Update: Activate waiting SW → page reloads with new code
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { onSWNeedRefresh, activateSWUpdate } from '../pwa';
import { isNativeWithPlugins } from '../utils/platformCheck';

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000;
const INITIAL_CHECK_DELAY = 4000;
const FRESHNESS_WINDOW = 5000;

const OTA_TARGET_KEY = 'ota-target-url';
const OTA_SESSION_GUARD = 'ota-just-refreshed';
const REMOTE_ORIGIN = 'https://caba-android-app.vercel.app';

export const useAutoRefresh = () => {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const currentBuildTimeRef = useRef(null);
  const checkTimeoutRef = useRef(null);
  const mountTimeRef = useRef(Date.now());
  const swUpdateReadyRef = useRef(false);

  // Detect if we're on local Capacitor bundle
  const isLocalNativeRef = useRef(isNativeWithPlugins());

  // ─── Initialize ───
  useEffect(() => {
    const metaTag = document.querySelector('meta[name="build-time"]');
    currentBuildTimeRef.current = metaTag?.content || null;

    if (!currentBuildTimeRef.current) {
      console.error('[AutoRefresh] No <meta name="build-time"> found!');
    } else {
      console.log('[AutoRefresh] Local build:', currentBuildTimeRef.current);
    }

    // Listen for SW update events (only fires on Vercel domain)
    onSWNeedRefresh(() => {
      swUpdateReadyRef.current = true;
      if (sessionStorage.getItem(OTA_SESSION_GUARD)) {
        sessionStorage.removeItem(OTA_SESSION_GUARD);
        return;
      }
      console.log('[AutoRefresh] SW detected new content');
      setNeedsRefresh(true);
    });

    if (sessionStorage.getItem(OTA_SESSION_GUARD)) {
      sessionStorage.removeItem(OTA_SESSION_GUARD);
    }
  }, []);

  // ─── version.json polling ───
  const checkForUpdates = useCallback(async () => {
    if (isRefreshing || isDismissed || !navigator.onLine) return;
    if (Date.now() - mountTimeRef.current < FRESHNESS_WINDOW) return;
    if (!currentBuildTimeRef.current) return;

    try {
      // On local native: fetch from Vercel
      // On Vercel domain: fetch from same origin
      const baseUrl = isLocalNativeRef.current ? REMOTE_ORIGIN : '';

      const response = await fetch(
        `${baseUrl}/version.json?_t=${Date.now()}`,
        { cache: 'no-store' }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const remoteBuildTime = data.buildTime ? String(data.buildTime) : null;

      if (!remoteBuildTime) return;
      if (remoteBuildTime === String(currentBuildTimeRef.current)) return;
      if (sessionStorage.getItem(OTA_SESSION_GUARD)) return;

      console.log(
        '[AutoRefresh] ✨ New version!\n' +
        `  Remote: ${remoteBuildTime}\n` +
        `  Local:  ${currentBuildTimeRef.current}`
      );
      setNeedsRefresh(true);

    } catch (error) {
      console.warn('[AutoRefresh] Check failed:', error.message);
    }

    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    checkTimeoutRef.current = setTimeout(checkForUpdates, VERSION_CHECK_INTERVAL);
  }, [isRefreshing, isDismissed]);

  // ─── Start polling ───
  useEffect(() => {
    const timer = setTimeout(checkForUpdates, INITIAL_CHECK_DELAY);

    const onVisible = () => {
      if (!document.hidden && navigator.onLine) {
        setTimeout(checkForUpdates, 1000);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(timer);
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [checkForUpdates]);

  // ─── Handle Update Click ───
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    sessionStorage.setItem(OTA_SESSION_GUARD, 'true');

    try {
      if (isLocalNativeRef.current) {
        // ══════════════════════════════════════
        // NATIVE LOCAL → Redirect to Vercel
        // ══════════════════════════════════════
        console.log('[AutoRefresh] Redirecting to Vercel...');

        const targetUrl = REMOTE_ORIGIN + '/';

        // Save in localStorage (read by early redirect script)
        localStorage.setItem(OTA_TARGET_KEY, targetUrl);

        // Backup in Capacitor Preferences (only if available)
        await safePluginCall(async () => {
          const { Preferences } = await import('@capacitor/preferences');
          await Preferences.set({ key: OTA_TARGET_KEY, value: targetUrl });
        });

        // Clear any existing SW + caches on localhost
        if ('serviceWorker' in navigator) {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
          } catch (e) {}
        }
        if ('caches' in window) {
          try {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
          } catch (e) {}
        }

        // Brief delay for UI feedback
        await new Promise(r => setTimeout(r, 600));

        // REDIRECT — Vercel serves new index.html with new hashed files
        window.location.replace(targetUrl);

      } else {
        // ══════════════════════════════════════
        // ON VERCEL → Activate new SW or reload
        // ══════════════════════════════════════
        console.log('[AutoRefresh] Web update...');

        if (swUpdateReadyRef.current) {
          // SW has new version waiting → activate it
          activateSWUpdate();
          // Page reloads automatically after SW activation
        } else {
          // Fallback: clear caches and hard reload
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
          }
          if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
          }
          await new Promise(r => setTimeout(r, 300));
          window.location.reload();
        }
      }

    } catch (error) {
      console.error('[AutoRefresh] Failed:', error);
      window.location.reload();
    }
  }, [isRefreshing]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    setNeedsRefresh(false);
  }, []);

  return {
    needsRefresh: needsRefresh && !isDismissed,
    handleRefresh,
    handleDismiss,
    checkForUpdates,
    isRefreshing,
  };
};