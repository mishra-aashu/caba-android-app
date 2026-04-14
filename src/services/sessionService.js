/**
 * sessionService.js
 *
 * Manages user session lifecycle:
 *   - Session registration (upsert on app load)
 *   - Heartbeat (periodic last_active update)
 *   - Session listing (for SecuritySettings UI)
 *   - Session revocation (remote logout)
 *   - Login history logging
 *
 * Uses localStorage for caba_session_id persistence.
 */

import { supabase } from '../config/supabase';
import { getDeviceInfo, getCountryFlag, getPersistentSessionId } from '../utils/deviceInfo';

// ── Constants ──
const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes

let cachedLocation = null; // Memory cache for the session
let isInitInProgress = false; // Guard for concurrent calls
let lastInitTime = 0; // Guard for rapid repeated calls
let currentDbId = null; // Store the primary key (UUID) of the current session

/**
 * Get approximate location from IP (free, no API key needed)
 * Uses ipapi.co (CORS-friendly, HTTPS supported)
 */
const getLocationFromIP = async () => {
  if (cachedLocation) return cachedLocation;

  // Skip if offline or on Vercel (where CORS often blocks it)
  if (!navigator.onLine || window.location.hostname.includes('vercel.app')) {
    return { ip: null, city: 'Offline/Vercel', country: 'Unknown', countryFlag: '🌍' };
  }

  try {
    const res = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined, // 4 second timeout
    });
    if (!res.ok) return null;
    const data = await res.json();
    
    // Mapping for ipapi.co response
    cachedLocation = {
      ip: data.ip,
      city: data.city || 'Unknown',
      country: data.country_name || 'Unknown',
      countryFlag: getCountryFlag(data.country_code),
    };
    return cachedLocation;
  } catch (err) {
    console.warn('[Session] IP Location failed:', err.message);
    // Return a placeholder to prevent repeated fetches in a loop if it's failing
    return { ip: null, city: 'Unknown', country: 'Unknown', countryFlag: '🌍' };
  }
};

/**
 * Log login event to history
 */
const logLoginEvent = async (userId, info) => {
    try {
      await supabase.from('login_history').insert({
        user_id: userId,
        device_name: info.deviceName || info.device_name || 'Unknown',
        device_type: info.deviceType || info.device_type || 'unknown',
        ip_address: info.ip || info.ip_address || null,
        city: info.city || null,
        country: info.country || null,
        country_flag: info.countryFlag || info.country_flag || null,
        login_method: info.loginMethod || info.login_method || 'unknown',
        action: info.action || 'login',
      });
    } catch (e) {
      console.warn('[Session] History log failed:', e);
    }
  };

