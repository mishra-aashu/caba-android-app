/**
 * platformCheck.js
 *
 * After OTA redirect to Vercel, app runs inside Android WebView
 * but on Vercel domain. Capacitor plugins ONLY work on localhost.
 *
 * Capacitor.isNativePlatform() = TRUE  (still in WebView)
 * Plugins available?           = FALSE (not on localhost)
 *
 * This utility gives CORRECT answers.
 */

import { Capacitor } from '@capacitor/core';

/**
 * TRUE only when Capacitor plugins actually work
 * (running on localhost inside native WebView)
 */
export const isNativeWithPlugins = () => {
  if (!Capacitor.isNativePlatform()) return false;

  const host = window.location.hostname;
  const proto = window.location.protocol;

  return (
    host === 'localhost' ||
    host === '' ||
    proto === 'capacitor:' ||
    proto === 'file:'
  );
};

/**
 * TRUE when running from Vercel (after OTA redirect)
 * Still inside Android WebView but on external URL
 */
export const isRunningOnVercel = () => {
  return window.location.hostname.includes('vercel.app');
};

/**
 * TRUE when inside ANY native WebView
 * (both localhost AND Vercel)
 */
export const isInsideWebView = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Safely call a Capacitor plugin
 * Returns fallback if plugins not available
 *
 * Usage:
 *   const result = await safePluginCall(
 *     async () => {
 *       const { Preferences } = await import('@capacitor/preferences');
 *       return Preferences.get({ key: 'my-key' });
 *     },
 *     { value: null }
 *   );
 */
export const safePluginCall = async (pluginFn, fallbackValue = null) => {
  if (!isNativeWithPlugins()) return fallbackValue;
  try {
    return await pluginFn();
  } catch (e) {
    console.warn('[Plugin] Call failed:', e.message);
    return fallbackValue;
  }
};