/**
 * platformCheck.js
 *
 * PROBLEM:
 * After OTA redirect to Vercel, the app runs inside Android WebView
 * but on an EXTERNAL URL. Capacitor plugins only work on localhost.
 *
 *   Capacitor.isNativePlatform() = TRUE  (still in WebView)
 *   Plugins available?           = FALSE (external URL)
 *
 * This utility provides CORRECT detection:
 *
 *   isNativeWithPlugins()  → TRUE only when plugins actually work
 *   isRunningOnVercel()    → TRUE when redirected to Vercel
 *   isInsideWebView()      → TRUE when inside Android/iOS WebView
 */

import { Capacitor } from '@capacitor/core';

/**
 * Are we on the LOCAL Capacitor bundle? (plugins work)
 * Returns TRUE only when:
 *   - Inside native WebView (Capacitor shell)
 *   - Running from localhost/capacitor:// (local bundle)
 *   - NOT redirected to external URL
 */
export const isNativeWithPlugins = () => {
  if (!Capacitor.isNativePlatform()) return false;

  const host = window.location.hostname;
  const proto = window.location.protocol;

  // Plugins only work on these origins
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '' ||
    proto === 'capacitor:' ||
    proto === 'file:'
  );
};

/**
 * Are we running from Vercel? (after OTA redirect)
 */
export const isRunningOnVercel = () => {
  return window.location.hostname.includes('vercel.app') ||
         window.location.hostname.includes('caba-android-app');
};

/**
 * Are we inside a native WebView? (regardless of URL)
 * TRUE for both localhost AND after redirect to Vercel
 */
export const isInsideWebView = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Are we on pure web browser? (not in any WebView)
 */
export const isPureWeb = () => {
  return !Capacitor.isNativePlatform();
};

/**
 * Safe plugin caller — tries native plugin, falls back gracefully
 */
export const safePluginCall = async (pluginFn, fallbackValue = null) => {
  if (!isNativeWithPlugins()) return fallbackValue;

  try {
    return await pluginFn();
  } catch (e) {
    console.warn('[Plugin] Call failed, using fallback:', e.message);
    return fallbackValue;
  }
};
