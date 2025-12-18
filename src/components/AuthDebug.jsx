import React from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthDebug = () => {
  const { user: authUser, loading: authLoading, isAuthenticated } = useAuth();

  if (process.env.NODE_ENV === 'production') return null;

  
};

export default AuthDebug;
