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
    // Map<string, { channel, status, config, subscribers: Map<string, { callbacks, config }> }>
    this.subscriptions = new Map();
    this.subIdCounter = 0;
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
      this._setupAuthListener();
    }
  }

  _setupAuthListener() {
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

  /**
   * Allow the manager to be reused after kill()
   */
  revive() {
    this._killed = false;
    this._log('Manager revived');
    if (!this._authSubscription) {
      this._setupAuthListener();
    }
  }


  async _resubscribeAll() {
    this._log('Re-establishing all subscriptions after auth change', {
      count: this.subscriptions.size,
    });

    // FIX: Snapshot entries first to avoid mutation during iteration
    const entries = Array.from(this.subscriptions.entries());

    for (const [name, entry] of entries) {
      // FIX #2: Clean old channel before re-subscribing
      if (entry.channel) {
        try {
          await supabase.removeChannel(entry.channel);
        } catch (e) {
          this._log('Failed to remove channel during resubscribe', { channel: name, error: e.message });
        }
      }

      // Capture subscribers before deleting entry
      const savedSubscribers = Array.from(entry.subscribers.values());

      // Remove from map so subscribe() doesn't see stale SUBSCRIBED status
      this.subscriptions.delete(name);
      this._clearReconnectTimer(name);
      this.retryCount.set(name, 0);

      // Re-subscribe each one
      for (const sub of savedSubscribers) {
        await this.subscribe(name, sub.config, sub.callbacks);
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

    // ── FIX #1: If already exists, add new subscriber ──
    const existing = this.subscriptions.get(channelName);
    const subId = `sub_${++this.subIdCounter}`;

    if (existing?.channel) {
      this._log('Adding subscriber to existing channel', { channel: channelName, subId });
      
      existing.subscribers.set(subId, { callbacks, config });
      
      // Register handlers for this specific subscriber on the existing channel
      this._addHandlersForSubscriber(existing.channel, channelName, subId, callbacks);

      // Override the channel's own unsubscribe for this specific "view"
      const wrappedChannel = this._wrapChannel(existing.channel, channelName, subId);

      if (existing.status === 'SUBSCRIBED') {
        setTimeout(() => {
          this._log('Firing late-join SUBSCRIBED status', { channel: channelName, subId });
          if (callbacks.onStatusChange) callbacks.onStatusChange('SUBSCRIBED');
          
          // Also fire presence sync immediately so the new subscriber gets current state
          const pCb = callbacks.presence;
          if (pCb) {
            if (typeof pCb === 'function') pCb();
            else if (pCb.callback) pCb.callback();
          }
        }, 0);
      }
      return wrappedChannel;
    }

    // ── FIX #3: If subscription is in-flight, wait then try again ──
    if (this.pendingSubscriptions.has(channelName)) {
      this._log('Subscription in-flight — waiting', { channel: channelName });
      try {
        await this.pendingSubscriptions.get(channelName);
        // After pending resolves, the channel exists in this.subscriptions.
        // Recurse to enter the existing?.channel branch cleanly.
        return this.subscribe(channelName, config, callbacks);
      } catch (e) {
        this._log('Pending subscription failed, will create new one', { channel: channelName });
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

        this._log('Creating new channel', { channel: channelName, config });
        const channel = supabase.channel(channelName, { config });

        this.subscriptions.set(channelName, {
          channel,
          status: 'SUBSCRIBING',
          subscribers: new Map([[subId, { callbacks, config }]]),
        });

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

          const sEntry = this.subscriptions.get(channelName);
          if (sEntry) {
            sEntry.status = status;
          }

          // ── FIX #6: Use _transition for state ──
          if (status === 'SUBSCRIBED') {
            this._transition(channelName, STATES.CONNECTED);

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
            this._transition(channelName, STATES.DISCONNECTED);
            this._scheduleReconnect(channelName, config, callbacks);
          }

          // Callbacks are now fired via _transition for state changes.
          // Supabase specific events (SUBSCRIBED, CLOSED etc) that don't map to transition
          // are handled by the channel.subscribe callback if needed, but for now _transition covers it.
        });

        return this._wrapChannel(channel, channelName, subId);
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
    // Register Presence
    channel.on('presence', { event: 'sync' }, () => {
      const entry = this.subscriptions.get(channelName);
      if (entry) {
        entry.subscribers.forEach(sub => {
          const cb = sub.callbacks?.presence;
          if (typeof cb === 'function') cb();
          else if (cb?.callback) cb.callback();
        });
      }
    });

    channel.on('presence', { event: 'join' }, (payload) => {
      const entry = this.subscriptions.get(channelName);
      if (entry) {
        entry.subscribers.forEach(sub => {
          const cb = sub.callbacks?.presence_join || sub.callbacks?.presence;
          if (typeof cb === 'function' && sub.callbacks?.presence_join) cb(payload);
        });
      }
    });

    channel.on('presence', { event: 'leave' }, (payload) => {
      const entry = this.subscriptions.get(channelName);
      if (entry) {
        entry.subscribers.forEach(sub => {
          const cb = sub.callbacks?.presence_leave || sub.callbacks?.presence;
          if (typeof cb === 'function' && sub.callbacks?.presence_leave) cb(payload);
        });
      }
    });

    // Register handlers for the FIRST subscriber
    const initialEntry = this.subscriptions.get(channelName);
    const subId = Array.from(initialEntry?.subscribers.keys() || [])[0];
    const callbacks = initialEntry?.subscribers.get(subId)?.callbacks;
    if (subId && callbacks) {
      this._addHandlersForSubscriber(channel, channelName, subId, callbacks);
    }
  }

  /**
   * Register Postgres and Broadcast handlers for a specific subscriber.
   * Can be called multiple times for the same channel.
   */
  _addHandlersForSubscriber(channel, channelName, subId, callbacks) {
    // 1. Postgres Changes
    const pgCallbacks = callbacks?.postgres_changes;
    if (pgCallbacks) {
      const listeners = Array.isArray(pgCallbacks) ? pgCallbacks : [pgCallbacks];
      listeners.forEach((listenerConfig, index) => {
        const { handler, ...supabaseConfig } = listenerConfig;
        channel.on('postgres_changes', supabaseConfig, (payload) => {
          const entry = this.subscriptions.get(channelName);
          const subscriber = entry?.subscribers.get(subId);
          const latestCbs = subscriber?.callbacks?.postgres_changes;
          const latestListeners = Array.isArray(latestCbs) ? latestCbs : [latestCbs];
          const latestHandler = latestListeners[index]?.handler;
          if (latestHandler) latestHandler(payload);
        });
      });
    }

    // 2. Broadcast
    // FIX: Require specific event names for broadcast to avoid '*' issues
    const bcConfig = callbacks?.broadcast;
    if (bcConfig) {
      const eventName = typeof bcConfig === 'object' ? bcConfig.event : '*';
      if (eventName === '*') {
        this._log('Warning: Broadcast wildcard "*" might not be supported by Supabase', { channel: channelName });
      }
      
      channel.on('broadcast', { event: eventName }, (payload) => {
        const entry = this.subscriptions.get(channelName);
        const subscriber = entry?.subscribers.get(subId);
        const cb = subscriber?.callbacks?.broadcast;
        const finalCb = typeof cb === 'function' ? cb : cb?.callback;
        if (finalCb) finalCb(payload);
      });
    }
  }

  /**
   * Internal helper to wrap a channel with reference-counted unsubscribe
   */
  _wrapChannel(channel, channelName, subId) {
    // Create a proxy-like object that delegates to the channel
    // but has its own unsubscribe method
    return new Proxy(channel, {
      get: (target, prop) => {
        if (prop === 'unsubscribe') {
          return () => this.unsubscribe(channelName, subId);
        }
        const val = target[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      }
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
    }

    // FIX: Snapshot all subscribers before clearing
    const savedSubscribers = Array.from(entry.subscribers.values());
    this.subscriptions.delete(channelName);

    // Restore ALL subscribers
    const results = [];
    for (const sub of savedSubscribers) {
      results.push(await this.subscribe(channelName, sub.config, sub.callbacks));
    }
    return results[0];
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
  async unsubscribe(channelName, subId = null) {
    const entry = this.subscriptions.get(channelName);
    if (!entry) return;

    if (subId) {
      this._log('Removing specific subscriber', { channel: channelName, subId });
      entry.subscribers.delete(subId);
    } else {
      // Legacy behavior: remove the most recent subscriber
      const lastId = Array.from(entry.subscribers.keys()).pop();
      this._log('Removing most recent subscriber (legacy call)', { channel: channelName, subId: lastId });
      if (lastId) entry.subscribers.delete(lastId);
    }

    if (entry.subscribers.size > 0) {
      this._log('Remaining subscribers, keeping channel open', { 
        channel: channelName, 
        count: entry.subscribers.size 
      });
      return;
    }

    this._log('No more subscribers, removing channel', { channel: channelName });
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

  /**
   * Remove and clean up all subscriptions
   */
  async unsubscribeAll() {
    this._log('Unsubscribing all channels', { count: this.subscriptions.size });

    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();

    this.pollTimers.forEach((timer) => clearInterval(timer));
    this.pollTimers.clear();

    this.retryCount.clear();
    this.states.clear();

    const entries = Array.from(this.subscriptions.values());
    this.subscriptions.clear();
    this.pendingSubscriptions.clear();

    // FIX: Await all channel removals properly
    await Promise.allSettled(
      entries.map(async (entry) => {
        if (entry.channel) {
          try {
            await supabase.removeChannel(entry.channel);
          } catch (e) {
            // non-fatal during cleanup
          }
        }
      })
    );
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

      // Fire the reconnect/catch-up callback for data polling for ALL subscribers
      const entry = this.subscriptions.get(channelName);
      if (entry) {
        entry.subscribers.forEach(sub => {
          if (sub.callbacks.onReconnect) {
            sub.callbacks.onReconnect(true);
          }
        });
      } else if (callbacks.onReconnect) {
        callbacks.onReconnect(true);
      }

      // FIX #7: Every N ticks, try to re-establish WebSocket
      // 30s * 4 = every ~2 minutes
      if (pollCount % 4 === 0) {
        this._log('[POLL] Attempting WebSocket recovery', { channel: channelName });

        // FIX: Snapshot subscribers before cleanup
        const currentEntry = this.subscriptions.get(channelName);
        const savedSubscribers = currentEntry ? Array.from(currentEntry.subscribers.values()) : null;

        // Clean existing dead channel
        if (currentEntry?.channel) {
          try {
            await supabase.removeChannel(currentEntry.channel);
          } catch (e) {
            // non-fatal
          }
          this.subscriptions.delete(channelName);
        }

        this.retryCount.set(channelName, 0);

        // Attempt fresh subscribe for all saved subscribers
        if (savedSubscribers?.length > 0) {
          for (const sub of savedSubscribers) {
            await this.subscribe(channelName, sub.config, sub.callbacks);
          }
        } else {
          await this.subscribe(channelName, config, callbacks);
        }
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
  _transition(channelName, newState) {
    const prev = this.states.get(channelName);
    if (prev === newState) return;

    this._log('State transition', { channel: channelName, from: prev || 'none', to: newState });
    this.states.set(channelName, newState);

    const entry = this.subscriptions.get(channelName);
    if (entry) {
      entry.subscribers.forEach(sub => {
        if (sub.callbacks?.onStatusChange) {
          sub.callbacks.onStatusChange(newState, prev);
        }
      });
    }
  }

  /**
   * Kill switch for full cleanup
   */
  async kill() {
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

    // Capture and clean
    const entries = Array.from(this.subscriptions.values());
    this.subscriptions.clear();
    this.states.clear();
    this.retryCount.clear();
    this.reconnectTimers.clear();
    this.pollTimers.clear();
    this.pendingSubscriptions.clear();

    // Remove all channels
    await Promise.allSettled(
      entries.map(async (entry) => {
        if (entry.channel) {
          try {
            await supabase.removeChannel(entry.channel);
          } catch (e) {
            // non-fatal during kill
          }
        }
      })
    );
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