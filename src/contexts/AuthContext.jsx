import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from './SupabaseContext';
import AuthService from '../services/authService';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core'; // Import Core for proper platform check

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
        // --- FIX 1: ONLY Initialize Plugin on Android/iOS ---
        if (Capacitor.isNativePlatform()) {
          await GoogleAuth.initialize({
            clientId: '335571630396-g270djndvqsj8p00kfgoq98995p1l3bm.apps.googleusercontent.com',
            scopes: ['profile', 'email'],
            grantOfflineAccess: true,
          });
        }

        // Check for session immediately
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          await handleUserSession(session.user);
        } else {
            // Check legacy session storage if Supabase has no session
            const storedUser = sessionStorage.getItem('_auth_user');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
                setIsAuthenticated(true);
            }
        }

        // Listen for Supabase auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('🔐 Auth state changed:', event);
          if (event === 'SIGNED_IN' && session?.user) {
            await handleUserSession(session.user);
          } else if (event === 'SIGNED_OUT') {
            handleSignOut();
          }
        });

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

  // Helper to handle user data fetching/creation to avoid code duplication
  const handleUserSession = async (authUser) => {
    try {
        const { data: existingUser, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('email', authUser.email)
            .single();

        let dbUser;
        // User Metadata handling
        const metaName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email.split('@')[0];
        const metaAvatar = authUser.user_metadata?.avatar_url || null;

        if (dbError && dbError.code === 'PGRST116') {
            // Create New User
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([{
                    id: authUser.id,
                    email: authUser.email,
                    name: metaName,
                    phone: '',
                    avatar: metaAvatar,
                    is_online: true
                }])
                .select()
                .single();
            
            if (insertError) throw insertError;
            dbUser = newUser;
        } else if (existingUser) {
            // Update Existing User
            await supabase
                .from('users')
                .update({ is_online: true, last_seen: new Date().toISOString() })
                .eq('id', existingUser.id);
            dbUser = existingUser;
        }

        // Finalize Login
        sessionStorage.setItem('_auth_user', JSON.stringify(dbUser || authUser));
        setUser(dbUser || authUser);
        setIsAuthenticated(true);
        navigate('/', { replace: true });
        
    } catch (error) {
        console.error("Error handling user session:", error);
    }
  };

  const handleSignOut = () => {
    sessionStorage.removeItem('_auth_user');
    localStorage.removeItem('sb-riekjnqllkrqkmqxmtfu-auth-token');
    setUser(null);
    setIsAuthenticated(false);
    navigate('/login', { replace: true });
  };

  const signInWithGoogle = async () => {
    try {
      // 1. Android / iOS (Native)
      if (Capacitor.isNativePlatform()) {
        const googleUser = await GoogleAuth.signIn();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: googleUser.authentication.idToken,
        });
        if (error) throw error;
        return { success: true };
      }

      // 2. Web (Browser)
      else {
        // DETECT ENVIRONMENT
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        // VITAL FIX: If on GitHub Pages, we MUST include the repository name
        const redirectUrl = isLocal
            ? window.location.origin  // http://localhost:5173
            : 'https://mishra-aashu.github.io/caba-android-app/'; // Your EXACT production URL

        console.log("Redirecting to:", redirectUrl); // Debugging log

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            }
          }
        });

        if (error) throw error;
        return { success: true };
      }
    } catch (error) {
      console.error("Google Sign In Error:", error);
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
          await GoogleAuth.signOut(); // Clean up native session
      }
      await supabase.auth.signOut();
      handleSignOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

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
// (!loading && children) prevents the app from rendering Login page briefly while checking session
export const useAuth = () => useContext(AuthContext);
export default AuthContext;
