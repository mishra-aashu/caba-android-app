import { create } from 'zustand';
import { supabase, onConnectionError } from '../config/supabase';
import { dbToFrontend } from '../utils/dbFieldMapping';
import { getRedirectUrl } from '../utils/authUtils';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins, safePluginCall } from '../utils/platformCheck';
import { createClient } from '@supabase/supabase-js';
import { setSentryUser, addAuthBreadcrumb } from '../config/sentry';

// Direct Supabase URL for bypassing proxy during OAuth redirects
const DIRECT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_DIRECT_URL;

// ══════════════════════════════════════════════════════════════
// State Guards & Throttling
// ══════════════════════════════════════════════════════════════
let lastRefreshTime = 0;
const MIN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MIN_DB_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastDbUpdateTime = 0;
let isHandlingSession = false;
let isRefreshing = false;
let isGoogleAuthInitialized = false;
let isAuthInitialized = false;
let authCleanup = null; // Store cleanup function

// ══════════════════════════════════════════════════════════════
// Session Migration Helpers
// ══════════════════════════════════════════════════════════════

/**
 * NEW: Safely extract OAuth tokens from URL hash
 * Prevents injection attacks and validates token format
 */
const extractSessionFromUrl = () => {
  try {
    const hash = window.location.hash;
    if (!hash || hash.length < 10) return null;

    // Remove leading #
    const params = new URLSearchParams(hash.substring(1));
    
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const tokenType = params.get('token_type');

    // Validate token presence and format
    if (!accessToken || !refreshToken) return null;
    
    // Basic JWT format validation (header.payload.signature)
    const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    if (!jwtPattern.test(accessToken)) {
      console.warn('[Auth] Invalid access token format');
      return null;
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: tokenType || 'bearer',
    };
  } catch (e) {
    console.error('[Auth] Failed to extract session from URL:', e.message);
    return null;
  }
};

/**
 * NEW: Clear URL hash without triggering navigation
 */
const clearUrlHash = () => {
  try {
    // Use replaceState to avoid adding to browser history
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', cleanUrl);
  } catch (e) {
    console.warn('[Auth] Failed to clear URL hash:', e.message);
  }
};

/**
 * NEW: Migrate session from Capacitor Preferences (OTA updates)
 */
const migrateSessionFromPreferences = async () => {
  try {
    const sessionJson = await safePluginCall(
      async () => {
        const { Preferences } = await import('@capacitor/preferences');
        const { value } = await Preferences.get({ key: 'ota-migrated-session' });
        return value;
      },
      null
    );

    if (!sessionJson) return null;

    const session = JSON.parse(sessionJson);
    
    // Validate session structure
    if (!session?.access_token || !session?.refresh_token) {
      console.warn('[Auth] Invalid migrated session format');
      return null;
    }

    // Clean up after successful read
    await safePluginCall(async () => {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: 'ota-migrated-session' });
    });

    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    };
  } catch (e) {
    console.error('[Auth] Preferences migration failed:', e.message);
    return null;
  }
};

// ══════════════════════════════════════════════════════════════
// Store Definition
// ══════════════════════════════════════════════════════════════

