// Supabase Configuration
const SUPABASE_CONFIG = {
  url: 'https://apckbdqmpsqhzehgtzzf.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwY2tiZHFtcHNxaHplaGd0enpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NjYyNTgsImV4cCI6MjA4MTQ0MjI1OH0.z5GCqUvOtPETrKzFkGoXjQetRx8S8cVwNMCYbnWVWyo'
};

// Initialize Supabase client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Make it available globally
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.supabase = supabase;