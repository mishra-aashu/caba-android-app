/**
 * platformCheck.js
 *
 * After OTA redirect to Vercel, app runs inside Android WebView
 * but on Vercel domain. Capacitor core is usually available,
 * but plugins might be unstable if the bridge fails.
 */

import { Capacitor } from '@capacitor/core';

/**
 * TRUE only when Capacitor plugins are guaranteed to work
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
 */
export const isRunningOnVercel = () => {
  return window.location.hostname.includes('vercel.app');
};

/**
 * TRUE when inside ANY native WebView (localhost or Vercel)
 */
export const isInsideWebView = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Safely call a Capacitor plugin.
 * Root Fix: Instead of just checking for "localhost", we check if the 
 * window.Capacitor bridge is functional. This allows plugins to work 
 * on Vercel IF the bridge is properly injected.
 */
export const safePluginCall = async (pluginFn, fallbackValue = null) => {
  const isNative = Capacitor.isNativePlatform();
  
  // 1. If not native at all (pure web browser), always use fallback
  if (!isNative) return fallbackValue;

  // 2. Check bridge health (Root of "window.Capacitor.triggerEvent is not a function")
  const isBridgeHealthy = 
    typeof window !== 'undefined' && 
    window.Capacitor && 
    typeof window.Capacitor.triggerEvent === 'function';

  if (!isBridgeHealthy) {
    if (isRunningOnVercel()) {
      console.warn('[Plugin] Bridge not functional on Vercel. Falling back.');
    }
    return fallbackValue;
  }

  // 3. Final safety: try-catch the actual plugin call
  try {
    return await pluginFn();
  } catch (e) {
    console.warn('[Plugin] Runtime call failed:', e.message);
    return fallbackValue;
  }
};