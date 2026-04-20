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
    // Map<string, { channel, status, config, callbacks }>
    this.subscriptions = new Map();
    this.pendingSubscriptions = new Map();
    this.reconnectTimers = new Map();
    this.retryCount = new Map();
    this.states = new Map();
    this.pollTimers = new Map(); // FIX #8: Initialize in constructor
    this._killed = false;

    this.MAX_RETRIES = 8;
    this.BASE_RETRY_DELAY = 1000;
    // FIX #7: After polling fallback, retry WebSocket every 2 minutes
    this.POLL_WS_RETRY_INTERVAL = 120000;

    if (typeof window !== 'undefined') {
      // FIX #4: Store subscription handle consistently
      const { data } = supabase.auth.onAuthStateChange((event, _session) => {
        this._log('Auth event', { event });

        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          this._resubscribeAll();
        }

        if (event === 'SIGNED_OUT') {
          this.unsubscribeAll();
        }
      });

      this._authSubscription = data?.subscription || null;
    }
  }

  // ────────────────────────────────────────────
  // FIX #1: Handler Synchronization
  //
  // Allow updating callbacks on an existing SUBSCRIBED channel
  // without tearing down the WebSocket connection.
  // ────────────────────────────────────────────
  updateCallbacks(channelName, newCallbacks) {
    const entry = this.subscriptions.get(channelName);
    if (!entry) {
      this._log('updateCallbacks: channel not found, ignoring', { channel: channelName });
      return false;
    }

    // Merge new callbacks into existing entry
    entry.callbacks = { ...entry.callbacks, ...newCallbacks };
    this._log('Callbacks updated (no reconnect)', { channel: channelName });
    return true;
  }

  /**
   * Re-establish all subscriptions (e.g., after token refresh)
   */
  async _resubscribeAll() {
    this._log('Re-establishing all subscriptions after auth change', {
      count: this.subscriptions.size,
    });

    for (const [name, entry] of this.subscriptions.entries()) {
      // FIX #2: Clean old channel before re-subscribing
      if (entry.channel) {
        try {
          await supabase.removeChannel(entry.channel);
        } catch (e) {
          this._log('Failed to remove channel during resubscribe', { channel: name, error: e.message });
        }
      }

      // Remove from map so subscribe() doesn't see stale SUBSCRIBED status
      this.subscriptions.delete(name);
      this._clearReconnectTimer(name);
      this.retryCount.set(name, 0);

      if (entry.config && entry.callbacks) {
        await this.subscribe(name, entry.config, entry.callbacks);
      }
    }
  }

  /**
   * Create or update a subscription.
   *
   * FIX #1: If channel is already SUBSCRIBED and only callbacks changed,
   *         update stored callbacks without reconnecting.
   * FIX #2: Always remove old channel before creating new one.
   * FIX #3: If pending and callbacks differ, wait then sync callbacks.
   */
  async subscribe(channelName, config, callbacks = {}) {
    if (this._killed) {
      this._log('Refusing subscribe — manager is killed', { channel: channelName });
      return null;
    }

    // ── FIX #1: If already SUBSCRIBED, just sync callbacks ──
    const existing = this.subscriptions.get(channelName);
    if (existing?.status === 'SUBSCRIBED' && existing.channel) {
      this._log('Channel already subscribed — syncing callbacks only', { channel: channelName });
      existing.callbacks = callbacks;
      existing.config = config;
      return existing.channel;
    }

    // ── FIX #3: If subscription is in-flight, wait then sync callbacks ──
    if (this.pendingSubscriptions.has(channelName)) {
      this._log('Subscription in-flight — waiting then syncing callbacks', { channel: channelName });
      try {
        const channel = await this.pendingSubscriptions.get(channelName);
        // After pending resolves, sync the latest callbacks
        const entry = this.subscriptions.get(channelName);
        if (entry) {
          entry.callbacks = callbacks;
          entry.config = config;
        }
        return channel;
      } catch (e) {
        // Pending failed — fall through to create new subscription
        this._log('Pending subscription failed, creating new one', { channel: channelName });
      }
    }

    this._transition(channelName, STATES.CONNECTING);

    const subscriptionPromise = (async () => {
      try {
        this._clearReconnectTimer(channelName);

        // ── FIX #2: Remove old channel before creating new one ──
        if (existing?.channel) {
          this._log('Removing old channel before re-subscribe', { channel: channelName });
          try {
            await supabase.removeChannel(existing.channel);
          } catch (e) {
            this._log('Old channel removal failed (non-fatal)', { channel: channelName, error: e.message });
          }
          this.subscriptions.delete(channelName);
        }

        this._log('Creating new channel', { channel: channelName });
        const channel = supabase.channel(channelName);

        // ── Register handlers using the new proxy architecture ──
        this._registerHandlers(channel, channelName);

        // ── Subscribe with status tracking ──
        channel.subscribe((status, err) => {
          // FIX #5: Log transport/connection details
          this._log('Channel status', {
            channel: channelName,
            status,
            error: err?.message || null,
            transport: channel?.socket?.transport?.constructor?.name || 'unknown',
            wsState: channel?.socket?.conn?.readyState ?? 'N/A',
          });

          const entry = this.subscriptions.get(channelName);
          if (entry) {
            entry.status = status;
          }

          // ── FIX #6: Use _transition for state, but DON'T double-fire onStatusChange ──
          // _transition handles onStatusChange internally, so skip if using _transition
          if (status === 'SUBSCRIBED') {
            this._transition(channelName, STATES.CONNECTED, true /* skipCallbackFire */);

            const wasReconnecting = (this.retryCount.get(channelName) || 0) > 0;
            this.retryCount.set(channelName, 0);
            this._clearPollTimer(channelName);

            if (wasReconnecting && callbacks.onReconnect) {
              callbacks.onReconnect(true);
            }
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            this._transition(channelName, STATES.DISCONNECTED, true /* skipCallbackFire */);
            this._scheduleReconnect(channelName, config, callbacks);
          }

          // Fire callback from the stored (latest) callbacks
          const currentCallbacks = this.subscriptions.get(channelName)?.callbacks;
          if (currentCallbacks?.onStatusChange) {
            currentCallbacks.onStatusChange(status, err);
          }
        });

        this.subscriptions.set(channelName, {
          channel,
          status: 'SUBSCRIBING',
          config,
          callbacks,
        });

        return channel;
      } catch (error) {
        console.error(`[RealtimeManager] Error creating subscription ${channelName}:`, error);
        this._transition(channelName, STATES.DISCONNECTED);
        return null;
      } finally {
        this.pendingSubscriptions.delete(channelName);
      }
    })();

    this.pendingSubscriptions.set(channelName, subscriptionPromise);
    return subscriptionPromise;
  }

  /**
   * Register postgres_changes, broadcast, and presence handlers on a channel.
   * Extracted for clarity and reuse.
   */
  _registerHandlers(channel, channelName) {
    // ────────────────────────────────────────────
    // DYNAMIC PROXY HANDLERS
    // ────────────────────────────────────────────
    // Instead of passing the callback directly to Supabase (which makes it stale),
    // we pass a wrapper that always looks up the LATEST callback from this.subscriptions.
    
    // 1. Presence Proxy
    channel.on('presence', { event: 'sync' }, () => {
      const entry = this.subscriptions.get(channelName);
      const cb = entry?.callbacks?.presence;
      if (typeof cb === 'function') cb();
      else if (cb?.callback) cb.callback();
    });

    channel.on('presence', { event: 'join' }, (payload) => {
      const entry = this.subscriptions.get(channelName);
      const cb = entry?.callbacks?.presence_join || entry?.callbacks?.presence;
      if (typeof cb === 'function' && entry?.callbacks?.presence_join) cb(payload);
    });

    channel.on('presence', { event: 'leave' }, (payload) => {
      const entry = this.subscriptions.get(channelName);
      const cb = entry?.callbacks?.presence_leave || entry?.callbacks?.presence;
      if (typeof cb === 'function' && entry?.callbacks?.presence_leave) cb(payload);
    });

    // 2. Postgres Changes Proxy
    const initialEntry = this.subscriptions.get(channelName);
    const pgCallbacks = initialEntry?.callbacks?.postgres_changes;
    if (pgCallbacks) {
      const listeners = Array.isArray(pgCallbacks) ? pgCallbacks : [pgCallbacks];
      listeners.forEach((listenerConfig, index) => {
        const { handler, ...supabaseConfig } = listenerConfig;
        channel.on('postgres_changes', supabaseConfig, (payload) => {
          const latestEntry = this.subscriptions.get(channelName);
          const latestCbs = latestEntry?.callbacks?.postgres_changes;
          const latestListeners = Array.isArray(latestCbs) ? latestCbs : [latestCbs];
          const latestHandler = latestListeners[index]?.handler;
          if (latestHandler) latestHandler(payload);
        });
      });
    }

    // 3. Broadcast Proxy
    channel.on('broadcast', { event: '*' }, (payload) => {
      const entry = this.subscriptions.get(channelName);
      const cb = entry?.callbacks?.broadcast;
      if (typeof cb === 'function') cb(payload);
      else if (cb?.callback) cb.callback(payload);
    });
  }

  /**
   * Schedule exponential backoff reconnect
   */
  _scheduleReconnect(channelName, config, callbacks) {
    this._clearReconnectTimer(channelName);

    const attempt = (this.retryCount.get(channelName) || 0) + 1;
    this.retryCount.set(channelName, attempt);

    if (attempt > this.MAX_RETRIES) {
      this._log('Max retries reached — switching to polling fallback', { channel: channelName });
      this._transition(channelName, STATES.POLLING);

      if (callbacks.onMaxRetriesReached) {
        callbacks.onMaxRetriesReached();
      }

      this._startPollingFallback(channelName, config, callbacks);
      return;
    }

    this._transition(channelName, STATES.RECONNECTING);

    const delay = Math.min(this.BASE_RETRY_DELAY * Math.pow(2, attempt - 1), 30000);
    this._log('Reconnect scheduled', { channel: channelName, attempt, delay });

    const timer = setTimeout(async () => {
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

    this._log('Manual refresh triggered', { channel: channelName });
    this._clearReconnectTimer(channelName);
    this._clearPollTimer(channelName);
    this.retryCount.set(channelName, 0);

    // FIX #2: Force remove old channel for a clean reconnect
    if (entry.channel) {
      try {
        await supabase.removeChannel(entry.channel);
      } catch (e) {
        // non-fatal
      }
      this.subscriptions.delete(channelName);
    }

    return this.subscribe(channelName, entry.config, entry.callbacks);
  }

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
    this._clearPollTimer(channelName);
    this.retryCount.delete(channelName);
    this.states.delete(channelName);

    // Wait for any pending subscription so we don't leak
    if (this.pendingSubscriptions.has(channelName)) {
      try {
        await this.pendingSubscriptions.get(channelName);
      } catch (e) {
        // Ignore
      }
      this.pendingSubscriptions.delete(channelName);
    }

    const entry = this.subscriptions.get(channelName);
    if (entry) {
      if (entry.channel) {
        try {
          await supabase.removeChannel(entry.channel);
        } catch (e) {
          this._log('Channel removal failed during unsubscribe', {
            channel: channelName,
            error: e.message,
          });
        }
      }
      this.subscriptions.delete(channelName);
    }
  }

  /**
   * Remove and clean up all subscriptions
   */
  unsubscribeAll() {
    this._log('Unsubscribing all channels', { count: this.subscriptions.size });

    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();

    this.pollTimers.forEach((timer) => clearInterval(timer));
    this.pollTimers.clear();

    this.retryCount.clear();
    this.states.clear();

    const subs = Array.from(this.subscriptions.values());
    subs.forEach((entry) => {
      if (entry.channel) {
        try {
          supabase.removeChannel(entry.channel);
        } catch (e) {
          // non-fatal during cleanup
        }
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
        state: this.states.get(name) || 'unknown',
        retries: this.retryCount.get(name) || 0,
      })),
    };
  }

  /**
   * FIX #7: Polling fallback that also periodically retries WebSocket
   */
  _startPollingFallback(channelName, config, callbacks) {
    this._clearPollTimer(channelName);

    let pollCount = 0;

    const timer = setInterval(async () => {
      pollCount++;
      this._log('[POLL] Polling fallback tick', { channel: channelName, tick: pollCount });

      // Fire the reconnect/catch-up callback for data polling
      const currentCallbacks = this.subscriptions.get(channelName)?.callbacks || callbacks;
      if (currentCallbacks.onReconnect) {
        currentCallbacks.onReconnect(true);
      }

      // FIX #7: Every N ticks, try to re-establish WebSocket
      // 30s * 4 = every ~2 minutes
      if (pollCount % 4 === 0) {
        this._log('[POLL] Attempting WebSocket recovery', { channel: channelName });

        // Clean existing dead channel
        const entry = this.subscriptions.get(channelName);
        if (entry?.channel) {
          try {
            await supabase.removeChannel(entry.channel);
          } catch (e) {
            // non-fatal
          }
          this.subscriptions.delete(channelName);
        }

        this.retryCount.set(channelName, 0);

        // Attempt fresh subscribe — if it succeeds, the SUBSCRIBED handler
        // will call _clearPollTimer and stop this interval
        const currentConfig = entry?.config || config;
        const currentCbs = entry?.callbacks || callbacks;
        await this.subscribe(channelName, currentConfig, currentCbs);
      }
    }, 30000);

    this.pollTimers.set(channelName, timer);
  }

  _clearPollTimer(channelName) {
    if (this.pollTimers.has(channelName)) {
      clearInterval(this.pollTimers.get(channelName));
      this.pollTimers.delete(channelName);
    }
  }

  /**
   * FIX #6: Transition with optional skipCallbackFire
   * to prevent double-firing onStatusChange from both
   * _transition AND the subscribe() status handler
   */
  _transition(channelName, newState, skipCallbackFire = false) {
    const prev = this.states.get(channelName);
    if (prev === newState) return;

    this._log('State transition', { channel: channelName, from: prev || 'none', to: newState });
    this.states.set(channelName, newState);

    if (!skipCallbackFire) {
      const entry = this.subscriptions.get(channelName);
      if (entry?.callbacks?.onStatusChange) {
        entry.callbacks.onStatusChange(newState, prev);
      }
    }
  }

  /**
   * Kill switch for full cleanup
   */
  kill() {
    this._log('Kill switch triggered');
    this._killed = true;

    // FIX #4: Clean up auth listener
    if (this._authSubscription) {
      try {
        this._authSubscription.unsubscribe();
      } catch (e) {
        // non-fatal
      }
      this._authSubscription = null;
    }

    for (const [name] of this.subscriptions.entries()) {
      this._clearReconnectTimer(name);
      this._clearPollTimer(name);
    }

    // Remove all channels
    for (const [, entry] of this.subscriptions.entries()) {
      if (entry.channel) {
        try {
          supabase.removeChannel(entry.channel);
        } catch (e) {
          // non-fatal during kill
        }
      }
    }

    this.subscriptions.clear();
    this.states.clear();
    this.retryCount.clear();
    this.reconnectTimers.clear();
    this.pollTimers.clear();
    this.pendingSubscriptions.clear();
  }

  /**
   * FIX #5: Enhanced logging with WebSocket state info
   */
  _log(message, detail = {}) {
    const wsInfo = {};

    // Try to extract global WebSocket state from Supabase client
    try {
      const conn = supabase.realtime?.conn;
      if (conn) {
        wsInfo.globalWsState = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][conn.readyState] || conn.readyState;
        wsInfo.transport = conn.constructor?.name || 'unknown';
      }
    } catch (e) {
      // non-fatal
    }

    console.log(`[RT] ${message}`, {
      timestamp: new Date().toISOString(),
      ...wsInfo,
      ...detail,
    });
  }

  /**
   * Full cleanup alias
   */
  destroy() {
    this.kill();
  }
}

// ── Singleton ──
export const realtimeManager = new RealtimeManager();

// Global unloader
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeManager.unsubscribeAll();
  });
}

export default realtimeManager;