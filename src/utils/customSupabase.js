import { supabase } from './supabase.js';
import { createClient } from '@supabase/supabase-js';

// Singleton service role client
let serviceRoleClient = null;

// Custom Supabase wrapper that handles both authenticated and custom users
export const createCustomSupabaseClient = () => {
  const customUser = localStorage.getItem('currentUser');
  const sessionPermanent = localStorage.getItem('sessionPermanent');
  
  // If custom auth user, use service role to bypass RLS
  if (customUser && sessionPermanent === 'true') {
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey && !serviceRoleClient) {
      serviceRoleClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
    }
    return serviceRoleClient || supabase;
  }
  
  return supabase;
};