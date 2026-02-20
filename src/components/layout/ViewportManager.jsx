import React, { useEffect } from 'react';

/**
 * ViewportManager handles the dynamic viewport height (--vh) to fix 100vh issues on mobile browsers.
 * It also sets safe area variables and detects standalone mode.
 */
const ViewportManager = () => {
    useEffect(() => {
        const updateViewport = () => {
            // Get the actual viewport height (excluding browser chrome)
            // Dividing by 100 and setting it as --vh allows us to use 100 * var(--vh) in CSS
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);

            // Detect if the app is running in standalone mode (PWA)
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone ||
                document.referrer.includes('android-app://');

            document.documentElement.setAttribute('data-standalone', isStandalone ? 'true' : 'false');
        };

        // Initial run
        updateViewport();

        // Listen for resize and orientation changes
        window.addEventListener('resize', updateViewport);
        window.addEventListener('orientationchange', updateViewport);

        return () => {
            window.removeEventListener('resize', updateViewport);
            window.removeEventListener('orientationchange', updateViewport);
        };
    }, []);

    return null; // This component doesn't render anything
};

export default ViewportManager;
