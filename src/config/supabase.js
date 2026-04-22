import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins, safePluginCall } from '../utils/platformCheck';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ══════════════════════════════════════════════════════════════
// Singleton Instance
// ══════════════════════════════════════════════════════════════
let instance = null;

// ══════════════════════════════════════════════════════════════
// Connection Error Monitoring
// ══════════════════════════════════════════════════════════════
const connectionErrorSubscribers = new Set();

export const onConnectionError = (callback) => {
  connectionErrorSubscribers.add(callback);
  return () => connectionErrorSubscribers.delete(callback);
};

const notifyConnectionError = () => {
  connectionErrorSubscribers.forEach((cb) => cb());
};

// ══════════════════════════════════════════════════════════════
// Resilient Storage Adapter
// ══════════════════════════════════════════════════════════════
const CapacitorStorage = {
  getItem: async (key) => {
    return safePluginCall(
      async () => {
        const { Preferences } = await import('@capacitor/preferences');
        const { value } = await Preferences.get({ key });
        return value;
      },
      window.localStorage.getItem(key) // Fallback
    );
  },
  setItem: async (key, value) => {
    return safePluginCall(
      async () => {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key, value });
      },
      window.localStorage.setItem(key, value) // Fallback
    );
  },
  removeItem: async (key) => {
    return safePluginCall(
      async () => {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.remove({ key });
      },
      window.localStorage.removeItem(key) // Fallback
    );
  },
};

// ══════════════════════════════════════════════════════════════
// Enhanced Fetch with Retry & Circuit Breaker
// ══════════════════════════════════════════════════════════════

const createResilientFetch = () => {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff
  let consecutiveFailures = 0;
  const CIRCUIT_BREAKER_THRESHOLD = 5;

  return async (url, options = {}) => {
    // Circuit breaker: Stop trying if too many consecutive failures
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      console.error('[Supabase] Circuit breaker OPEN - too many failures');
      notifyConnectionError();
      throw new Error('Circuit breaker open - service unavailable');
    }

    // Don't retry if explicitly offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Network offline');
    }

    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle specific HTTP errors
        if (response.status === 403) {
          const errorText = await response.clone().text().catch(() => 'Unknown error');
          console.error(`[Supabase] 403 Forbidden on ${url}:\n`, errorText);
        }

        // Retry on server errors
        if (response.status === 503 || response.status === 504) {
          throw new Error(`Server unavailable (${response.status})`);
        }

        // Success - reset failure counter
        consecutiveFailures = 0;
        return response;

      } catch (error) {
        lastError = error;

        // Don't retry on abort errors
        if (error.name === 'AbortError') {
          console.warn('[Supabase] Request aborted (timeout or manual)');
          break;
        }

        // Log retry attempt
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS[attempt];
          console.warn(
            `[Supabase] Retry ${attempt + 1}/${MAX_RETRIES} for ${url} after ${delay}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    consecutiveFailures++;
    
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      notifyConnectionError();
    }

    throw lastError;
  };
};

// ══════════════════════════════════════════════════════════════
// Client Factory
// ══════════════════════════════════════════════════════════════

const createSupabaseClient = () => {
  if (instance) return instance;

  console.log('[Supabase] 🔌 Initializing client');

  instance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: isNativeWithPlugins() ? CapacitorStorage : window.localStorage,
      // NEW: Disable flowType to prevent automatic token extraction from URL
      // (we handle it manually in authStore to avoid race conditions)
      flowType: 'implicit',
    },
    db: {
      schema: 'public',
    },
    global: {
      fetch: createResilientFetch(),
      headers: {
        'x-application-name': 'caba-android-app',
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
      timeout: 45000, // Increased from 30s
      heartbeatIntervalMs: 15000, // Increased from 5s
    },
  });

  return instance;
};

export const supabase = createSupabaseClient();
export const supabaseRealtime = supabase; // Alias for compatibility

export default supabase;