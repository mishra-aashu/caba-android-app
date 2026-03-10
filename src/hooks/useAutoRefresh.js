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
        // FIX: If running on native (Capacitor), fetch from Vercel to detect new builds
        // If on web, use relative path
        const isNative = Capacitor.isNativePlatform();
        const updateUrl = isNative
          ? 'https://caba-android-app.vercel.app/'
          : '/';

        const response = await fetch(`${updateUrl}?_cb=${Date.now()}`, {
          cache: 'no-store',
          headers: { Accept: 'text/html' },
        });

        if (!response.ok) return;

        const html = await response.text();

        const match = html.match(/name="build-time"\s+content="([^"]+)"/);
        const latestBuildTime = match ? match[1] : null;

        if (latestBuildTime && latestBuildTime !== currentBuildTimeRef.current) {
          // Extra guard for native: if they've already seen THIS specific build time, don't nag
          const lastSeenBuildTime = localStorage.getItem('app-last-seen-build-time');
          if (isNative && lastSeenBuildTime === latestBuildTime) {
            return;
          }

          console.log('[AutoRefresh] New build detected:', latestBuildTime);
          setLatestVersion(latestBuildTime);
          setNeedsRefresh(true);
        }
      } catch (error) {
        console.error('[AutoRefresh] Update check failed:', error);
      }
    };

    // Check every 10 minutes
    const interval = setInterval(checkForUpdates, 10 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleRefresh = () => {
    // Priority: 1. latestVersion from state (detected), 2. meta tag (current)
    const versionToMark = latestVersion || document.querySelector('meta[name="build-time"]')?.content;

    // Store that we've seen this version to avoid infinite nagging if reload fails to update
    if (versionToMark) {
      localStorage.setItem('app-last-seen-build-time', versionToMark);
      localStorage.setItem('app-build-time', versionToMark);
    }

    // FIX: Clear service worker caches before reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    if (Capacitor.isNativePlatform()) {
      // For native, we redirect to Vercel to load the newest version
      // This allows the app to "self-update" to the latest web build
      window.location.href = 'https://caba-android-app.vercel.app/';
    } else {
      window.location.reload();
    }
  };

  return { needsRefresh, handleRefresh };
};