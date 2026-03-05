import { supabase } from '../config/supabase';

const STATES = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
  POLLING: 'polling',
};

class RealtimeManager {
  constructor() {
    this.subscriptions = new Map(); // Map<string, { channel: any, status: string, config: any, callbacks: any }>
    this.pendingSubscriptions = new Map(); // Map<string, Promise<any>>
    this.reconnectTimers = new Map();
    this.retryCount = new Map();
    this.states = new Map(); // Map<string, string>
    this._killed = false;

    this.MAX_RETRIES = 8; // Approx 4 mins total with exponential backoff
    this.BASE_RETRY_DELAY = 1000;

    // Listen for auth changes globally to handle refreshed tokens/sessions
    if (typeof window !== 'undefined') {
      this._authListener = supabase.auth.onAuthStateChange((event, session) => {
        this._log('Auth event', { event });

        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          this._resubscribeAll();
        }

        // Clean up everything on sign out
        if (event === 'SIGNED_OUT') {
          this.unsubscribeAll();
        }
      });
    }
  }

  /**
   * Rule 4: Unsubscribe before resubscribe.
   * Re-establish all existing subscriptions (e.g., after token refresh)
   */
  async _resubscribeAll() {
    this._log('Re-establishing all subscriptions after auth change', { count: this.subscriptions.size });

    for (const [name, entry] of this.subscriptions.entries()) {
      // RULE 4: Clean old channel before fresh subscribe
      if (entry.channel) {
        await supabase.removeChannel(entry.channel);
      }

      this._clearReconnectTimer(name);

      if (entry.config && entry.callbacks) {
        await this.subscribe(name, entry.config, entry.callbacks);
      }
    }
  }

  /**
   * Create or update a subscription with automatic cleanup and reconnection logic
   */
  async subscribe(channelName, config, callbacks = {}) {
    if (this._killed) {
      this._log('Refusing subscribe - manager is killed', { channel: channelName });
      return null;
    }

    // Prevent overlapping subscription attempts for the same name
    if (this.pendingSubscriptions.has(channelName)) {
      return this.pendingSubscriptions.get(channelName);
    }

    this._transition(channelName, STATES.CONNECTING);

    const subscriptionPromise = (async () => {
      try {
        // Clear any existing reconnect timer when an explicit subscribe is called
        this._clearReconnectTimer(channelName);

        // If channel already exists and is healthy, just return it
        const existing = this.subscriptions.get(channelName);
        if (existing?.status === 'SUBSCRIBED') {
          return existing.channel;
        }

        console.log(`[RealtimeManager] Subscribing to: ${channelName}`);
        const channel = supabase.channel(channelName);

        // register handlers from callbacks
        Object.entries(callbacks).forEach(([event, callback]) => {
          if (!callback) return;

          if (event === 'postgres_changes') {
            const listeners = Array.isArray(callback) ? callback : [callback];
            listeners.forEach(listenerConfig => {
              const { handler, ...supabaseConfig } = listenerConfig;
              channel.on('postgres_changes', supabaseConfig, handler || (() => { }));
            });
          } else if (event === 'broadcast') {
            const configs = Array.isArray(callback) ? callback : [callback];
            configs.forEach(cfg => {
              const { event: eventName, callback: cb } = typeof cfg === 'function' ? { event: '*', callback: cfg } : cfg;
              channel.on('broadcast', { event: eventName || '*' }, cb);
            });
          } else if (event === 'presence') {
            const configs = Array.isArray(callback) ? callback : [callback];
            configs.forEach(cfg => {
              const { event: eventName, callback: cb } = typeof cfg === 'function' ? { event: '*', callback: cfg } : cfg;
              channel.on('presence', { event: eventName || 'sync' }, cb);
            });
          } else if (['onReconnect', 'onMaxRetriesReached', 'onStatusChange'].includes(event)) {
            // Internal management callbacks, handled in the subscription status listener
          } else {
            // Generic channel events (e.g., system, internal)
            channel.on(event, callback);
          }
        });

        // Set up the subscription status handler
        channel.subscribe((status, err) => {
          this._log('Status update', { channel: channelName, status, error: err });

          if (this.subscriptions.has(channelName)) {
            this.subscriptions.get(channelName).status = status;
          }

          // Rule 10: Explicit State transitions
          if (status === 'SUBSCRIBED') {
            this._transition(channelName, STATES.CONNECTED);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            this._transition(channelName, STATES.DISCONNECTED);
          }

          // Bubble up status change if requested
          if (callbacks.onStatusChange) {
            callbacks.onStatusChange(status, err);
          }

          if (status === 'SUBSCRIBED') {
            // Reset retry count on success
            const wasReconnecting = (this.retryCount.get(channelName) || 0) > 0;
            this.retryCount.set(channelName, 0);

            // Clear polling fallback if it exists
            this._clearPollTimer(channelName);

            // Trigger catch-up logic
            if (wasReconnecting && callbacks.onReconnect) {
              callbacks.onReconnect(wasReconnecting);
            }
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            this._scheduleReconnect(channelName, config, callbacks);
          }
        });

        // Store subscription data for lifecycle management
        this.subscriptions.set(channelName, {
          channel,
          status: 'SUBSCRIBING',
          config,
          callbacks
        });

        return channel;
      } catch (error) {
        console.error(`Error creating subscription ${channelName}:`, error);
        return null;
      } finally {
        this.pendingSubscriptions.delete(channelName);
      }
    })();

    this.pendingSubscriptions.set(channelName, subscriptionPromise);
    return subscriptionPromise;
  }

  /**
   * Schedule exponential backoff reconnect
   */
  _scheduleReconnect(channelName, config, callbacks) {
    this._clearReconnectTimer(channelName);

    const attempt = (this.retryCount.get(channelName) || 0) + 1;
    this.retryCount.set(channelName, attempt);

    if (attempt > this.MAX_RETRIES) {
      this._log('Max retries reached, switching to polling fallback', { channel: channelName });

      // Rule 8: Circuit Breaker / Polling Fallback
      this._transition(channelName, STATES.POLLING);

      if (callbacks.onMaxRetriesReached) {
        callbacks.onMaxRetriesReached();
      }

      this._startPollingFallback(channelName, callbacks.onReconnect);
      return;
    }

    // Rule 10: State transition
    this._transition(channelName, STATES.RECONNECTING);

    // Exponential backoff
    const delay = Math.min(this.BASE_RETRY_DELAY * Math.pow(2, attempt - 1), 30000);
    this._log('Reconnect scheduled', { channel: channelName, attempt, delay });

    const timer = setTimeout(async () => {
      // Re-subscribe using stored config
      await this.subscribe(channelName, config, callbacks);
    }, delay);

    this.reconnectTimers.set(channelName, timer);
  }

  /**
   * Manually refresh/re-subscribe to a channel
   */
  async refreshChannel(channelName) {
    const entry = this.subscriptions.get(channelName);
    if (!entry) return;

    console.log(`[RealtimeManager] Manual refresh triggered for: ${channelName}`);
    this._clearReconnectTimer(channelName);
    this.retryCount.set(channelName, 0); // Reset retry count for manual action
    return this.subscribe(channelName, entry.config, entry.callbacks);
  }

  /**
   * Clear reconnect timer for a channel
   */
  _clearReconnectTimer(channelName) {
    if (this.reconnectTimers.has(channelName)) {
      clearTimeout(this.reconnectTimers.get(channelName));
      this.reconnectTimers.delete(channelName);
    }
  }

  /**
   * Remove a specific channel subscription
   */
  async unsubscribe(channelName) {
    this._clearReconnectTimer(channelName);
    this.retryCount.delete(channelName);

    // Wait for any pending subscription promise so we don't leak
    if (this.pendingSubscriptions.has(channelName)) {
      try {
        await this.pendingSubscriptions.get(channelName);
      } catch (e) {
        // Ignore
      }
    }

    const entry = this.subscriptions.get(channelName);
    if (entry) {
      if (entry.channel) {
        await supabase.removeChannel(entry.channel);
      }
      this.subscriptions.delete(channelName);
    }
  }

  /**
   * Remove and clean up all subscriptions
   */
  unsubscribeAll() {
    this.reconnectTimers.forEach(timer => clearTimeout(timer));
    this.reconnectTimers.clear();
    this.retryCount.clear();

    const subs = Array.from(this.subscriptions.values());
    subs.forEach(entry => {
      if (entry.channel) {
        supabase.removeChannel(entry.channel);
      }
    });

    this.subscriptions.clear();
    this.pendingSubscriptions.clear();
  }

  /**
   * Return the subscription entry by name
   */
  getChannel(channelName) {
    return this.subscriptions.get(channelName) || null;
  }

  /**
   * Get overall subscription metrics
   */
  getStats() {
    return {
      activeSubscriptions: this.subscriptions.size,
      details: Array.from(this.subscriptions.entries()).map(([name, entry]) => ({
        name,
        status: entry.status,
        retries: this.retryCount.get(name) || 0
      }))
    };
  }

  /**
   * Rule 8: Low-frequency polling fallback
   */
  _startPollingFallback(channelName, onReconnect) {
    this._clearPollTimer(channelName);

    // Poll every 30s as degraded mode
    const timer = setInterval(() => {
      this._log('Polling fallback tick', { channel: channelName });
      if (onReconnect) onReconnect(true);
    }, 30000);

    if (!this.pollTimers) this.pollTimers = new Map();
    this.pollTimers.set(channelName, timer);
  }

  _clearPollTimer(channelName) {
    if (this.pollTimers?.has(channelName)) {
      clearInterval(this.pollTimers.get(channelName));
      this.pollTimers.delete(channelName);
    }
  }

  /**
   * Transition state machine with logging
   */
  _transition(channelName, newState) {
    const prev = this.states.get(channelName);
    if (prev === newState) return;

    this._log('State transition', { channel: channelName, from: prev, to: newState });
    this.states.set(channelName, newState);

    const entry = this.subscriptions.get(channelName);
    if (entry?.callbacks?.onStatusChange) {
      entry.callbacks.onStatusChange(newState, prev);
    }
  }

  /**
   * Rule 7: Kill switch for full cleanup
   */
  kill() {
    this._log('Kill switch triggered');
    this._killed = true;

    // Clean up auth listener
    if (this._authListener?.subscription) {
      this._authListener.subscription.unsubscribe();
    } else if (this._authListener?.data?.subscription) {
      this._authListener.data.subscription.unsubscribe();
    }

    for (const [name, entry] of this.subscriptions.entries()) {
      this._clearReconnectTimer(name);
      this._clearPollTimer(name);
      if (entry.channel) {
        supabase.removeChannel(entry.channel);
      }
    }

    this.subscriptions.clear();
    this.states.clear();
    this.retryCount.clear();
    this.reconnectTimers.clear();
    this.pollTimers?.clear();
  }

  /**
   * Rule 9: Structured Logging
   */
  _log(message, detail = {}) {
    console.log(`[RT] ${message}`, {
      timestamp: new Date().toISOString(),
      ...detail
    });
  }

  /**
   * Full cleanup of the manager
   */
  destroy() {
    this.kill();
  }
}

// Create singleton instance
export const realtimeManager = new RealtimeManager();

// Global unloader
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeManager.unsubscribeAll();
  });
}

export default realtimeManager;
