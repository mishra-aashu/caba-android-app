import { useEffect, useState } from 'react';

/**
 * Hook to detect new deployments based on build-time meta tag.
 * Polling index.html periodically to check for timestamp changes.
 */
export const useAutoRefresh = () => {
    const [needsRefresh, setNeedsRefresh] = useState(false);

    useEffect(() => {
        // Get current build time from meta tag
        const currentBuildTime = document.querySelector('meta[name="build-time"]')?.content;

        // Store in localStorage on first load if not present
        const storedBuildTime = localStorage.getItem('app-build-time');

        if (!storedBuildTime && currentBuildTime) {
            localStorage.setItem('app-build-time', currentBuildTime);
        } else if (storedBuildTime && currentBuildTime && storedBuildTime !== currentBuildTime) {
            // Build time changed in current session (unlikely but possible if reloaded)
            setNeedsRefresh(true);
        }

        const checkForUpdates = async () => {
            try {
                // Fetch index.html with cache-busting to get the latest version
                const response = await fetch(`${window.location.origin}${window.location.pathname}?t=${Date.now()}`, {
                    cache: 'no-store'
                });
                const html = await response.text();

                // Extract build-time from fetched HTML (regex for robustness)
                const match = html.match(/name="build-time" content="([^"]+)"/);
                const latestBuildTime = match ? match[1] : null;

                if (latestBuildTime && latestBuildTime !== currentBuildTime) {
                    console.log('[AutoRefresh] New build detected:', latestBuildTime);
                    setNeedsRefresh(true);
                }
            } catch (error) {
                console.error('[AutoRefresh] Update check failed:', error);
            }
        };

        // Check every 10 minutes
        const interval = setInterval(checkForUpdates, 10 * 60 * 1000);

        // Also check when user returns to the tab
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
        // Force reload ignoring cache
        window.location.reload(true);
    };

    return { needsRefresh, handleRefresh };
};
