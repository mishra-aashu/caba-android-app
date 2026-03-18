import React from 'react';
import { supabase } from '../config/supabase.js';
import { SupabaseContext } from './SupabaseContext';

export const SupabaseProvider = ({ children }) => {
  const value = React.useMemo(() => ({
    supabase,
    signOut: () => supabase.auth.signOut(),
  }), []);

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
};
