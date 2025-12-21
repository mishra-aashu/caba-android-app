import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from './SupabaseContext';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { toast } from 'react-hot-toast';

const AuthContext = createContext({});

// Session storage keys
const STORAGE_KEYS = {
  USER: '_auth_user',
  SESSION: '_auth_session',
  TIMESTAMP: '_auth_timestamp'
};

// Session timeout (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const { supabase } = useSupabase();
  const navigate = useNavigate();
  const [state, setState] = useState({
    user: null,
    loading: true,
    isAuthenticated: false,
    initialized: false,
    error: null
  });

  // Update state helper
  const updateState = (updates) => {
    setState(prev => ({
      ...prev,
      ...updates,
      error: null // Reset error on state update
    }));
  };

  // Check if session is valid
  const isSessionValid = useCallback(() => {
    const timestamp = sessionStorage.getItem(STORAGE_KEYS.TIMESTAMP);
    if (!timestamp) return false;
    return Date.now() - parseInt(timestamp, 10) < SESSION_TIMEOUT;
  }, []);

  // Handle user session
  const handleUserSession = useCallback(async (userData) => {
    if (!userData) {
      updateState({
        user: null,
        isAuthenticated: false,
        loading: false
      });
      return;
    }

    try {
      // Get additional user data if needed
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.id)
        .single();

      const userProfile = {
        id: userData.id,
        email: userData.email,
        ...profile
      };

      // Update state and storage
      updateState({
        user: userProfile,
        isAuthenticated: true,
        loading: false
      });

      // Store minimal session data
      const sessionData = {
        user: userProfile,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userProfile));
      sessionStorage.setItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString());
      
      return userProfile;
    } catch (error) {
      console.error('Error handling user session:', error);
      updateState({
        error: 'Failed to load user profile',
        loading: false
      });
      return null;
    }
  }, [supabase]);

  // Initialize auth state
  useEffect(() => {
    if (!supabase || state.initialized) return;

    const initializeAuth = async () => {
      try {
        // Initialize Google Auth for native platforms
        if (Capacitor.isNativePlatform()) {
          await GoogleAuth.initialize({
            clientId: '335571630396-g270djndvqsj8p00kfgoq98995p1l3bm.apps.googleusercontent.com',
            scopes: ['profile', 'email'],
            grantOfflineAccess: true,
          });
        }

        // Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session?.user && isSessionValid()) {
          await handleUserSession(session.user);
        } else {
          // Clear any stale session data
          clearSession();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        updateState({
          error: 'Failed to initialize authentication',
          loading: false
        });
      } finally {
        updateState({ initialized: true });
      }
    };

    initializeAuth();
  }, [supabase, handleUserSession, isSessionValid, state.initialized]);

  // Set up auth state change listener
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        switch (event) {
          case 'SIGNED_IN':
            if (session?.user) {
              await handleUserSession(session.user);
            }
            break;
            
          case 'SIGNED_OUT':
            clearSession();
            updateState({
              user: null,
              isAuthenticated: false,
              loading: false
            });
            break;
            
          case 'TOKEN_REFRESHED':
            if (session?.user) {
              sessionStorage.setItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString());
            }
            break;
            
          default:
            break;
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, handleUserSession]);

  // Clear session data
  const clearSession = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      sessionStorage.removeItem(key);
    });
  };

  // Sign in with email/password
  const signInWithEmail = async (email, password) => {
    try {
      updateState({ loading: true });
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      return await handleUserSession(data.user);
    } catch (error) {
      console.error('Sign in error:', error);
      updateState({
        error: error.message || 'Failed to sign in',
        loading: false
      });
      throw error;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      updateState({ loading: true });
      
      if (Capacitor.isNativePlatform()) {
        // Native Google Sign-In
        const googleUser = await GoogleAuth.signIn();
        
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: googleUser.authentication.idToken,
        });
        
        if (error) throw error;
        return await handleUserSession(data.user);
      } else {
        // Web Google Sign-In
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });
        
        if (error) throw error;
        return data.user;
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      updateState({
        error: error.message || 'Failed to sign in with Google',
        loading: false
      });
      throw error;
    }
  };

  // Sign up with email/password
  const signUp = async (email, password, userData) => {
    try {
      updateState({ loading: true });
      
      // Create user in Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userData.fullName,
            // Add other user data as needed
          },
        },
      });

      if (signUpError) throw signUpError;
      
      // Create user profile in database
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([
          {
            id: data.user.id,
            email,
            ...userData,
            created_at: new Date().toISOString(),
          },
        ]);

      if (profileError) throw profileError;
      
      return await handleUserSession(data.user);
    } catch (error) {
      console.error('Sign up error:', error);
      updateState({
        error: error.message || 'Failed to create account',
        loading: false
      });
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      updateState({ loading: true });
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear local session
      clearSession();
      
      // Update state
      updateState({
        user: null,
        isAuthenticated: false,
        loading: false
      });
      
      // Navigate to login
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      updateState({
        error: error.message || 'Failed to sign out',
        loading: false
      });
      throw error;
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      updateState({ loading: true });
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast.success('Password reset email sent!');
      return true;
    } catch (error) {
      console.error('Password reset error:', error);
      updateState({
        error: error.message || 'Failed to send reset email',
        loading: false
      });
      throw error;
    } finally {
      updateState({ loading: false });
    }
  };

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      if (!state.user?.id) throw new Error('No user logged in');
      
      updateState({ loading: true });
      
      // Update in profiles table
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', state.user.id);
        
      if (error) throw error;
      
      // Update local state
      const updatedUser = { ...state.user, ...updates };
      updateState({
        user: updatedUser,
        loading: false
      });
      
      // Update session storage
      sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      
      return updatedUser;
    } catch (error) {
      console.error('Profile update error:', error);
      updateState({
        error: error.message || 'Failed to update profile',
        loading: false
      });
      throw error;
    }
  };

  // Exposed context value
  const value = {
    ...state,
    signInWithEmail,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    refreshSession: () => handleUserSession(state.user),
  };

  return (
    <AuthContext.Provider value={value}>
      {!state.initialized ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
