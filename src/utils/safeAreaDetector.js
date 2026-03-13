/* src/utils/safeAreaDetector.js */
import React from 'react';

/**
 * Singleton class to detect and manage mobile safe area insets.
 * Provides fallbacks for devices where env(safe-area-inset-*) might fail
 * or needs custom adjustments (e.g., Android gesture bars).
 */
let instance = null;

export class SafeAreaDetector {
    constructor() {
        this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
        this.observers = new Set();
        this.resizeTimer = null;
        this.detectInsets();
        this.setupListeners();
    }

    static getInstance() {
        if (!instance) {
            instance = new SafeAreaDetector();
        }
        return instance;
    }

    /**
     * Main detection logic combining CSS environment variables and platform-specific heuristics.
     */
    detectInsets() {
        const computedStyle = getComputedStyle(document.documentElement);

        // Step 1: Standard CSS detection
        const top = this.parsePx(computedStyle.getPropertyValue('--sat')) || 0;
        const bottom = this.parsePx(computedStyle.getPropertyValue('--sab')) || 0;
        const left = this.parsePx(computedStyle.getPropertyValue('--sal')) || 0;
        const right = this.parsePx(computedStyle.getPropertyValue('--sar')) || 0;

        this.insets = { top, bottom, left, right };

        // Step 2: Capacitor detection (if available)
        if (this.isCapacitor()) {
            this.detectCapacitorInsets();
        }

        // Step 3: Platform specific heuristics as fallbacks
        if (this.isAndroid()) {
            this.detectAndroidInsets();
        } else if (this.isiPhone()) {
            this.detectiPhoneModel();
        }

        this.applyCSSVariables();
        this.notifyObservers();
    }

    parsePx(value) {
        if (!value) return 0;
        return parseFloat(value.replace('px', '')) || 0;
    }

    isCapacitor() {
        return !!window.Capacitor;
    }

    isAndroid() {
        return /Android/i.test(navigator.userAgent);
    }

    isiPhone() {
        return /iPhone/i.test(navigator.userAgent);
    }

    async detectCapacitorInsets() {
        // Skipping @capacitor/safe-area as it is not listed in dependencies.
        // Fallbacks (CSS env and heuristics) are active.
        return;
    }

    detectAndroidInsets() {
        // Detect Android gesture navigation bar (usually ~16-24px if active)
        const ratio = window.screen.availHeight / window.screen.height;
        const hasGestureNav = ratio > 0.95 && ratio < 1.0;

        if (hasGestureNav) {
            this.insets.bottom = Math.max(this.insets.bottom, 16);
        }

        // Detect punch-hole cameras (approximate based on resolution and ratio)
        const isHighRes = window.screen.height > 2000 && window.devicePixelRatio >= 3;
        if (isHighRes && this.insets.top < 24) {
            this.insets.top = Math.max(this.insets.top, 30);
        }
    }

    detectiPhoneModel() {
        const screenHeight = window.screen.height;
        const screenWidth = window.screen.width;
        const ratio = window.devicePixelRatio;

        // iPhone notch/dynamic island detection based on screen dimensions
        // These values are standard for current iOS devices.
        const models = {
            // iPhone 14 Pro/Pro Max (Dynamic Island)
            '932x430': { top: 59, bottom: 34, left: 0, right: 0 },
            '926x428': { top: 59, bottom: 34, left: 0, right: 0 },

            // iPhone 14 / 13 / 12 series
            '844x390': { top: 47, bottom: 34, left: 0, right: 0 },
            '896x414': { top: 48, bottom: 34, left: 0, right: 0 },
            '812x375': { top: 44, bottom: 34, left: 0, right: 0 }
        };

        const key = `${screenHeight}x${screenWidth}`;
        const detectedModel = models[key];

        if (detectedModel && ratio >= 2) {
            // Only apply if detectModel top is larger than current (env) top
            if (detectedModel.top > this.insets.top) {
                this.insets = { ...detectedModel };
            }
        }
    }

    applyCSSVariables() {
        const root = document.documentElement;
        root.style.setProperty('--custom-sat', `${this.insets.top}px`);
        root.style.setProperty('--custom-sab', `${this.insets.bottom}px`);
        root.style.setProperty('--custom-sal', `${this.insets.left}px`);
        root.style.setProperty('--custom-sar', `${this.insets.right}px`);
    }

    setupListeners() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.detectInsets(), 150);
        });

        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimer);
            this.resizeTimer = setTimeout(() => this.detectInsets(), 200);
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.detectInsets();
            }
        });

        // Handle Visual Viewport changes (useful for keyboard handling in tandem)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                this.detectInsets();
            });
        }
    }

    getInsets() {
        return { ...this.insets };
    }

    subscribe(callback) {
        this.observers.add(callback);
        callback(this.getInsets()); // Initial call
        return () => {
            this.observers.delete(callback);
        };
    }

    notifyObservers() {
        this.observers.forEach(callback => callback(this.getInsets()));
    }
}

/**
 * React Hook to access current safe area insets.
 */
export function useSafeArea() {
    const [insets, setInsets] = React.useState(
        SafeAreaDetector.getInstance().getInsets()
    );

    React.useEffect(() => {
        const detector = SafeAreaDetector.getInstance();
        return detector.subscribe(setInsets);
    }, []);

    return insets;
}
