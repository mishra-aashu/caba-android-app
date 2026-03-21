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
 * UPDATED: Now much more inclusive - checks if we're on native at all.
 */
export const isNativeWithPlugins = () => {
  return Capacitor.isNativePlatform();
};

/**
 * TRUE when running from Vercel (after OTA redirect)
 */
export const isRunningOnVercel = () => {
  return typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
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
 * 
 * Support both:
 * 1. safePluginCall(() => import('...'), (mod) => mod.Plugin.method())
 * 2. safePluginCall(async () => { ... do everything ... })
 */
export const safePluginCall = async (pluginFn, fallbackOrCall = null) => {
  const isNative = Capacitor.isNativePlatform();
  
  // 1. If not native at all (pure web browser), return fallback if it's not a function
  if (!isNative) {
    return typeof fallbackOrCall === 'function' ? null : fallbackOrCall;
  }

  // 2. Check bridge health
  const isBridgeHealthy = 
    typeof window !== 'undefined' && 
    window.Capacitor && 
    typeof window.Capacitor.triggerEvent === 'function';

  if (!isBridgeHealthy) {
    if (isRunningOnVercel()) {
      console.warn('[Plugin] Bridge not functional on Vercel. Falling back.');
    }
    return typeof fallbackOrCall === 'function' ? null : fallbackOrCall;
  }

  // 3. Final safety: try-catch the actual plugin call
  try {
    const result = await pluginFn();
    
    // If second arg is a function, it's the "Import + Call" pattern
    if (typeof fallbackOrCall === 'function') {
      return await fallbackOrCall(result, result);
    }
    
    return result;
  } catch (e) {
    console.warn('[Plugin] Runtime call failed:', e.message);
    return typeof fallbackOrCall === 'function' ? null : fallbackOrCall;
  }
};