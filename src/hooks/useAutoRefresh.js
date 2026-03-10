import { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to detect new deployments based on build-time meta tag
 */
export const useAutoRefresh = () => {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [latestVersion, setLatestVersion] = useState(null);
  const currentBuildTimeRef = useRef(null);

  useEffect(() => {
    // Get current build time from meta tag
    const metaTag = document.querySelector('meta[name="build-time"]');
    const currentBuildTime = metaTag?.content || null;
    currentBuildTimeRef.current = currentBuildTime;

    if (!currentBuildTime) {
      console.warn('[AutoRefresh] No build-time meta tag found');
      return;
    }

    // Store in localStorage on first load
    const storedBuildTime = localStorage.getItem('app-build-time');

    if (!storedBuildTime) {
      localStorage.setItem('app-build-time', currentBuildTime);
    } else if (storedBuildTime !== currentBuildTime) {
      setNeedsRefresh(true);
    }

    const checkForUpdates = async () => {
      try {
        const isNative = Capacitor.isNativePlatform();
        const updateUrl = isNative
          ? 'https://caba-android-app.vercel.app/'
          : '/';

        console.log(`[AutoRefresh] Checking for updates at: ${updateUrl}`);

        const response = await fetch(`${updateUrl}?_cb=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Accept': 'text/html'
          },
        });

        if (!response.ok) {
          console.warn('[AutoRefresh] Update check failed with status:', response.status);
          return;
        }

        const html = await response.text();

        // More robust regex for meta tag detection
        const match = html.match(/<meta[^>]+name=["']build-time["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']build-time["']/i);

        const latestBuildTime = match ? match[1] : null;

        if (latestBuildTime && latestBuildTime !== currentBuildTimeRef.current) {
          // Extra guard for native: if they've already seen THIS specific build time, don't nag
          const lastSeenBuildTime = localStorage.getItem('app-last-seen-build-time');
          if (isNative && lastSeenBuildTime === latestBuildTime) {
            console.log('[AutoRefresh] New build available but already seen by user:', latestBuildTime);
            return;
          }

          console.log('[AutoRefresh] New build detected! Remote:', latestBuildTime, 'Local:', currentBuildTimeRef.current);
          setLatestVersion(latestBuildTime);
          setNeedsRefresh(true);
        } else {
          console.log('[AutoRefresh] No new build detected. Current:', currentBuildTimeRef.current);
        }
      } catch (error) {
        console.error('[AutoRefresh] Update check failed:', error);
      }
    };

    // Check every 10 minutes
    const interval = setInterval(checkForUpdates, 10 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[AutoRefresh] App visible, checking for updates...');
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial check on mount after a small delay
    setTimeout(checkForUpdates, 3000);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleRefresh = async () => {
    console.log('[AutoRefresh] Refreshing app to load new build...');
    const versionToMark = latestVersion || document.querySelector('meta[name="build-time"]')?.content;

    if (versionToMark) {
      localStorage.setItem('app-last-seen-build-time', versionToMark);
      localStorage.setItem('app-build-time', versionToMark);
    }

    // Thorough cache clearing
    if ('caches' in window) {
      try {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
        console.log('[AutoRefresh] Caches cleared successfully');
      } catch (e) {
        console.error('[AutoRefresh] Error clearing caches:', e);
      }
    }

    // Unregister service workers as well
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log('[AutoRefresh] Service workers unregistered');
      } catch (e) {
        console.error('[AutoRefresh] Service worker unregistration failed:', e);
      }
    }

    if (Capacitor.isNativePlatform()) {
      window.location.href = 'https://caba-android-app.vercel.app/';
    } else {
      window.location.reload(true);
    }
  };

  return { needsRefresh, handleRefresh };
};