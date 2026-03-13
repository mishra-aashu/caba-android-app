class CacheManager {
  static get(key) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const parsed = JSON.parse(item);
      const now = Date.now();

      // Check if expired
      if (parsed.expiry && now > parsed.expiry) {
        this.remove(key);
        return null;
      }

      return parsed.value;
    } catch (error) {
      console.error('Error getting from cache:', error);
      return null;
    }
  }

  static set(key, value, ttlMinutes = null) {
    try {
      const item = {
        value: value,
        timestamp: Date.now()
      };

      if (ttlMinutes) {
        item.expiry = Date.now() + (ttlMinutes * 60 * 1000);
      }

      localStorage.setItem(key, JSON.stringify(item));
      return true;
    } catch (error) {
      console.error('Error setting cache:', error);
      return false;
    }
  }

  static remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from cache:', error);
      return false;
    }
  }

  static clear() {
    try {
      // Clear only cache items (those with expiry or timestamp)
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        try {
          const item = localStorage.getItem(key);
          const parsed = JSON.parse(item);
          if (parsed.timestamp || parsed.expiry) {
            localStorage.removeItem(key);
          }
        } catch (e) {
          // Not a cache item, skip
        }
      });
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }
}

export default CacheManager;