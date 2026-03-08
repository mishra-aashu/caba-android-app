import { useEffect, useState, useRef } from 'react';

/**
 * Hook to detect new deployments based on build-time meta tag
 */
export const useAutoRefresh = () => {
  const [needsRefresh, setNeedsRefresh] = useState(false);
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
        // FIX: Always fetch root "/" so SPA servers return index.html
        const response = await fetch(`/?_cb=${Date.now()}`, {
          cache: 'no-store',
          headers: { Accept: 'text/html' },
        });

        if (!response.ok) return;

        const html = await response.text();

        const match = html.match(/name="build-time"\s+content="([^"]+)"/);
        const latestBuildTime = match ? match[1] : null;

        if (latestBuildTime && latestBuildTime !== currentBuildTimeRef.current) {
          console.log('[AutoRefresh] New build detected:', latestBuildTime);
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
    const currentBuildTime = document.querySelector('meta[name="build-time"]')?.content;
    if (currentBuildTime) {
      localStorage.setItem('app-build-time', currentBuildTime);
    }
    // FIX: Clear service worker caches before reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    // FIX: reload(true) is deprecated — use reload() with cache headers
    window.location.reload();
  };

  return { needsRefresh, handleRefresh };
};