export const sessionService = {
/**
 * Initialize session — call once when app loads (authenticated)
 *
 * @param {string} userId
 * @param {string} loginMethod — "google", "phone", etc.
 * @returns {Object} Session record
 */
async initSession(userId, loginMethod = 'google') {
  // Prevent redundant calls — especially loops
  const now = Date.now();
  if (isInitInProgress || (now - lastInitTime < 5000)) {
    console.log('[Session] Init skipped (in progress or too soon)');
    return null;
  }

  isInitInProgress = true;
  lastInitTime = now;

  try {
    const sessionId = getPersistentSessionId();
  const device = getDeviceInfo();
  const location = await getLocationFromIP();

  const sessionData = {
    user_id: userId,
    caba_session_id: sessionId,
    device_name: device.deviceName,
    device_type: device.deviceType,
    device_icon: device.deviceIcon,
    browser: device.browser,
    os: device.os,
    app_version: device.appVersion,
    ota_version: device.otaVersion || null,
    ip_address: location?.ip || null,
    city: location?.city || null,
    country: location?.country || null,
    country_flag: location?.countryFlag || null,
    is_online: true,
    is_current: true,
    last_active: new Date().toISOString(),
    login_method: loginMethod,
    ota_updated_at: device.otaVersion ? new Date().toISOString() : null,
  };

  // Upsert — update if session exists, insert if new
  const { data, error } = await supabase
    .from('user_sessions')
    .upsert(sessionData, {
      onConflict: 'user_id,caba_session_id',
    })
    .select()
    .single();

  if (error) {
    console.error('[Session] Init failed:', error);
    return null;
  }

  // Reset is_current on all OTHER sessions for this user
  await supabase
    .from('user_sessions')
    .update({ is_current: false })
    .eq('user_id', userId)
    .neq('caba_session_id', sessionId);

  // Log to login history
  await logLoginEvent(userId, {
    ...device,
    ...location,
    action: 'login',
    loginMethod,
  });

    if (data) {
        currentDbId = data.id; // Store for revocation detection
    }

    return data;
  } finally {
    isInitInProgress = false;
  }
},

/**
 * Heartbeat — update last_active timestamp
 */
async sendHeartbeat(userId) {
  const sessionId = getPersistentSessionId();

  const { error } = await supabase
    .from('user_sessions')
    .update({
      is_online: true,
      last_active: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('caba_session_id', sessionId);

  if (error) {
    console.warn('[Session] Heartbeat failed:', error.message);
  }
},

/**
 * Mark session offline
 */
async markOffline(userId) {
  const sessionId = getPersistentSessionId();

  await supabase
    .from('user_sessions')
    .update({ is_online: false })
    .eq('user_id', userId)
    .eq('caba_session_id', sessionId);
},

/**
 * Start heartbeat loop — returns cleanup function
 */
startHeartbeat(userId) {
  // Initial heartbeat
  this.sendHeartbeat(userId);

  // Periodic heartbeat
  const intervalId = setInterval(() => {
    if (navigator.onLine && !document.hidden) {
      this.sendHeartbeat(userId);
    }
  }, HEARTBEAT_INTERVAL);

  // Visibility change handler
  const handleVisibility = () => {
    if (document.hidden) {
      this.markOffline(userId);
    } else {
      this.sendHeartbeat(userId);
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  // Cleanup function
  return () => {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibility);
    this.markOffline(userId);
  };
},

/**
 * Fetch all active sessions for user
 */
async getSessions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('last_active', { ascending: false });

  if (error) {
    console.error('[Session] Fetch failed:', error);
    return [];
  }

  return data || [];
},

/**
 * Revoke a specific session (remote logout)
 */
async revokeSession(sessionId) {
  const { data, error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('id', sessionId)
    .select('user_id')
    .single();

  if (error) {
    console.error('[Session] Revoke failed:', error);
    return false;
  }

  if (data) {
    await logLoginEvent(data.user_id, { action: 'revoked' });
  }

  return true;
},

/**
 * Logout all OTHER sessions (keep current)
 */
async revokeAllOtherSessions(userId) {
  const currentSessionId = getPersistentSessionId();

  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', userId)
    .neq('caba_session_id', currentSessionId);

  if (error) {
    console.error('[Session] Revoke all failed:', error);
    return false;
  }

  await logLoginEvent(userId, { action: 'revoked_all_others' });
  return true;
},

/**
 * Subscribe to session deletions (for remote logout detection)
 */
subscribeToSessionRevocation(userId, onRevoked) {
  const currentSessionId = getPersistentSessionId();

  const channel = supabase
    .channel(`session-revoke-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'user_sessions',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        // [FIX] Use database primary key (id) for comparison.
        // For DELETE events, caba_session_id might not be in payload.old 
        // unless REPLICA IDENTITY FULL is enabled. id is always present.
        const targetId = payload.old?.id;
        
        if (targetId && targetId === currentDbId) {
          console.log('[Session] This session was revoked remotely!');
          onRevoked();
        } else if (!currentDbId && payload.old?.caba_session_id === currentSessionId) {
          // Fallback to client ID if DB ID isn't set yet (race condition on load)
          console.log('[Session] This session was revoked remotely (via client ID)!');
          onRevoked();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
},

/**
 * Fetch login history
 */
async fetchLoginHistory(userId, limit = 20) {
  const { data, error } = await supabase
    .from('login_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Session] History fetch failed:', error);
    return [];
  }

  return data || [];
},

/**
 * Update Two-Step verification status for user
 */
async updateTwoStep(userId, enabled) {
    const { error } = await supabase
        .from('users')
        .update({ two_factor_enabled: enabled })
        .eq('id', userId);
    
    if (error) throw error;
    return true;
}
};
