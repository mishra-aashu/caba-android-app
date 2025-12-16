import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from './SupabaseContext';
import AuthService from '../services/authService';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const { supabase } = useSupabase();
  const navigate = useNavigate();
  const [authService, setAuthService] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    const initializeAuth = async () => {
      try {
        // Initialize Google Auth plugin
        await GoogleAuth.initialize({
          clientId: '335571630396-g270djndvqsj8p00kfgoq98995p1l3bm.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });

        // Check for user from HTML login pages first
        const storedUser = sessionStorage.getItem('_auth_user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setIsAuthenticated(true);
          setLoading(false);
          return;
        }

        // Listen for Supabase auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('🔐 Auth state changed:', event);

          if (event === 'SIGNED_IN' && session?.user) {
            try {
              // Check if user exists in database
              const { data: existingUser, error: dbError } = await supabase
                .from('users')
                .select('*')
                .eq('email', session.user.email)
                .single();

              let dbUser;

              if (dbError && dbError.code === 'PGRST116') {
                // User doesn't exist, create new user
                const userData = {
                  id: session.user.id,
                  email: session.user.email,
                  name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email.split('@')[0],
                  phone: '',
                  avatar: session.user.user_metadata?.avatar_url || null,
                  is_online: true
                };

                const { data: newUser, error: insertError } = await supabase
                  .from('users')
                  .insert([userData])
                  .select()
                  .single();

                if (insertError) {
                  console.error('Insert error:', insertError);
                  throw new Error('Failed to create user account');
                }

                dbUser = newUser;
              } else if (existingUser) {
                // User exists, update their status
                await supabase
                  .from('users')
                  .update({
                    is_online: true,
                    last_seen: new Date().toISOString()
                  })
                  .eq('id', existingUser.id);

                dbUser = existingUser;
              } else {
                throw new Error('Database error occurred');
              }

              // Store user data
              sessionStorage.setItem('_auth_user', JSON.stringify(dbUser));
              setUser(dbUser);
              setIsAuthenticated(true);

              // Navigate to home after successful authentication
              navigate('/', { replace: true });
            } catch (error) {
              console.error('User creation/update error:', error);
              // Still set basic user data for UI
              const userData = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email.split('@')[0],
                phone: '',
                avatar: session.user.user_metadata?.avatar_url || null,
                is_online: true
              };
              setUser(userData);
              setIsAuthenticated(true);
              navigate('/', { replace: true });
            }
          } else if (event === 'SIGNED_OUT') {
            sessionStorage.removeItem('_auth_user');
            setUser(null);
            setIsAuthenticated(false);
            navigate('/login', { replace: true });
          }

          setLoading(false);
        });

        // Check current session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // User is already signed in
          const userData = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email.split('@')[0],
            phone: '',
            avatar: session.user.user_metadata?.avatar_url || null,
            is_online: true
          };

          setUser(userData);
          setIsAuthenticated(true);

          // Navigate to home if already authenticated
          navigate('/', { replace: true });
        }

        setLoading(false);

        return () => {
          subscription?.unsubscribe();
        };
      } catch (error) {
        console.error('Auth context initialization error:', error);
        setLoading(false);
      }
    };

    initializeAuth();
  }, [supabase]);


  const signInWithGoogle = async () => {
    try {
      // Check if running in Capacitor (mobile app)
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        // Use Capacitor Google Auth plugin for mobile
        const googleUser = await GoogleAuth.signIn();

        // Sign in with Supabase using the Google ID token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: googleUser.authentication.idToken
        });

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true };
      } else {
        // Use Supabase OAuth for web development
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/caba-android-app/`
          }
        });

        if (error) {
          return { success: false, error: error.message };
        }

        // For web OAuth, the redirect will happen automatically
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signUpWithGoogle = async () => {
    return signInWithGoogle();
  };

  const signOut = async () => {
    try {
      // Clear session storage
      sessionStorage.removeItem('_auth_user');

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear auth service
      if (authService) {
        authService.signOut();
      }

      // Update state
      setUser(null);
      setIsAuthenticated(false);

      // Navigate to login
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    signInWithPhone: (phone, password) => authService?.authenticateWithPhone(phone, password),
    signUpWithPhone: (phone, password, name, email) => authService?.signUpWithPhone(phone, password, name, email),
    signInWithGoogle,
    signUpWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
