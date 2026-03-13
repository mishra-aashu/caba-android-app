/* src/utils/keyboardHandler.js */
import React from 'react';

/**
 * Singleton class to detect and manage keyboard open/close states.
 * Works for iOS (Visual Viewport) and Android (Window Resize fallback).
 * Integrates with @capacitor/keyboard if available.
 */
let instance = null;

export class KeyboardHandler {
    constructor() {
        this.isKeyboardOpen = false;
        this.keyboardHeight = 0;
        this.observers = new Set();
        this.setupListeners();
    }

    static getInstance() {
        if (!instance) {
            instance = new KeyboardHandler();
        }
        return instance;
    }

    setupListeners() {
        // 1. Capacitor Keyboard detection (preferred on Native)
        if (this.isNative()) {
            this.setupCapacitorKeyboard();
        }

        // 2. iOS Visual Viewport resizing
        if (this.isiOS() && window.visualViewport) {
            this.setupiOSKeyboardDetection();
        }

        // 3. Android / Universal Resize fallback (DISABLED ON NATIVE)
        if (this.isAndroid() && !this.isNative()) {
            this.setupAndroidKeyboardDetection();
        }
    }

    isNative() {
        return window.Capacitor && window.Capacitor.getPlatform() !== 'web';
    }

    isiOS() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    isAndroid() {
        return /Android/i.test(navigator.userAgent);
    }

    async setupCapacitorKeyboard() {
        try {
            // Further platform check to be absolutely safe
            if (!this.isNative()) return;

            const { Keyboard } = await import('@capacitor/keyboard').catch(() => ({}));

            // On some platforms, the plugin might be visible but all methods throw "Not Implemented"
            if (Keyboard && Keyboard.addListener) {
                // Wrap in another try-catch to handle "Not Implemented" exceptions
                try {
                    Keyboard.addListener('keyboardWillShow', (info) => {
                        this.notifyKeyboardChange(true, info.keyboardHeight);
                    });

                    Keyboard.addListener('keyboardWillHide', () => {
                        this.notifyKeyboardChange(false, 0);
                    });

                    // Only attempt this if we are likely on a native platform that supports it
                    if (this.isiOS() || this.isAndroid()) {
                        Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => { });
                    }
                } catch (e) {
                    console.warn('Keyboard listeners could not be attached:', e);
                }
            }
        } catch (error) {
            console.warn('Capacitor Keyboard not available:', error);
        }
    }

    setupiOSKeyboardDetection() {
        let lastHeight = window.visualViewport.height;

        window.visualViewport.addEventListener('resize', () => {
            const currentHeight = window.visualViewport.height;
            const diff = lastHeight - currentHeight;

            if (diff > 120) {
                // Keyboard opened
                this.notifyKeyboardChange(true, diff);
            } else if (diff < -120) {
                // Keyboard closed
                this.notifyKeyboardChange(false, 0);
            }

            lastHeight = currentHeight;
        });
    }

    setupAndroidKeyboardDetection() {
        let lastHeight = window.innerHeight;

        window.addEventListener('resize', () => {
            const currentHeight = window.innerHeight;
            const diff = lastHeight - currentHeight;

            // Threshold of 150px to distinguish from small UI changes
            if (diff > 150) {
                this.notifyKeyboardChange(true, diff);
            } else if (diff < -150) {
                this.notifyKeyboardChange(false, 0);
            }

            lastHeight = currentHeight;
        });
    }

    notifyKeyboardChange(isOpen, height) {
        this.isKeyboardOpen = isOpen;
        this.keyboardHeight = height;

        // Apply global CSS variable for other components to consume
        document.documentElement.style.setProperty('--keyboard-height', `${height}px`);

        // Add document level class for styling hooks
        if (isOpen) {
            document.body.classList.add('keyboard-open');
        } else {
            document.body.classList.remove('keyboard-open');
        }

        this.notifyObservers();
    }

    getKeyboardHeight() {
        return this.keyboardHeight;
    }

    isOpen() {
        return this.isKeyboardOpen;
    }

    subscribe(callback) {
        this.observers.add(callback);
        callback({ isOpen: this.isKeyboardOpen, height: this.keyboardHeight });
        return () => {
            this.observers.delete(callback);
        };
    }

    notifyObservers() {
        this.observers.forEach(callback => callback({
            isOpen: this.isKeyboardOpen,
            height: this.keyboardHeight
        }));
    }
}

/**
 * React Hook to track keyboard state.
 */
export function useKeyboard() {
    const [state, setState] = React.useState({
        isOpen: KeyboardHandler.getInstance().isOpen(),
        height: KeyboardHandler.getInstance().getKeyboardHeight()
    });

    React.useEffect(() => {
        const handler = KeyboardHandler.getInstance();
        return handler.subscribe(setState);
    }, []);

    return state;
}
