/**
 * useCapacitorPlugins
 *
 * Single hook that sets up all native-device integrations on app mount:
 *  1. StatusBar  → matches dark theme color (#1a1a2e), style DARK
 *  2. Keyboard   → sets resizeOnFullScreen so the webview shrinks, not overlaps
 *
 * Uses isNativeWithPlugins() instead of Capacitor.isNativePlatform()
 * → Only runs when plugins ACTUALLY work (localhost, not Vercel)
 * → After OTA redirect to Vercel, plugins are NOT available — safely skipped
 */

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins } from '../utils/platformCheck';

export function useCapacitorPlugins() {
  useEffect(() => {
    if (!isNativeWithPlugins()) return;

    // ── StatusBar setup ──
    const setupStatusBar = async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');

        // Match the app's dark background (#1a1a2e)
        await StatusBar.setBackgroundColor({ color: '#1a1a2e' });

        // DARK style = light text/icons on dark background
        await StatusBar.setStyle({ style: Style.Dark });

        // Make sure it's visible (not hidden)
        await StatusBar.show();
      } catch (err) {
        console.warn('[StatusBar] setup failed:', err.message);
      }
    };

    // ── Keyboard setup ──
    const setupKeyboard = async () => {
      try {
        const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');

        // Native resize: webview viewport shrinks when keyboard appears
        await Keyboard.setResizeMode({ mode: KeyboardResize.Native });

        // Disable iOS-only accessory bar (harmless if not iOS)
        if (Capacitor.getPlatform() === 'ios') {
          await Keyboard.setAccessoryBarVisible({ isVisible: false });
        }
      } catch (err) {
        console.warn('[Keyboard] setup failed:', err.message);
      }
    };

    setupStatusBar();
    setupKeyboard();
  }, []);
}