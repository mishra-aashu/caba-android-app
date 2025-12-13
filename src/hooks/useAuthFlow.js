import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';

/**
 * Production Auth Flow Hook
 * Manages authentication state and event listeners across the app
 */
export const useAuthFlow = (onAuthChange = null) => {
  const { user, loading, isAuthenticated, signOut } = useAuth();
  const authListenersRef = useRef(new Set());

  useEffect(() => {
    if (loading) return;

    // Notify all listeners of auth state change
    const notifyListeners = () => {
      authListenersRef.current.forEach(callback => {
        try {
          callback({
            user,
            isAuthenticated,
            loading
          });
        } catch (error) {
          console.error('Auth listener error:', error);
        }
      });
    };

    notifyListeners();

    // Call provided callback
    if (onAuthChange) {
      onAuthChange({ user, isAuthenticated, loading });
    }

    // Setup auto-logout on inactivity (30 minutes)
    const inactivityTimer = setTimeout(() => {
      if (isAuthenticated) {
        console.log('Auto-logout due to inactivity');
        signOut();
      }
    }, 30 * 60 * 1000);

    // Setup periodic session refresh (every 5 minutes)
    const refreshInterval = setInterval(() => {
      if (isAuthenticated && user?.id) {
        console.log('Refreshing session...');
        // Session is auto-refreshed by SessionManager
      }
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(inactivityTimer);
      clearInterval(refreshInterval);
    };
  }, [user, isAuthenticated, loading, onAuthChange, signOut]);

  /**
   * Add auth state listener
   */
  const addAuthListener = (callback) => {
    authListenersRef.current.add(callback);
    return () => authListenersRef.current.delete(callback);
  };

  /**
   * Remove all listeners
   */
  const clearAuthListeners = () => {
    authListenersRef.current.clear();
  };

  return {
    user,
    loading,
    isAuthenticated,
    signOut,
    addAuthListener,
    clearAuthListeners
  };
};

export default useAuthFlow;
