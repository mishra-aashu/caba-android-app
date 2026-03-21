import { useEffect } from "react";
import { useSupabase } from "../contexts/SupabaseContext";
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export const useResumeRevalidate = () => {
  const { supabase, validateSessionAndRefresh, ensureConnected } = useSupabase();

  useEffect(() => {
    // Note: Removed aggressive session refresh on visibility change
    // Auto-reconnect is now handled by individual realtime hooks
    // This prevents conflicts between old and new reconnection logic

    let appStateListenerPromise = null;
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('App')) {
      try {
        // App.addListener returns a promise; ensure we catch async rejection.
        appStateListenerPromise = App.addListener('appStateChange', (state) => {
          console.log('App state changed:', state);
          if (state.isActive) {
            console.log('App resumed on native platform');
            // Let individual hooks handle their own reconnection
          }
        }).catch((e) => {
          console.warn('[ResumeRevalidate] App listener init failed (non-fatal):', e?.message || e);
          return null;
        });
      } catch (e) {
        console.warn('[ResumeRevalidate] App plugin not implemented:', e.message);
      }
    }

    return () => {
      if (appStateListenerPromise) {
        Promise.resolve(appStateListenerPromise)
          .then((listener) => {
            if (listener && typeof listener.remove === 'function') {
              return listener.remove();
            }
            return null;
          })
          .catch((e) => {
            console.warn('[ResumeRevalidate] App listener cleanup failed:', e?.message || e);
          });
      }
    };
  }, [supabase, ensureConnected]);
};

export default useResumeRevalidate;