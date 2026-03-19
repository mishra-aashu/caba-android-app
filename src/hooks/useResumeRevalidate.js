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

    let appStateListener;
    if (Capacitor.isNativePlatform()) {
      try {
        appStateListener = App.addListener('appStateChange', (state) => {
          console.log('App state changed:', state);
          if (state.isActive) {
            console.log('App resumed on native platform');
            // Let individual hooks handle their own reconnection
          }
        });
      } catch (e) {
        console.warn('[ResumeRevalidate] App plugin not implemented:', e.message);
      }
    }

    return () => {
      if (appStateListener && typeof appStateListener.remove === 'function') {
        appStateListener.remove();
      }
    };
  }, [supabase, ensureConnected]);
};

export default useResumeRevalidate;