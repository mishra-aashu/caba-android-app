import { create } from 'zustand';
import { supabase } from '../config/supabase';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app'; // Import Capacitor App plugin

const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  loading: true,

  initializeAuth: async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await GoogleAuth.initialize({
          clientId: '335571630396-g270djndvqsj8p00kfgoq98995p1l3bm.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user, session, isAuthenticated: true, loading: false });
        get().handleUserSession(session.user);
      } else {
        set({ loading: false });
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('🔐 Auth state changed:', event, session);
          if (event === 'SIGNED_IN' && session?.user) {
            set({ user: session.user, session, isAuthenticated: true });
            get().handleUserSession(session.user);
          } else if (event === 'SIGNED_OUT') {
            set({ user: null, session: null, isAuthenticated: false });
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            set({ session });
            supabase.realtime.setAuth(session.access_token);
          }
        }
      );

        const refreshAuthSession = async (eventName) => {
            console.log(`Triggering session refresh due to: ${eventName}`);
            const { data, error } = await supabase.auth.refreshSession();
            if (error) {
                console.error(`Error refreshing session on ${eventName}:`, error);
            } else {
                console.log(`Session refreshed successfully on ${eventName}:`, data);
            }
        };

        // Web platform listeners
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                refreshAuthSession('visibilitychange');
            }
        });
        window.addEventListener('online', () => refreshAuthSession('online'));

        // Native platform listener (Capacitor)
        let appStateListener;
        if (Capacitor.isNativePlatform()) {
            appStateListener = App.addListener('appStateChange', (state) => {
                console.log('Capacitor App state changed:', state);
                if (state.isActive) {
                    refreshAuthSession('appStateChange - isActive');
                }
            });
        }

      return () => {
        subscription?.unsubscribe();
        document.removeEventListener('visibilitychange', () => {}); // Empty handler for cleanup
        window.removeEventListener('online', () => {}); // Empty handler for cleanup
        if (appStateListener) {
            appStateListener.remove();
        }
      };
    } catch (error) {
      console.error('Auth store initialization error:', error);
      set({ loading: false });
    }
  },

  handleUserSession: async (authUser) => {
    try {
      const { data: existingUser, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .single();

      const metaName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email.split('@')[0];
      const metaAvatar = authUser.user_metadata?.avatar_url || null;

      if (dbError && dbError.code === 'PGRST116') {
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
      } else if (existingUser) {
        await supabase
          .from('users')
          .update({ is_online: true, last_seen: new Date().toISOString() })
          .eq('id', existingUser.id);
      }
    } catch (error) {
      console.error("Error handling user session:", error);
    }
  },

  signInWithGoogle: async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const googleUser = await GoogleAuth.signIn();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: googleUser.authentication.idToken,
        });
        if (error) throw error;
        return { success: true };
      } else {
        const redirectUrl = window.location.origin + window.location.pathname;
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
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },
}));

export default useAuthStore;
