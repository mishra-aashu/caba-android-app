import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }) => {
  const { user, loading, isAuthenticated, initializeAuth, signInWithGoogle, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation(); // Get current location

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password', '/terms', '/privacy', '/intro'];
    const isPublicPage = publicPaths.includes(location.pathname) || location.pathname.startsWith('/shared-profile');

    if (!loading && !isAuthenticated && !isPublicPage) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, loading, navigate, location]); // Added location to dependencies

  const value = {
    user,
    loading,
    isAuthenticated,
    signInWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
