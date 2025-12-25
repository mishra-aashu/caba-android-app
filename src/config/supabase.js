import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: false, // Disabled to prevent conflicts with manual refresh
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    // Connection timeout settings adjust karein
    timeout: 20000,
    heartbeatIntervalMs: 5000, // Frequent heartbeat taaki jaldi pata chale disconnect ka
  },
});

export default supabase;