import { create } from 'zustand';
import { supabase } from '../config/supabase';
import { dbToFrontend } from '../utils/dbFieldMapping';
import { getRedirectUrl } from '../utils/authUtils';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// ✅ Track refresh timing OUTSIDE store to prevent loops
let lastRefreshTime = 0;
const MIN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes minimum
let isHandlingSession = false; // Prevent duplicate handleUserSession calls

const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  dbUser: null,
  isAuthenticated: false,
  loading: true,
  isPhoneAuth: false,
  isServerUnreachable: false,

  clearServerError: () => set({ isServerUnreachable: false }),

  initializeAuth: async () => {
    try {
      // Check for phone auth first
      const phoneUser = localStorage.getItem('phoneAuthUser');
      const phoneToken = localStorage.getItem('phoneAuthToken');

      if (phoneUser && phoneToken) {
        const user = JSON.parse(phoneUser);
        set({
          user,
          dbUser: user,
          isAuthenticated: true,
          isPhoneAuth: true,
          loading: false
        });
        return;
      }
      // ✅ Get initial session safely
      let currentSession = null;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('⚠️ Supabase getSession warning (likely offline):', error.message);
          // Don't show server error banner on init - assume offline mode
        }
        currentSession = data?.session;
      } catch (sessionError) {
        console.warn('ℹ️ Supabase getSession handled (likely offline):', sessionError.message);
      }

      if (currentSession?.user) {
        console.log('✅ Initial session found:', currentSession.user.email);
        set({
          user: currentSession.user,
          session: currentSession,
          isAuthenticated: true,
          loading: false
        });

        // Don't strongly await it if we are just concerned about auth, but keeping existing behavior
        await get().handleUserSession(currentSession.user);
      } else {
        console.log('ℹ️ No initial session found or server unreachable');
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          loading: false
        });
      }

      // ✅ CLEAN auth state listener — no unnecessary side effects
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('🔐 Auth event:', event);

          switch (event) {
            case 'INITIAL_SESSION':
              // ✅ Already handled above — skip
              break;

            case 'SIGNED_IN':
              if (session?.user) {
                const currentUser = get().user;

                // ✅ Only handle if this is a NEW sign in
                // Not a sign-in triggered by token refresh
                if (!currentUser || currentUser.id !== session.user.id) {
                  set({
                    user: session.user,
                    session,
                    isAuthenticated: true
                  });
                  await get().handleUserSession(session.user);
                } else {
                  // ✅ Just update session, don't re-handle
                  set({ session });
                }
              }
              break;

            case 'TOKEN_REFRESHED':
              if (session) {
                // ✅ Only update session and realtime token
                set({ session });
                supabase.realtime.setAuth(session.access_token);
                lastRefreshTime = Date.now();
                console.log('🔄 Token refreshed — realtime updated');
              }
              // ❌ DO NOT call handleUserSession here
              // ❌ DO NOT trigger any DB calls
              break;

            case 'SIGNED_OUT':
              set({
                user: null,
                session: null,
                dbUser: null,
                isAuthenticated: false
              });
              break;

            default:
              break;
          }
        }
      );

      // ✅ SMART refresh — only when needed
      const smartRefresh = async (eventName) => {
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTime;

        // ✅ CHECK 1: Don't refresh if refreshed recently
        if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
          console.log(
            `⏭️ Skip refresh (${eventName}) — ` +
            `last refresh ${Math.round(timeSinceLastRefresh / 1000)}s ago`
          );
          return;
        }

        // ✅ CHECK 2: Only refresh if token is expiring soon
        const currentSession = get().session;
        if (currentSession?.expires_at) {
          const expiresAt = currentSession.expires_at * 1000;
          const timeUntilExpiry = expiresAt - now;

          if (timeUntilExpiry > 10 * 60 * 1000) {
            // Token valid for 10+ minutes — no refresh needed
            console.log(
              `⏭️ Skip refresh (${eventName}) — ` +
              `token valid for ${Math.round(timeUntilExpiry / 60000)} min`
            );
            return;
          }
        }

        // ✅ Token expiring soon — refresh it
        console.log(`🔄 Refreshing token (${eventName})`);
        lastRefreshTime = now;

        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.error(`❌ Refresh failed (${eventName}):`, error);
          // ✅ If refresh fails, try to re-authenticate
          if (error.message?.includes('refresh_token')) {
            console.warn('🔒 Refresh token invalid — signing out');
            get().signOut();
          }
        }
      };

      // ✅ PROPER event listeners with real cleanup
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          smartRefresh('visibilitychange');
        }
      };

      const handleOnline = () => {
        smartRefresh('online');
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('online', handleOnline);

      // Native platform listener
      let appStateListener;
      if (Capacitor.isNativePlatform()) {
        appStateListener = App.addListener('appStateChange', (state) => {
          if (state.isActive) {
            smartRefresh('appStateChange');
          }
        });
      }

      // ✅ REAL cleanup — removes actual listeners
      return () => {
        subscription?.unsubscribe();
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange
        );
        window.removeEventListener('online', handleOnline);
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
    // ✅ Prevent duplicate calls
    if (isHandlingSession) {
      console.log('⏭️ handleUserSession already running — skip');
      return;
    }
    isHandlingSession = true;

    try {
      const { data: existingUser, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .single();

      const metaName = authUser.user_metadata?.full_name
        || authUser.user_metadata?.name
        || authUser.email.split('@')[0];
      const metaAvatar = authUser.user_metadata?.avatar_url || null;

      let dbUser;

      if (dbError && dbError.code === 'PGRST116') {
        // ✅ User doesn't exist — create new
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
        // ✅ User exists — update online status
        // But ONLY if not already online (prevent unnecessary UPDATE)
        if (!existingUser.is_online) {
          await supabase
            .from('users')
            .update({
              is_online: true,
              last_seen: new Date().toISOString()
            })
            .eq('id', existingUser.id);
        }
        dbUser = existingUser;
      }

      set({ dbUser: dbToFrontend(dbUser) });
      console.log('✅ User session handled successfully for:', authUser.email);
    } catch (error) {
      console.error("❌ Error handling user session:", error);
    } finally {
      isHandlingSession = false;
    }
  },

  signInWithGoogle: async () => {
    set({ isServerUnreachable: false }); // Reset error state on new attempt
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
        const redirectUrl = getRedirectUrl();
        console.log('🔗 Redirecting to:', redirectUrl);

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            flowType: 'pkce', // ✅ Use PKCE flow for better mobile compatibility
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

      // ✅ Trigger banner only on active failure
      const isConnectionError =
        error.message?.toLowerCase().includes('fetch') ||
        error.message?.toLowerCase().includes('network') ||
        error.message?.toLowerCase().includes('timeout') ||
        error.name === 'TypeError'; // fetch usually throws TypeError on network failure

      if (isConnectionError) {
        set({ isServerUnreachable: true });
      }

      return { success: false, error: error.message };
    }
  },

  signInWithPhone: async (user) => {
    // Store phone auth data
    localStorage.setItem('phoneAuthUser', JSON.stringify(user));
    localStorage.setItem('phoneAuthToken', 'phone_auth_' + user.id);

    // Set auth state
    set({
      user,
      dbUser: dbToFrontend(user),
      isAuthenticated: true,
      isPhoneAuth: true
    });

    // Initialize Supabase session for phone users to enable DB operations
    try {
      const { error } = await supabase.auth.setSession({
        access_token: 'phone_auth_' + user.id,
        refresh_token: 'phone_refresh_' + user.id
      });

      if (error) {
        console.warn('Phone auth session setup failed, DB operations may be limited:', error);
      }
    } catch (sessionError) {
      console.warn('Could not establish Supabase session for phone user:', sessionError);
    }
  },

  // ✅ Set offline before signing out
  signOut: async () => {
    try {
      const currentUser = get().dbUser;

      // ✅ Set user offline in database before logout
      if (currentUser?.id) {
        await supabase
          .from('users')
          .update({
            is_online: false,
            last_seen: new Date().toISOString()
          })
          .eq('id', currentUser.id);
      }
    } catch (error) {
      console.error('Error setting offline:', error);
    }

    await supabase.auth.signOut();
    localStorage.removeItem('phoneAuthUser');
    localStorage.removeItem('phoneAuthToken');
    set({
      user: null,
      session: null,
      dbUser: null,
      isAuthenticated: false,
      isPhoneAuth: false
    });
  },
}));

export default useAuthStore;
