/**
 * useCapacitorPlugins
 *
 * Single hook that sets up all native-device integrations on app mount:
 *  1. StatusBar  → matches dark theme color (#1a1a2e), style DARK
 *  2. Keyboard   → sets resizeOnFullScreen so the webview shrinks, not overlaps
 *
 * Only runs on native Android/iOS (Capacitor.isNativePlatform()).
 */

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useCapacitorPlugins() {
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        // ── StatusBar setup ──────────────────────────────────────────────────────
        const setupStatusBar = async () => {
            try {
                const { StatusBar, Style } = await import('@capacitor/status-bar');

                // Match the app's dark background (#1a1a2e → rgb(26, 26, 46))
                await StatusBar.setBackgroundColor({ color: '#1a1a2e' });

                // DARK style = light text/icons on dark background
                await StatusBar.setStyle({ style: Style.Dark });

                // Make sure it's visible (not hidden)
                await StatusBar.show();
            } catch (err) {
                console.warn('[StatusBar] setup failed:', err);
            }
        };

        // ── Keyboard setup ───────────────────────────────────────────────────────
        const setupKeyboard = async () => {
            try {
                const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');

                // Native resize: the webview viewport shrinks when the keyboard appears.
                // This is the most reliable way to ensure the chat input stays visible.
                await Keyboard.setResizeMode({ mode: KeyboardResize.Native });

                // Disable the iOS-only "accessory bar" (optional, harmless on Android)
                if (Capacitor.getPlatform() === 'ios') {
                    await Keyboard.setAccessoryBarVisible({ isVisible: false });
                }
            } catch (err) {
                console.warn('[Keyboard] setup failed:', err);
            }
        };

        setupStatusBar();
        setupKeyboard();
    }, []);
}
