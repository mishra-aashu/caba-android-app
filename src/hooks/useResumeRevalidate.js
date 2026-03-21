import { useEffect } from "react";
import { useSupabase } from "../contexts/SupabaseContext";
import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins } from '../utils/platformCheck';

export const useResumeRevalidate = () => {
  const { supabase, validateSessionAndRefresh, ensureConnected } = useSupabase();

  useEffect(() => {
    let appListener = null;

    if (isNativeWithPlugins()) {
      const setup = async () => {
        try {
          const { App } = await import('@capacitor/app');
          appListener = await App.addListener('appStateChange', (state) => {
            console.log('App state changed:', state);
            if (state.isActive) {
              console.log('App resumed on native platform');
            }
          });
        } catch (e) {
          console.warn('[ResumeRevalidate] App listener failed:', e.message);
        }
      };
      setup();
    }

    return () => {
      if (appListener) {
        try {
          if (typeof appListener.remove === 'function') {
            appListener.remove();
          }
        } catch (e) {
          console.warn('[ResumeRevalidate] Cleanup failed:', e.message);
        }
      }
    };
  }, [supabase, ensureConnected]);
};

export default useResumeRevalidate;