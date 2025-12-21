import { useEffect } from "react";
import { useSupabase } from "../contexts/SupabaseContext";
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export const useResumeRevalidate = () => {
  const { supabase, validateSessionAndRefresh, ensureConnected } = useSupabase();

  useEffect(() => {
    const onVisibility = () => {
      console.log('Visibility changed:', document.visibilityState);
      if (document.visibilityState === "visible") {
        console.log('App resumed, validating session...');
        if (validateSessionAndRefresh) {
          validateSessionAndRefresh();
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    let appStateListener;
    if (Capacitor.isNativePlatform()) {
      appStateListener = App.addListener('appStateChange', (state) => {
        console.log('App state changed:', state);
        if (state.isActive) {
          console.log('App resumed on native, validating session...');
          if (validateSessionAndRefresh) {
            validateSessionAndRefresh();
          }
        }
      });
    }


    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, [supabase, validateSessionAndRefresh, ensureConnected]);
};

export default useResumeRevalidate;