const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  dbUser: null,
  isAuthenticated: false,
  loading: true,
  isPhoneAuth: false,
  isServerUnreachable: false,
  isDbUserLoaded: false,

  clearServerError: () => set({ isServerUnreachable: false }),

  updateDbUser: (user) => set({ dbUser: user }),

  // ══════════════════════════════════════════════════════════════
  // Authentication Initialization
  // ══════════════════════════════════════════════════════════════

  initializeAuth: async () => {
    // Prevent duplicate initialization
    if (isAuthInitialized) {
      console.warn('[Auth] Already initialized, skipping');
      return authCleanup;
    }
    
    isAuthInitialized = true;
    console.log('[Auth] 🚀 Initializing authentication system');

    try {
      // ────────────────────────────────────────────────────────
      // PHASE 1: Session Migration (URL → Preferences → Storage)
      // ────────────────────────────────────────────────────────

      let migratedSession = null;

      // 1A. Check URL Fragment (OAuth redirect)
      const urlSession = extractSessionFromUrl();
      if (urlSession) {
        console.log('[Auth] 🔑 URL session detected, migrating...');
        migratedSession = urlSession;
        clearUrlHash(); // Immediate cleanup
      }

      // 1B. Check Capacitor Preferences (OTA update scenario)
      if (!migratedSession) {
        const prefsSession = await migrateSessionFromPreferences();
        if (prefsSession) {
          console.log('[Auth] 📦 Preferences session detected, migrating...');
          migratedSession = prefsSession;
        }
      }

      // 1C. Apply migrated session if found
      if (migratedSession) {
        try {
          await supabase.auth.setSession({
            access_token: migratedSession.access_token,
            refresh_token: migratedSession.refresh_token,
          });
          console.log('[Auth] ✅ Session migration successful');
        } catch (migrationError) {
          // Don't treat migration failures as fatal
          console.warn('[Auth] ⚠️ Session migration failed:', migrationError.message);
          
          // Clear invalid session data
          clearUrlHash();
        }
      }

      // ────────────────────────────────────────────────────────
      // PHASE 2: Load Existing Session
      // ────────────────────────────────────────────────────────

      let currentSession = null;
      
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          // Filter out expected errors
          const isExpectedError = 
            error.name === 'AbortError' ||
            error.message?.toLowerCase().includes('aborted') ||
            error.message?.toLowerCase().includes('offline');

          if (!isExpectedError) {
            console.error('[Auth] ❌ getSession error:', error.message);
          }
        } else {
          currentSession = data?.session;
        }
      } catch (sessionError) {
        // Gracefully handle session retrieval failures
        console.warn('[Auth] Session retrieval failed:', sessionError.message);
      }

      // ────────────────────────────────────────────────────────
      // PHASE 3: Initialize Store State
      // ────────────────────────────────────────────────────────

      if (currentSession?.user) {
        console.log('[Auth] 👤 Existing session found for:', currentSession.user.email);
        
        set({
          user: currentSession.user,
          session: currentSession,
          isAuthenticated: true,
          loading: false,
        });

        // Load user profile (non-blocking)
        get().handleUserSession(currentSession.user).catch((err) => {
          console.error('[Auth] Profile load failed:', err.message);
        });
      } else {
        console.log('[Auth] 🔓 No active session found');
        set({ loading: false });
      }

      // ────────────────────────────────────────────────────────
      // PHASE 4: Setup Auth State Listener
      // ────────────────────────────────────────────────────────

      const { data: authData } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log(`[Auth] 🔔 Auth event: ${event}`);

          switch (event) {
            case 'INITIAL_SESSION':
              // Already handled in PHASE 2 - skip to avoid duplicate processing
              break;

            case 'SIGNED_IN': {
              if (!session?.user) break;

              const currentUser = get().user;
              const isNewSignIn = !currentUser || currentUser.id !== session.user.id;

              if (isNewSignIn) {
                console.log('[Auth] 🎉 New sign-in detected:', session.user.email);
                
                set({
                  user: session.user,
                  session,
                  isAuthenticated: true,
                });

                // Load profile in background
                get().handleUserSession(session.user).catch((err) => {
                  console.error('[Auth] Profile load failed on sign-in:', err.message);
                });
              } else {
                // Session update for same user (e.g., token refresh)
                set({ session });
              }
              break;
            }

            case 'TOKEN_REFRESHED': {
              if (!session) break;

              console.log('[Auth] 🔄 Token refreshed');
              
              // Update session and realtime auth
              set({ session });
              supabase.realtime.setAuth(session.access_token);
              lastRefreshTime = Date.now();
              
              // DO NOT call handleUserSession here - avoid unnecessary DB calls
              break;
            }

            case 'SIGNED_OUT': {
              console.log('[Auth] 👋 User signed out');
              
              set({
                user: null,
                session: null,
                dbUser: null,
                isAuthenticated: false,
                isDbUserLoaded: false,
              });
              break;
            }

            case 'USER_UPDATED': {
              if (session?.user) {
                console.log('[Auth] 👤 User metadata updated');
                set({ user: session.user, session });
              }
              break;
            }

            default:
              console.log('[Auth] Unhandled event:', event);
              break;
          }
        }
      );

      const authSubscription = authData?.subscription;

      // ────────────────────────────────────────────────────────
      // PHASE 5: Setup Smart Token Refresh
      // ────────────────────────────────────────────────────────

      const smartRefresh = async (eventName) => {
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTime;

        // Guard 1: Don't refresh too frequently
        if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
          console.log(`[Auth] Skipping refresh (${eventName}) - too soon`);
          return;
        }

        // Guard 2: Check if token is actually expiring
        const currentSession = get().session;
        if (currentSession?.expires_at) {
          const expiresAt = currentSession.expires_at * 1000;
          const timeUntilExpiry = expiresAt - now;

          if (timeUntilExpiry > 10 * 60 * 1000) {
            console.log(`[Auth] Skipping refresh (${eventName}) - token valid for ${Math.floor(timeUntilExpiry / 60000)}m`);
            return;
          }
        }

        // Guard 3: Prevent concurrent refreshes
        if (isRefreshing) {
          console.log(`[Auth] Refresh already in progress`);
          return;
        }

        // Perform refresh
        isRefreshing = true;
        lastRefreshTime = now;

        try {
          console.log(`[Auth] 🔄 Refreshing session (${eventName})...`);
          const { error } = await supabase.auth.refreshSession();

          if (error) {
            console.error(`[Auth] ❌ Refresh failed:`, error.message);

            // Detect fatal errors that require re-authentication
            const fatalErrors = [
              'refresh_token_not_found',
              'invalid_grant',
              'expired_token',
              'invalid_refresh_token',
            ];

            const isFatal = fatalErrors.some((errMsg) =>
              error.message?.toLowerCase().includes(errMsg)
            );

            if (isFatal) {
              console.warn('[Auth] 🔒 Fatal refresh error - signing out');
              await get().signOut();
            }
          } else {
            console.log('[Auth] ✅ Session refreshed successfully');
          }
        } catch (err) {
          console.error('[Auth] Refresh exception:', err.message);
        } finally {
          isRefreshing = false;
        }
      };

      // ────────────────────────────────────────────────────────
      // PHASE 6: Setup Lifecycle Event Listeners
      // ────────────────────────────────────────────────────────

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          smartRefresh('visibilitychange');
        }
      };

      const handleOnline = () => {
        console.log('[Auth] 🌐 Network online - checking session');
        set({ isServerUnreachable: false }); // Clear error banner
        smartRefresh('online');
      };

      const handleOffline = () => {
        console.log('[Auth] 📴 Network offline');
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Native app state listener
      let appListener = null;
      if (isNativeWithPlugins()) {
        safePluginCall(async () => {
          const { App } = await import('@capacitor/app');
          appListener = await App.addListener('appStateChange', (state) => {
            if (state.isActive) {
              smartRefresh('appStateChange');
            }
          });
        });
      }

      // ────────────────────────────────────────────────────────
      // PHASE 7: Setup Connection Error Monitoring
      // ────────────────────────────────────────────────────────

      const unsubConnectionError = onConnectionError(() => {
        console.error('[Auth] 🚨 Connection error detected');
        set({ isServerUnreachable: true });
      });

      // ────────────────────────────────────────────────────────
      // PHASE 8: Return Cleanup Function
      // ────────────────────────────────────────────────────────

      authCleanup = () => {
        console.log('[Auth] 🧹 Cleaning up auth listeners');

        authSubscription?.unsubscribe();
        unsubConnectionError();
        
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);

        if (appListener) {
          safePluginCall(async () => {
            if (typeof appListener.remove === 'function') {
              await appListener.remove();
            }
          });
        }

        isAuthInitialized = false;
        authCleanup = null;
      };

      return authCleanup;

    } catch (error) {
      console.error('[Auth] ❌ Initialization failed:', error);
      set({ loading: false });
      
      // Return no-op cleanup
      return () => {};
    }
  },

  // ══════════════════════════════════════════════════════════════
  // User Session Handler
  // ══════════════════════════════════════════════════════════════

  handleUserSession: async (authUser) => {
    // Prevent concurrent execution
    if (isHandlingSession) {
      console.log('[Auth] Session handling already in progress, skipping');
      return;
    }

    isHandlingSession = true;

    try {
      console.log('[Auth] 🔍 Loading profile for:', authUser.email);

      // ────────────────────────────────────────────────────────
      // Step 1: Fetch user profile from database
      // ────────────────────────────────────────────────────────

      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle(); // Use maybeSingle to avoid 406 errors

      if (fetchError) {
        console.error('[Auth] ⚠️ Profile fetch error:', fetchError.message);
      }

      // ────────────────────────────────────────────────────────
      // Step 2: Extract metadata for new users
      // ────────────────────────────────────────────────────────

      const metaName =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.email?.split('@')[0] ||
        'User';

      const metaAvatar =
        authUser.user_metadata?.avatar_url ||
        authUser.user_metadata?.picture ||
        null;

      let dbUser;

      // ────────────────────────────────────────────────────────
      // Step 3: Create profile if first-time user
      // ────────────────────────────────────────────────────────

      if (!existingUser) {
        console.log('[Auth] ✨ First-time user - creating profile');

        const buildTime = document.querySelector('meta[name="build-time"]')?.content;
        
        const profileData = {
          id: authUser.id,
          email: authUser.email,
          name: metaName,
          avatar: metaAvatar,
          is_online: true,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
          ota_version: buildTime || null,
          ota_updated_at: buildTime ? new Date().toISOString() : null,
        };

        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .upsert(profileData, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('[Auth] ❌ Profile creation failed:', insertError.message);
          
          // Fallback to metadata
          dbUser = {
            id: authUser.id,
            email: authUser.email,
            name: metaName,
            avatar: metaAvatar,
            is_online: true,
            _isFallback: true,
          };
        } else {
          console.log('[Auth] ✅ Profile created successfully');
          dbUser = newUser;
        }
      } else {
        dbUser = existingUser;

        // ────────────────────────────────────────────────────────
        // Step 4: Update online status (throttled)
        // ────────────────────────────────────────────────────────

        const now = Date.now();
        const shouldUpdate =
          !existingUser.is_online ||
          now - lastDbUpdateTime > MIN_DB_UPDATE_INTERVAL;

        if (shouldUpdate) {
          lastDbUpdateTime = now;

          const buildTime = document.querySelector('meta[name="build-time"]')?.content;

          // Fire-and-forget update (non-blocking)
          supabase
            .from('users')
            .update({
              is_online: true,
              last_seen: new Date().toISOString(),
              ota_version: buildTime || null,
              ota_updated_at: buildTime ? new Date().toISOString() : null,
            })
            .eq('id', authUser.id)
            .then(() => console.log('[Auth] 🟢 Online status updated'))
            .catch((err) => console.warn('[Auth] ⚠️ Online update failed:', err.message));
        }
      }

      // ────────────────────────────────────────────────────────
      // Step 5: Update store
      // ────────────────────────────────────────────────────────

      set({
        dbUser: dbToFrontend(dbUser),
        isDbUserLoaded: true,
      });

      // Update Sentry user context
      setSentryUser(dbUser);
      addAuthBreadcrumb('session_loaded', { userId: dbUser.id });

    } catch (error) {
      console.error('[Auth] ❌ Session handling failed:', error);

      // Provide fallback user data to prevent "Login to View" screen
      set({
        dbUser: dbToFrontend({
          id: authUser.id,
          email: authUser.email,
          name:
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            'User',
          avatar:
            authUser.user_metadata?.avatar_url ||
            authUser.user_metadata?.picture ||
            null,
          _isFallback: true,
        }),
        isDbUserLoaded: false,
      });
    } finally {
      isHandlingSession = false;
    }
  },

  // ══════════════════════════════════════════════════════════════
  // Google Sign-In
  // ══════════════════════════════════════════════════════════════

  signInWithGoogle: async () => {
    set({ isServerUnreachable: false });
    const isPlatformNative = Capacitor.isNativePlatform();
    
    console.log('[Auth] 🔐 Google sign-in initiated (native:', isPlatformNative, ')');

    try {
      // ────────────────────────────────────────────────────────
      // Native Platform: Use GoogleAuth plugin
      // ────────────────────────────────────────────────────────
      
      if (isPlatformNative) {
        const nativeResult = await safePluginCall(
          async () => {
            // Initialize GoogleAuth (one-time)
            if (!isGoogleAuthInitialized) {
              try {
                await GoogleAuth.initialize({
                  clientId:
                    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
                    '335571630396-g270djndvqsj8p00kfgoq98995p1l3bm.apps.googleusercontent.com',
                  scopes: ['profile', 'email'],
                  grantOfflineAccess: true,
                });
                isGoogleAuthInitialized = true;
                console.log('[Auth] GoogleAuth initialized');
              } catch (initError) {
                console.warn('[Auth] GoogleAuth init warning:', initError.message);
                isGoogleAuthInitialized = true; // Assume already initialized
              }
            }

            // Trigger native sign-in
            console.log('[Auth] Triggering native GoogleAuth.signIn()...');
            const googleUser = await GoogleAuth.signIn();

            if (!googleUser?.authentication?.idToken) {
              throw new Error('No ID Token returned from Google Sign-In');
            }

            // Exchange ID token with Supabase
            const { error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: googleUser.authentication.idToken,
            });

            if (error) throw error;

            console.log('[Auth] ✅ Native Google login successful');
            return { success: true };
          },
          { success: false, isBridgeError: true }
        );

        // If native failed due to bridge issues, fall through to web flow
        if (nativeResult && !nativeResult.success && nativeResult.isBridgeError) {
          console.log('[Auth] ⚠️ Native bridge unavailable, falling back to Web OAuth');
        } else {
          return nativeResult;
        }
      }

      // ────────────────────────────────────────────────────────
      // Web Platform: Use OAuth redirect flow
      // ────────────────────────────────────────────────────────

      const redirectUrl = getRedirectUrl();
      console.log('[Auth] Using Web OAuth flow with redirect:', redirectUrl);

      // Use direct Supabase client to bypass proxy CSP restrictions
      const directClient = createClient(
        DIRECT_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );

      const { error } = await directClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;

      console.log('[Auth] ✅ OAuth redirect initiated');
      return { success: true };

    } catch (error) {
      console.error('[Auth] ❌ Google Sign-In failed:', error);

      // Classify error type
      const isConnectionError =
        error.message?.toLowerCase().includes('fetch') ||
        error.message?.toLowerCase().includes('network') ||
        error.message?.toLowerCase().includes('timeout') ||
        error.name === 'TypeError';

      if (isConnectionError) {
        set({ isServerUnreachable: true });
      }

      return { success: false, error: error.message };
    }
  },

  // ══════════════════════════════════════════════════════════════
  // Sign Out
  // ══════════════════════════════════════════════════════════════

  signOut: async () => {
    try {
      const currentUser = get().dbUser;

      // Set user offline before sign-out
      if (currentUser?.id) {
        console.log('[Auth] 🔴 Setting user offline...');
        
        await supabase
          .from('users')
          .update({
            is_online: false,
            last_seen: new Date().toISOString(),
          })
          .eq('id', currentUser.id)
          .then(() => console.log('[Auth] User set offline'))
          .catch((err) => console.warn('[Auth] Offline update failed:', err.message));
      }
    } catch (error) {
      console.error('[Auth] Error setting offline:', error);
    }

    // Clear auth state
    await supabase.auth.signOut();

    // Clear Sentry user context
    setSentryUser(null);
    addAuthBreadcrumb('signed_out');

    set({
      user: null,
      session: null,
      dbUser: null,
      isAuthenticated: false,
      isPhoneAuth: false,
      isDbUserLoaded: false,
    });

    console.log('[Auth] 👋 User signed out');
  },
}));

export default useAuthStore;