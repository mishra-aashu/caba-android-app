import React, { useEffect } from 'react';

/**
 * ViewportManager handles the dynamic viewport height to fix 100vh issues on mobile browsers.
 * Uses the Visual Viewport API to detect keyboard appearance and adjust layout accordingly.
 * Also sets safe area variables and detects standalone mode.
 */
const ViewportManager = () => {
    useEffect(() => {
        // Store initial window height to calculate keyboard height
        let initialWindowHeight = window.innerHeight;
        
        const updateViewport = () => {
            // Get the actual viewport height from Visual Viewport API
            // This is more reliable than window.innerHeight for keyboard detection
            const visualViewport = window.visualViewport;
            const currentHeight = visualViewport ? visualViewport.height : window.innerHeight;
            
            // Update --app-height CSS variable with dynamic viewport height
            document.documentElement.style.setProperty('--app-height', `${currentHeight}px`);
            
            // Calculate keyboard height (difference between initial and current)
            // Only set if keyboard is likely open (height difference > 100px)
            const keyboardHeight = Math.max(0, initialWindowHeight - currentHeight);
            if (keyboardHeight > 100) {
                document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
            } else {
                document.documentElement.style.setProperty('--keyboard-height', '0px');
            }

            // Also update --vh for legacy support
            const vh = currentHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);

            // Detect if the app is running in standalone mode (PWA)
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone ||
                document.referrer.includes('android-app://');

            document.documentElement.setAttribute('data-standalone', isStandalone ? 'true' : 'false');
        };

        // Initial run
        updateViewport();

        // Visual Viewport API - more reliable than resize for keyboard detection
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateViewport);
            window.visualViewport.addEventListener('scroll', updateViewport);
        }
        
        // Fallback for older browsers
        window.addEventListener('resize', updateViewport);
        window.addEventListener('orientationchange', updateViewport);

        // Handle orientation change - recalculate initial height after orientation
        const handleOrientationChange = () => {
            // Delay to allow browser to complete orientation change
            setTimeout(() => {
                initialWindowHeight = window.innerHeight;
                updateViewport();
            }, 100);
        };
        window.addEventListener('orientationchange', handleOrientationChange);

        return () => {
            // Clean up all event listeners
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', updateViewport);
                window.visualViewport.removeEventListener('scroll', updateViewport);
            }
            window.removeEventListener('resize', updateViewport);
            window.removeEventListener('orientationchange', updateViewport);
            window.removeEventListener('orientationchange', handleOrientationChange);
        };
    }, []);

    return null; // This component doesn't Render anything
};

export default ViewportManager;
