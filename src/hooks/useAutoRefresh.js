import { useEffect, useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const RETRY_INTERVAL_MIN = 30 * 1000; // 30 seconds
const RETRY_INTERVAL_MAX = 5 * 60 * 1000; // 5 minutes
const FRESHNESS_WINDOW = 5000; // 5 seconds ignore on mount

/**
 * Hook to detect new deployments based on a dedicated /version.json endpoint.
 * Implements professional reload patterns including SW unregistration and session guards.
 */
export const useAutoRefresh = () => {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestVersion, setLatestVersion] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  
  const currentBuildTimeRef = useRef(null);
  const retryCountRef = useRef(0);
  const checkTimeoutRef = useRef(null);
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    // Get current build time from meta tag
    const metaTag = document.querySelector('meta[name="build-time"]');
    currentBuildTimeRef.current = metaTag?.content || null;

    // Guard: If we just reloaded in this session, don't show the banner immediately
    const hasReloaded = sessionStorage.getItem('app-refresh-executed');
    if (hasReloaded) {
      console.log('[AutoRefresh] Refresh already executed in this session');
      setNeedsRefresh(false);
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    // Skip if already in middle of refresh, dismissed, or offline
    if (isRefreshing || isDismissed || !navigator.onLine) return;
    
    // Skip if we just mounted (avoid CDN lag false positives)
    if (Date.now() - mountTimeRef.current < FRESHNESS_WINDOW) return;

    try {
      const isNative = Capacitor.isNativePlatform();
      const updateUrl = isNative
        ? `https://caba-android-app.vercel.app/version.json?_cb=${Date.now()}`
        : `/version.json?_cb=${Date.now()}`;

      const response = await fetch(updateUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Accept': 'application/json'
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const latestBuildTime = data.buildTime ? String(data.buildTime) : null;

      if (latestBuildTime && latestBuildTime !== currentBuildTimeRef.current) {
        // Final guard before showing UI
        if (sessionStorage.getItem('app-refresh-executed')) return;

        console.log('[AutoRefresh] New build detected! Remote:', latestBuildTime, 'Local:', currentBuildTimeRef.current);
        setLatestVersion(latestBuildTime);
        setNeedsRefresh(true);
        retryCountRef.current = 0; // Reset backoff
      }
    } catch (error) {
      console.warn('[AutoRefresh] Update check failed:', error.message);
      
      // Exponential backoff for failed checks
      retryCountRef.current++;
      const nextDelay = Math.min(
        RETRY_INTERVAL_MIN * Math.pow(1.5, retryCountRef.current),
        RETRY_INTERVAL_MAX
      );
      
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = setTimeout(checkForUpdates, nextDelay);
      return;
    }

    // Schedule next regular check
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    checkTimeoutRef.current = setTimeout(checkForUpdates, VERSION_CHECK_INTERVAL);
  }, [isRefreshing, isDismissed]);

  useEffect(() => {
    // Polling setup
    const initialCheck = setTimeout(checkForUpdates, 3000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialCheck);
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForUpdates]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    console.log('[AutoRefresh] Starting professional refresh...');

    // 1. Set session guard to avoid banner flash on reload
    sessionStorage.setItem('app-refresh-executed', 'true');
    
    // 2. Sync local build time to match the incoming one
    if (latestVersion) {
      localStorage.setItem('app-build-time', latestVersion);
      localStorage.setItem('app-last-seen-build-time', latestVersion);
    }

    try {
      // 3. Unregister SWs (Crucial to prevent caching stale content)
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log('[AutoRefresh] Service workers removed');
      }

      // 4. Clear browser caches
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
        console.log('[AutoRefresh] Caches cleared');
      }
    } catch (e) {
      console.error('[AutoRefresh] Cleanup error:', e);
    }

    // 5. Brief delay for UI to show "Updating..." state
    setTimeout(() => {
      if (Capacitor.isNativePlatform()) {
        window.location.href = 'https://caba-android-app.vercel.app/';
      } else {
        window.location.reload(true);
      }
    }, 800);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setNeedsRefresh(false);
  };

  return { 
    needsRefresh: needsRefresh && !isDismissed, 
    handleRefresh, 
    handleDismiss,
    isRefreshing 
  };
};