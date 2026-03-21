import { create } from 'zustand';
import { supabase, onConnectionError } from '../config/supabase';
import { dbToFrontend } from '../utils/dbFieldMapping';
import { getRedirectUrl } from '../utils/authUtils';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { isNativeWithPlugins } from '../utils/platformCheck';
import { createClient } from '@supabase/supabase-js';

// Direct Supabase URL for bypassing proxy during OAuth redirects
const DIRECT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_DIRECT_URL;

// ✅ Track refresh timing OUTSIDE store to prevent loops
let lastRefreshTime = 0;
const MIN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes minimum
let isHandlingSession = false; // Prevent duplicate handleUserSession calls
let isRefreshing = false; // ✅ Prevent concurrent refreshSession calls
let isGoogleAuthInitialized = false; // ✅ Optimized one-time init

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
      // ── Session Migration Check (for OTA domain switches) ──
      if (isNativeWithPlugins()) {
        try {
          const { Preferences } = await import('@capacitor/preferences');
          const { value: migratedSessionJson } = await Preferences.get({ key: 'ota-migrated-session' });
          if (migratedSessionJson) {
            const migratedSession = JSON.parse(migratedSessionJson);
            // Inject into Supabase and clear from storage
            await supabase.auth.setSession({
              access_token: migratedSession.access_token,
              refresh_token: migratedSession.refresh_token
            });
            await Preferences.remove({ key: 'ota-migrated-session' });
            console.log('[Auth] ✅ Successfully picked up migrated OTA session');
          }
        } catch (e) {
          console.warn('[Auth] Session migration check failed:', e.message);
        }
      }

      // Supabase handles session persistence automatically.
      // We rely on onAuthStateChange to populate the store.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        const isAbortError = sessionError.name === 'AbortError' || sessionError.message?.toLowerCase().includes('aborted');
        if (!isAbortError) {
          console.warn('⚠️ Supabase getSession warning (likely offline):', sessionError.message);
        }
      }

      if (session?.user) {
        set({
          user: session.user,
          session: session,
          isAuthenticated: true,
        });
        await get().handleUserSession(session.user);
        set({ loading: false });
      } else {
        set({ loading: false });
      }


      // ✅ CLEAN auth state listener — no unnecessary side effects
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {

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
          return;
        }

        // ✅ CHECK 2: Only refresh if token is expiring soon
        const currentSession = get().session;
        if (currentSession?.expires_at) {
          const expiresAt = currentSession.expires_at * 1000;
          const timeUntilExpiry = expiresAt - now;

          if (timeUntilExpiry > 10 * 60 * 1000) {
            // Token valid for 10+ minutes — no refresh needed
            return;
          }
        }

        // ✅ Token expiring soon — refresh it
        if (isRefreshing) return;

        isRefreshing = true;
        lastRefreshTime = now;

        try {
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            console.error(`❌ Refresh failed (${eventName}):`, error);
            const fatalErrors = ['refresh_token_not_found', 'invalid_grant', 'expired_token'];
            if (fatalErrors.some(errMsg => error.message?.toLowerCase().includes(errMsg))) {
              console.warn('🔒 Fatal refresh error — signing out');
              get().signOut();
            }
          }
        } finally {
          isRefreshing = false;
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
      let appStateListenerPromise = null;
      if (isNativeWithPlugins()) {
        try {
          // App.addListener returns a promise (listener handle). If the plugin isn't implemented,
          // the promise can reject asynchronously, so we MUST catch it here to avoid unhandled rejections.
          appStateListenerPromise = App.addListener('appStateChange', (state) => {
            if (state.isActive) {
              smartRefresh('appStateChange');
            }
          }).catch((e) => {
            console.warn('[Auth] App listener init failed (non-fatal):', e?.message || e);
            return null;
          });
        } catch (e) {
          console.warn('[Auth] App plugin not implemented or failed:', e.message);
        }
      }

      // ✅ CIRCUIT BREAKER: Listen for terminal connectivity failures
      const unsubConnectionError = onConnectionError(() => {
        set({ isServerUnreachable: true });
      });

      // ✅ REAL cleanup — removes actual listeners
      return () => {
        subscription?.unsubscribe();
        unsubConnectionError(); // ✅ Stop listening for connection errors
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange
        );
        window.removeEventListener('online', handleOnline);
        if (appStateListenerPromise) {
          Promise.resolve(appStateListenerPromise)
            .then((listener) => {
              if (listener && typeof listener.remove === 'function') {
                return listener.remove();
              }
              return null;
            })
            .catch((e) => {
              console.warn('[Auth] App listener cleanup failed:', e?.message || e);
            });
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
      return;
    }
    isHandlingSession = true;

    try {
      console.log("🔍 Handling session for:", authUser.email);

      // Step 1: Users table me profile dhundho
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle(); // ← IMPORTANT: .single() mat use karo! (406 fix)

      if (fetchError) {
        console.error("⚠️ Fetch error:", fetchError);
      }

      // Metadata mapping for Google Login
      const metaName = authUser.user_metadata?.full_name
        || authUser.user_metadata?.name
        || authUser.email?.split('@')[0]
        || "User";

      const metaAvatar = authUser.user_metadata?.avatar_url
        || authUser.user_metadata?.picture
        || null;

      let dbUser;

      // Step 2: Agar profile NAHI mila → pehli baar login hai → CREATE karo
      if (!existingUser) {
        console.log("✨ First time Google login - creating profile for:", authUser.email);

        const profileData = {
          id: authUser.id,
          email: authUser.email,
          name: metaName,
          avatar: metaAvatar, // Correct DB column name is 'avatar'
          is_online: true,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
          ota_version: document.querySelector('meta[name="build-time"]')?.content || null,
          ota_updated_at: document.querySelector('meta[name="build-time"]')?.content ? new Date().toISOString() : null,
        };

        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .upsert(profileData, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (insertError) {
          console.error("❌ Profile create error:", insertError);
          // ✅ Crash mat karo - session se basic data use karo
          dbUser = {
            id: authUser.id,
            email: authUser.email,
            name: metaName,
            avatar: metaAvatar,
            is_online: true
          };
        } else {
          console.log("✅ Profile created successfully!");
          dbUser = newUser;
        }
      } else {
        dbUser = existingUser;
        
        // Only update if currently offline or last_seen is older than 2 mins
        const lastSeen = existingUser.last_seen ? new Date(existingUser.last_seen).getTime() : 0;
        const now = Date.now();
        const shouldUpdate = !existingUser.is_online || (now - lastSeen > 120000);

        if (shouldUpdate) {
          supabase
            .from('users')
            .update({
              is_online: true,
              last_seen: new Date().toISOString(),
              ota_version: document.querySelector('meta[name="build-time"]')?.content || null,
              ota_updated_at: document.querySelector('meta[name="build-time"]')?.content ? new Date().toISOString() : null,
            })
            .eq('id', authUser.id)
            .then(() => console.log("🟢 Online status & version updated"))
            .catch((err) => console.warn("⚠️ Online update failed:", err));
        }
      }
      
      set({ dbUser: dbToFrontend(dbUser) });
    } catch (error) {
      console.error("❌ handleUserSession crashed:", error);
      // ✅ KABHI BHI "Login to View" mat dikhao agar session valid hai
      set({
        dbUser: dbToFrontend({
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || "User",
          avatar: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
          _fallback: true
        })
      });
    } finally {
      isHandlingSession = false;
    }
  },

  signInWithGoogle: async () => {
    set({ isServerUnreachable: false }); // Reset error state on new attempt
    console.log('[Auth] signInWithGoogle initialized, platform:', Capacitor.getPlatform(), 'isNativeWithPlugins:', isNativeWithPlugins());
    try {
      if (isNativeWithPlugins()) {
        if (!isGoogleAuthInitialized) {
          try {
            await GoogleAuth.initialize({
              clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '335571630396-g270djndvqsj8p00kfgoq98995p1l3bm.apps.googleusercontent.com',
              scopes: ['profile', 'email'],
              grantOfflineAccess: true,
            });
            isGoogleAuthInitialized = true;
          } catch (initError) {
            console.warn('GoogleAuth already initialized or failed:', initError);
            isGoogleAuthInitialized = true; // Mark as true anyway to prevent retries
          }
        }
        const googleUser = await GoogleAuth.signIn();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: googleUser.authentication.idToken,
        });
        if (error) throw error;
        return { success: true };
      } else {
        const redirectUrl = getRedirectUrl();
        console.log('[Auth] Using Web OAuth flow with direct bypass redirect...');

        // Create a temporary client pointing DIRECTLY to Supabase to avoid proxy CSP blocks
        const directClient = createClient(DIRECT_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

        const { error } = await directClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            flowType: 'pkce',
            queryParams: {
              access_type: 'offline',
              prompt: 'select_account',
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

  // signInWithPhone (Legacy) was removed for security.
  // Phone linking is handled in handleUserSession and separate onboarding UI.


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
