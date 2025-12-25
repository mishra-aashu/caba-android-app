import React, { createContext, useContext } from 'react';
import { supabase } from '../config/supabase.js';

const SupabaseContext = createContext();

export const SupabaseProvider = ({ children }) => {
  const value = {
    supabase,
    signOut: () => supabase.auth.signOut(),
  };

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};

export default SupabaseContext;
