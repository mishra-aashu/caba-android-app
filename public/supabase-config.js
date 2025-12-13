// Supabase Configuration
const SUPABASE_CONFIG = {
  url: 'https://riekjnqllkrqkmqxmtfu.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZWtqbnFsbGtycWttcXhtdGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4ODc3MjQsImV4cCI6MjA3NzQ2MzcyNH0.heQABR_DZFWZ_UIb38Tzdgcy-5z5LSUob0icnqsiiQY'
};

// Initialize Supabase client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Make it available globally
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.supabase = supabase;