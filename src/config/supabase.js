import { createClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Singleton instance to prevent multiple connections
let instance = null;

// Capacitor storage adapter for Supabase Auth
const CapacitorStorage = {
  getItem: async (key) => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key, value) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key) => {
    await Preferences.remove({ key });
  },
};

const createSupabaseClient = () => {
  if (instance) return instance;

  instance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: Capacitor.isNativePlatform() ? CapacitorStorage : window.localStorage,
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
            if (attempt === MAX_RETRIES) throw error;
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
      timeout: 30000,
      heartbeatIntervalMs: 5000,
    },
  });

  return instance;
};

export const supabase = createSupabaseClient();
export default supabase;