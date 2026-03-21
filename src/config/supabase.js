import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins, safePluginCall } from '../utils/platformCheck';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Singleton instance to prevent multiple connections
let instance = null;

// ── Resilient Storage Adapter ──
// Falls back to localStorage if Preferences plugin fails or is not available.
const CapacitorStorage = {
  getItem: async (key) => {
    return safePluginCall(
      async () => {
        const { Preferences } = await import('@capacitor/preferences');
        const { value } = await Preferences.get({ key });
        return value;
      },
      window.localStorage.getItem(key)
    );
  },
  setItem: async (key, value) => {
    return safePluginCall(
      async () => {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key, value });
      },
      window.localStorage.setItem(key, value)
    );
  },
  removeItem: async (key) => {
    return safePluginCall(
      async () => {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.remove({ key });
      },
      window.localStorage.removeItem(key)
    );
  },
};

// Connection error subscribers
const connectionErrorSubscribers = new Set();
export const onConnectionError = (callback) => {
  connectionErrorSubscribers.add(callback);
  return () => connectionErrorSubscribers.delete(callback);
};

const notifyConnectionError = () => {
  connectionErrorSubscribers.forEach(cb => cb());
};

const createSupabaseClient = () => {
  if (instance) return instance;

  instance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: isNativeWithPlugins() ? CapacitorStorage : window.localStorage,
    },
    db: {
      schema: 'public'
    },
    global: {
      // ✅ Resilience: Custom fetch wrapper to handle transient 503/504 errors
      fetch: async (url, options) => {
        const MAX_RETRIES = 3;
        let attempt = 0;

        // No need to retry if we are explicitly offline
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          return fetch(url, options); // Let it fail naturally
        }

        while (attempt < MAX_RETRIES) {
          try {
            const response = await fetch(url, options);
            if (response.status === 503 || response.status === 504) {
              throw new Error(`Server unstable (${response.status})`);
            }
            return response;
          } catch (error) {
            attempt++;
            if (attempt === MAX_RETRIES) {
              // ✅ Circuit Breaker: Signal exhaustion
              notifyConnectionError();
              throw error;
            }
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            console.warn(`Supabase retry attempt ${attempt} for ${url}`);
          }
        }
      },
      headers: { 'x-application-name': 'caba-android-app' }
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
      // ✅ Only two changes from your original:
      timeout: 45000,                // 30000 → 45000
      heartbeatIntervalMs: 15000,    // 5000 → 15000
    },
  });

  return instance;
};

export const supabase = createSupabaseClient();
export default supabase;