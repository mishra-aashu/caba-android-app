/**
 * Production Session Storage Utility
 * Secure session handling without localStorage dependency
 */

class SessionStorage {
  constructor() {
    this.memoryStore = new Map();
    this.sessionKey = 'app_session_data';
  }

  /**
   * Store session data securely
   */
  setSessionData(key, data) {
    try {
      // Store in memory for current session
      this.memoryStore.set(key, {
        data,
        timestamp: Date.now(),
        expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      });

      // Store minimal data in sessionStorage (not localStorage)
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const sessionData = {
          key,
          timestamp: Date.now(),
          expires: Date.now() + (24 * 60 * 60 * 1000)
        };
        
        sessionStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
      }

      return true;
    } catch (error) {
      console.error('❌ Error storing session data:', error);
      return false;
    }
  }

  /**
   * Get session data
   */
  getSessionData(key) {
    try {
      // Check memory store first
      const memoryData = this.memoryStore.get(key);
      if (memoryData && memoryData.expires > Date.now()) {
        return memoryData.data;
      }

      // Clean expired data
      if (memoryData && memoryData.expires <= Date.now()) {
        this.memoryStore.delete(key);
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting session data:', error);
      return null;
    }
  }

  /**
   * Remove session data
   */
  removeSessionData(key) {
    try {
      this.memoryStore.delete(key);
      
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(this.sessionKey);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error removing session data:', error);
      return false;
    }
  }

  /**
   * Clear all session data
   */
  clearAllSessions() {
    try {
      this.memoryStore.clear();
      
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.clear();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error clearing session data:', error);
      return false;
    }
  }

  /**
   * Check if session is valid
   */
  isSessionValid(key) {
    const data = this.memoryStore.get(key);
    return data && data.expires > Date.now();
  }

  /**
   * Get session expiry time
   */
  getSessionExpiry(key) {
    const data = this.memoryStore.get(key);
    return data ? data.expires : null;
  }

  /**
   * Extend session expiry
   */
  extendSession(key, additionalTime = 24 * 60 * 60 * 1000) {
    const data = this.memoryStore.get(key);
    if (data) {
      data.expires = Date.now() + additionalTime;
      this.memoryStore.set(key, data);
      return true;
    }
    return false;
  }

  /**
   * Clean expired sessions
   */
  cleanExpiredSessions() {
    const now = Date.now();
    for (const [key, data] of this.memoryStore.entries()) {
      if (data.expires <= now) {
        this.memoryStore.delete(key);
      }
    }
  }
}

// Create singleton instance
const sessionStorage = new SessionStorage();

// Auto-cleanup expired sessions every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    sessionStorage.cleanExpiredSessions();
  }, 5 * 60 * 1000);
}

export default sessionStorage;