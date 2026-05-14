import { supabase, supabaseRealtime } from '../config/supabase';
import { addRealtimeBreadcrumb } from '../config/sentry';

const STATES = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
  POLLING: 'polling',
  ERROR: 'error',
};

const ERROR_TYPES = {
  RECOVERABLE: 'recoverable',
  FATAL: 'fatal',
  NETWORK: 'network',
};

class RealtimeManager {
  constructor() {
    // Core state
    this.subscriptions = new Map(); // channelName -> { channel, status, config, subscribers, multiplexers, createdAt }
    this.subIdCounter = 0;
    this.pendingSubscriptions = new Map(); // channelName -> Promise
    this.pendingUnsubscribes = new Map(); // channelName -> Set<subId>
    
    // Timers
    this.reconnectTimers = new Map();
    this.reconnectDebounceTimers = new Map();
    this.pollTimers = new Map();
    this.heartbeatTimers = new Map();
    
    // Tracking
    this.retryCount = new Map();
    this.states = new Map();
    this._methodCache = new WeakMap();
    
    // Lifecycle
    this._killed = false;
    this.VERBOSE = false;
    
    // Metrics
    this.metrics = {
      totalSubscriptions: 0,
      totalReconnects: 0,
      totalErrors: 0,
      lastErrorTime: null,
      lastErrorMessage: null,
      channelMetrics: new Map(),
    };

    // Configuration
    this.MAX_RETRIES = 8;
    this.BASE_RETRY_DELAY = 1000;
    this.MAX_RETRY_DELAY = 30000;
    this.POLL_INTERVAL = 30000;
    this.HEARTBEAT_INTERVAL = 30000;
    this.RECONNECT_DEBOUNCE_MS = 2000;
    this.STALE_CONNECTION_THRESHOLD = 90000;
    this.CHANNEL_CREATION_TIMEOUT = 10000;

    if (typeof window !== 'undefined') {
      this._setupAuthListener();
      this._setupNetworkListeners();
      this._setupVisibilityListener();
      this._setupCapacitorListener();
    }
  }

  async _setupCapacitorListener() {
    try {
      const { App } = await import('@capacitor/app');
      
      this._listeners = this._listeners || {};
      this._listeners.capacitor = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && !this._killed) {
          this._log('App resumed (Capacitor) — checking connection health', { force: true });
          this._checkAllConnectionHealth();
        }
      });
    } catch (err) {
      // Not a Capacitor environment
    }
  }

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE & EVENT LISTENERS
  // ══════════════════════════════════════════════════════════════

  _setupAuthListener() {
    try {
      const { data } = supabase.auth.onAuthStateChange((event, _session) => {
        this._log('Auth event', { event });

        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          this._resubscribeAll();
        } else if (event === 'SIGNED_OUT') {
          this.unsubscribeAll();
        }
      });

      this._authSubscription = data?.subscription || null;
    } catch (error) {
      console.error('[RealtimeManager] Failed to setup auth listener:', error);
    }
  }

  _setupNetworkListeners() {
    window.addEventListener('online', () => {
      this._log('Network online', { force: true });
      this._handleNetworkReconnect();
    });

    window.addEventListener('offline', () => {
      this._log('Network offline', { force: true });
      this._pauseReconnections();
    });
  }

  _setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this._log('Tab visible — checking connection health');
        this._checkAllConnectionHealth();
      }
    });
  }

  _handleNetworkReconnect() {
    // Reset all retry counts and clear timers
    this.subscriptions.forEach((_, name) => {
      this._clearAllTimers(name);
      this.retryCount.set(name, 0);
    });

    this._resubscribeAll();
  }

  _pauseReconnections() {
    this.subscriptions.forEach((_, name) => {
      this._clearAllTimers(name);
      this._transition(name, STATES.DISCONNECTED);
    });
  }

  async _checkAllConnectionHealth() {
    const checks = Array.from(this.subscriptions.entries()).map(async ([name, entry]) => {
      if (entry.status === 'SUBSCRIBED') {
        const isStale = this._isConnectionStale(name);
        if (isStale) {
          this._log('Stale connection detected', { channel: name, force: true });
          await this.refreshChannel(name);
        }
      }
    });

    await Promise.allSettled(checks);
  }

  _isConnectionStale(channelName) {
    const metrics = this.metrics.channelMetrics.get(channelName);
    if (!metrics?.lastActivity) return false;

    const timeSinceActivity = Date.now() - metrics.lastActivity;
    return timeSinceActivity > this.STALE_CONNECTION_THRESHOLD;
  }

  async revive() {
    this._killed = false;
    this._log('Manager revived', { force: true });
    
    if (!this._authSubscription) {
      this._setupAuthListener();
    }
  }

  async _resubscribeAll() {
    this._log('Re-establishing all subscriptions', {
      count: this.subscriptions.size,
      force: true,
    });

    // Snapshot current subscriptions to avoid mutation during iteration
    const snapshot = Array.from(this.subscriptions.entries()).map(([name, entry]) => ({
      name,
      subscribers: Array.from(entry.subscribers.values()),
      channel: entry.channel,
    }));

    // Clean up all existing channels first
    await Promise.allSettled(
      snapshot.map(({ channel, name }) => 
        channel ? this._safeRemoveChannel(channel, name) : Promise.resolve()
      )
    );

    // Clear state
    this.subscriptions.clear();
    snapshot.forEach(({ name }) => {
      this._clearAllTimers(name);
      this.retryCount.set(name, 0);
    });

    // Re-subscribe all
    const resubscribePromises = snapshot.flatMap(({ name, subscribers }) =>
      subscribers.map(sub => 
        this.subscribe(name, sub.config, sub.callbacks)
      )
    );

    await Promise.allSettled(resubscribePromises);
  }

  // ══════════════════════════════════════════════════════════════
  // CORE SUBSCRIPTION LOGIC
  // ══════════════════════════════════════════════════════════════

  async subscribe(channelName, config, callbacks = {}) {
    if (this._killed) {
      this._log('Refusing subscribe — manager killed', { channel: channelName });
      return null;
    }

    if (!this._validateConfig(channelName, config)) {
      return null;
    }

    // Initialize metrics
    this.metrics.totalSubscriptions++;
    this._initChannelMetrics(channelName);

    const subId = `sub_${++this.subIdCounter}`;
    const existing = this.subscriptions.get(channelName);

    // Case 1: Channel exists and is ready
    if (existing?.channel && existing.status !== 'CLOSED') {
      return this._addSubscriberToExisting(channelName, subId, config, callbacks, existing);
    }

    // Case 2: Subscription in-flight
    if (this.pendingSubscriptions.has(channelName)) {
      try {
        await this.pendingSubscriptions.get(channelName);
        return this.subscribe(channelName, config, callbacks); // Retry
      } catch (error) {
        this._log('In-flight subscription failed', { channel: channelName, error: error.message });
        this._recordError(channelName, error, ERROR_TYPES.RECOVERABLE);
        throw error;
      }
    }

    // Case 3: Create new subscription
    return this._createNewSubscription(channelName, config, callbacks, subId);
  }

  _addSubscriberToExisting(channelName, subId, config, callbacks, existing) {
    this._log('Adding subscriber to existing channel', { channel: channelName, subId });

    // Store subscriber
    existing.subscribers.set(subId, { callbacks, config });

    // Add handlers for this subscriber
    this._addHandlersForSubscriber(existing.channel, channelName, subId, callbacks);

    const wrappedChannel = this._wrapChannel(existing.channel, channelName, subId);

    // Fire late-join events if channel already subscribed
    if (existing.status === 'SUBSCRIBED' || existing.status === 'JOINED') {
      this._fireLateJoinEvents(channelName, subId, callbacks, existing.channel);
    }

    return wrappedChannel;
  }

  async _createNewSubscription(channelName, config, callbacks, subId) {
    this._transition(channelName, STATES.CONNECTING);

    const subscriptionPromise = (async () => {
      try {
        this._clearAllTimers(channelName);

        // Clean up any existing channel
        const existing = this.subscriptions.get(channelName);
        if (existing?.channel) {
          await this._safeRemoveChannel(existing.channel, channelName);
          this.subscriptions.delete(channelName);
        }

        this._log('Creating new channel', { channel: channelName, config });

        // Create channel with timeout
        const channel = await this._createChannelWithTimeout(channelName, config);

        if (!channel) {
          throw new Error('Channel creation timed out');
        }

        // Check if unsubscribed during creation
        if (this._wasUnsubscribedDuringCreation(channelName, subId)) {
          await this._safeRemoveChannel(channel, channelName);
          return null;
        }

        // Store subscription entry
        const entry = {
          channel,
          status: 'SUBSCRIBING',
          config,
          subscribers: new Map([[subId, { callbacks, config }]]),
          multiplexers: {
            postgres: new Map(),
            broadcast: new Map(),
          },
          createdAt: Date.now(),
        };

        this.subscriptions.set(channelName, entry);

        // Setup handlers
        this._registerCoreHandlers(channel, channelName);
        this._addHandlersForSubscriber(channel, channelName, subId, callbacks);

        // Subscribe
        channel.subscribe((status, err) => {
          this._handleSubscriptionStatus(channelName, status, err);
        });

        // Start health monitoring
        this._startHeartbeat(channelName);

        return this._wrapChannel(channel, channelName, subId);

      } catch (error) {
        console.error(`[RealtimeManager] Error creating subscription ${channelName}:`, error);
        this._recordError(channelName, error, ERROR_TYPES.FATAL);
        this._transition(channelName, STATES.ERROR);
        this.subscriptions.delete(channelName);
        throw error;
      }
    })();

    this.pendingSubscriptions.set(channelName, subscriptionPromise);

    try {
      return await subscriptionPromise;
    } finally {
      this.pendingSubscriptions.delete(channelName);
    }
  }

  _wasUnsubscribedDuringCreation(channelName, subId) {
    const abortedSubs = this.pendingUnsubscribes.get(channelName);
    const wasAborted = abortedSubs && (abortedSubs.has(subId) || abortedSubs.has('__ALL__'));

    if (wasAborted) {
      this._log('Aborting subscription — unsubscribed during creation', {
        channel: channelName,
        subId,
      });

      if (abortedSubs.has(subId)) abortedSubs.delete(subId);
      if (abortedSubs.size === 0) this.pendingUnsubscribes.delete(channelName);

      return true;
    }

    return false;
  }

  async _createChannelWithTimeout(channelName, config) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Channel creation timeout')), this.CHANNEL_CREATION_TIMEOUT)
    );

    const channelPromise = Promise.resolve(
      supabaseRealtime.channel(channelName, { config })
    );

    try {
      return await Promise.race([channelPromise, timeoutPromise]);
    } catch (error) {
      this._log('Channel creation failed', { channel: channelName, error: error.message });
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // HANDLER REGISTRATION
  // ══════════════════════════════════════════════════════════════

  _registerCoreHandlers(channel, channelName) {
    // Presence sync
    channel.on('presence', { event: 'sync' }, () => {
      this._updateChannelMetric(channelName, 'lastActivity', Date.now());
      this._broadcastToSubscribers(channelName, 'presence', () => {
        return channel.presenceState();
      });
    });

    // Presence join
    channel.on('presence', { event: 'join' }, (payload) => {
      this._updateChannelMetric(channelName, 'lastActivity', Date.now());
      this._broadcastToSubscribers(channelName, 'presence_join', () => payload);
    });

    // Presence leave
    channel.on('presence', { event: 'leave' }, (payload) => {
      this._updateChannelMetric(channelName, 'lastActivity', Date.now());
      this._broadcastToSubscribers(channelName, 'presence_leave', () => payload);
    });
  }

  _broadcastToSubscribers(channelName, callbackType, getPayload) {
    const entry = this.subscriptions.get(channelName);
    if (!entry) return;

    entry.subscribers.forEach((sub) => {
      const cb = sub.callbacks?.[callbackType];
      if (!cb) return;

      const payload = getPayload();
      
      this._safeExecute(() => {
        if (typeof cb === 'function') {
          cb(payload);
        } else if (cb.callback) {
          cb.callback(payload);
        }
      }, `${callbackType} callback`);
    });
  }

  _addHandlersForSubscriber(channel, channelName, subId, callbacks) {
    const entry = this.subscriptions.get(channelName);
    if (!entry) return;

    // PostgreSQL change handlers
    this._addPostgresHandlers(channel, channelName, subId, callbacks, entry);

    // Broadcast handlers
    this._addBroadcastHandlers(channel, channelName, subId, callbacks, entry);
  }

  _addPostgresHandlers(channel, channelName, subId, callbacks, entry) {
    const pgCallbacks = callbacks?.postgres_changes;
    if (!pgCallbacks) return;

    const listeners = Array.isArray(pgCallbacks) ? pgCallbacks : [pgCallbacks];

    listeners.forEach((listenerConfig) => {
      const { handler, ...supabaseConfig } = listenerConfig;
      if (!handler) return;

      const configKey = this._getConfigKey('pg', supabaseConfig);
      let subSet = entry.multiplexers.postgres.get(configKey);

      if (!subSet) {
        // Warn if adding to active channel (Supabase limitation)
        if (entry.status === 'SUBSCRIBED' || entry.status === 'JOINED') {
          this._log('⚠️ Cannot add new postgres config to active channel', {
            channel: channelName,
            config: supabaseConfig,
            force: true,
          });
          return;
        }

        // Register new handler
        subSet = new Set([subId]);
        entry.multiplexers.postgres.set(configKey, subSet);

        channel.on('postgres_changes', supabaseConfig, (payload) => {
          this._updateChannelMetric(channelName, 'lastActivity', Date.now());
          this._executeMultiplexedHandlers(channelName, 'postgres', configKey, payload);
        });

        this._log('Registered postgres handler', { channel: channelName, configKey });
      } else {
        // Reuse existing handler
        subSet.add(subId);
        this._log('Multiplexing postgres handler', { channel: channelName, configKey, subId });
      }
    });
  }

  _addBroadcastHandlers(channel, channelName, subId, callbacks, entry) {
    const bcConfig = callbacks?.broadcast;
    if (!bcConfig) return;

    const eventName = typeof bcConfig === 'object' ? bcConfig.event : '*';
    const configKey = this._getConfigKey('bc', eventName);
    
    let subSet = entry.multiplexers.broadcast.get(configKey);

    if (!subSet) {
      subSet = new Set([subId]);
      entry.multiplexers.broadcast.set(configKey, subSet);

      channel.on('broadcast', { event: eventName }, (payload) => {
        this._updateChannelMetric(channelName, 'lastActivity', Date.now());
        this._executeMultiplexedHandlers(channelName, 'broadcast', configKey, payload);
      });

      this._log('Registered broadcast handler', { channel: channelName, eventName });
    } else {
      subSet.add(subId);
      this._log('Multiplexing broadcast handler', { channel: channelName, eventName, subId });
    }
  }

  _executeMultiplexedHandlers(channelName, type, configKey, payload) {
    const entry = this.subscriptions.get(channelName);
    if (!entry) return;

    const subSet = entry.multiplexers[type].get(configKey);
    if (!subSet) return;

    subSet.forEach((subId) => {
      const sub = entry.subscribers.get(subId);
      if (!sub) return;

      if (type === 'postgres') {
        this._executePostgresHandler(sub, configKey, payload);
      } else if (type === 'broadcast') {
        this._executeBroadcastHandler(sub, payload);
      }
    });
  }

  _executePostgresHandler(sub, configKey, payload) {
    const pgCallbacks = sub.callbacks?.postgres_changes;
    const listeners = Array.isArray(pgCallbacks) ? pgCallbacks : [pgCallbacks];

    listeners.forEach((listener) => {
      const { handler, ...sConfig } = listener;
      const listenerKey = this._getConfigKey('pg', sConfig);

      if (listenerKey === configKey && handler) {
        this._safeExecute(() => handler(payload), 'postgres_changes handler');
      }
    });
  }

  _executeBroadcastHandler(sub, payload) {
    const cb = sub.callbacks?.broadcast;
    const finalCb = typeof cb === 'function' ? cb : cb?.callback;

    if (finalCb) {
      this._safeExecute(() => finalCb(payload), 'broadcast handler');
    }
  }

  _getConfigKey(prefix, config) {
    return `${prefix}:${JSON.stringify(config)}`;
  }

  // ══════════════════════════════════════════════════════════════
  // SUBSCRIPTION STATUS HANDLING
  // ══════════════════════════════════════════════════════════════

  _handleSubscriptionStatus(channelName, status, err) {
    this._log('Channel status', {
      channel: channelName,
      status,
      error: err?.message || null,
    });

    const entry = this.subscriptions.get(channelName);
    if (entry) {
      entry.status = status;
      this._updateChannelMetric(channelName, 'lastActivity', Date.now());
    }

    if (status === 'SUBSCRIBED') {
      this._handleSubscriptionSuccess(channelName, entry);
    } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
      this._handleSubscriptionError(channelName, status, entry);
    }
  }

  _handleSubscriptionSuccess(channelName, entry) {
    this._transition(channelName, STATES.CONNECTED);

    const wasReconnecting = (this.retryCount.get(channelName) || 0) > 0;
    this.retryCount.set(channelName, 0);
    this._clearPollTimer(channelName);

    if (wasReconnecting) {
      this.metrics.totalReconnects++;
      this._updateChannelMetric(channelName, 'reconnects', (m) => (m.reconnects || 0) + 1);

      // Notify all subscribers of reconnection
      entry?.subscribers.forEach((sub) => {
        if (sub.callbacks.onReconnect) {
          this._safeExecute(() => sub.callbacks.onReconnect(true), 'onReconnect');
        }
      });
    }
  }

  _handleSubscriptionError(channelName, status, entry) {
    this._transition(channelName, STATES.DISCONNECTED);

    const errorType = status === 'TIMED_OUT' ? ERROR_TYPES.NETWORK : ERROR_TYPES.RECOVERABLE;
    this._recordError(channelName, new Error(status), errorType);

    // Don't reconnect if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this._log('Skipping reconnect — network offline', { channel: channelName });
      return;
    }

    this._scheduleDebouncedReconnect(channelName);
  }

  // ══════════════════════════════════════════════════════════════
  // LATE-JOIN EVENTS
  // ══════════════════════════════════════════════════════════════

  _fireLateJoinEvents(channelName, subId, callbacks, channel) {
    // Use setTimeout to avoid blocking
    setTimeout(() => {
      this._log('Firing late-join events', { channel: channelName, subId });

      // Fire onStatusChange
      if (callbacks.onStatusChange) {
        this._safeExecute(
          () => callbacks.onStatusChange('SUBSCRIBED'),
          'onStatusChange (late-join)'
        );
      }

      // Hydrate presence state
      if (callbacks.presence) {
        try {
          const presenceState = channel.presenceState();
          this._safeExecute(() => {
            if (typeof callbacks.presence === 'function') {
              callbacks.presence(presenceState);
            } else if (callbacks.presence.callback) {
              callbacks.presence.callback(presenceState);
            }
          }, 'presence (late-join)');
        } catch (error) {
          this._log('Failed to get presence state', { channel: channelName, error: error.message });
        }
      }
    }, 0);
  }

  // ══════════════════════════════════════════════════════════════
  // RECONNECTION LOGIC
  // ══════════════════════════════════════════════════════════════

  _scheduleDebouncedReconnect(channelName) {
    // Prevent multiple debounced reconnects
    if (this.reconnectDebounceTimers.has(channelName)) {
      return;
    }

    const timer = setTimeout(() => {
      this.reconnectDebounceTimers.delete(channelName);
      this._scheduleReconnect(channelName);
    }, this.RECONNECT_DEBOUNCE_MS);

    this.reconnectDebounceTimers.set(channelName, timer);
  }

  _scheduleReconnect(channelName) {
    this._clearReconnectTimer(channelName);

    // Don't reconnect if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this._log('Skipping reconnect — offline', { channel: channelName });
      return;
    }

    const attempt = (this.retryCount.get(channelName) || 0) + 1;
    this.retryCount.set(channelName, attempt);

    if (attempt > this.MAX_RETRIES) {
      this._log('Max retries reached — switching to polling', { channel: channelName });
      this._transition(channelName, STATES.POLLING);

      const entry = this.subscriptions.get(channelName);
      entry?.subscribers.forEach((sub) => {
        if (sub.callbacks.onMaxRetriesReached) {
          this._safeExecute(sub.callbacks.onMaxRetriesReached, 'onMaxRetriesReached');
        }
      });

      this._startPollingFallback(channelName);
      return;
    }

    this._transition(channelName, STATES.RECONNECTING);

    const delay = Math.min(
      this.BASE_RETRY_DELAY * Math.pow(2, attempt - 1),
      this.MAX_RETRY_DELAY
    );

    this._log('Reconnect scheduled', { channel: channelName, attempt, delay });

    const timer = setTimeout(async () => {
      await this._executeReconnect(channelName);
    }, delay);

    this.reconnectTimers.set(channelName, timer);
  }

  async _executeReconnect(channelName) {
    const entry = this.subscriptions.get(channelName);
    if (!entry || entry.subscribers.size === 0) {
      return;
    }

    // Snapshot subscribers
    const savedSubscribers = Array.from(entry.subscribers.values());

    // Clean up old channel
    if (entry.channel) {
      await this._safeRemoveChannel(entry.channel, channelName);
    }

    this.subscriptions.delete(channelName);

    // Re-subscribe all
    const promises = savedSubscribers.map(sub =>
      this.subscribe(channelName, sub.config, sub.callbacks)
    );

    await Promise.allSettled(promises);
  }

  async refreshChannel(channelName) {
    const entry = this.subscriptions.get(channelName);
    if (!entry) return null;

    this._log('Manual refresh triggered', { channel: channelName, force: true });

    // Clear all timers and reset state
    this._clearAllTimers(channelName);
    this.retryCount.set(channelName, 0);

    // Snapshot subscribers
    const savedSubscribers = Array.from(entry.subscribers.values());

    // Clean up
    if (entry.channel) {
      await this._safeRemoveChannel(entry.channel, channelName);
    }
    this.subscriptions.delete(channelName);

    // Re-subscribe all
    const results = await Promise.allSettled(
      savedSubscribers.map(sub => this.subscribe(channelName, sub.config, sub.callbacks))
    );

    return results[0]?.value || null;
  }

  // ══════════════════════════════════════════════════════════════
  // HEARTBEAT MONITORING
  // ══════════════════════════════════════════════════════════════

  _startHeartbeat(channelName) {
    this._clearHeartbeat(channelName);

    const timer = setInterval(() => {
      const entry = this.subscriptions.get(channelName);
      if (!entry || entry.status !== 'SUBSCRIBED') {
        this._clearHeartbeat(channelName);
        return;
      }

      if (this._isConnectionStale(channelName)) {
        this._log('Heartbeat detected stale connection', { channel: channelName, force: true });
        this.refreshChannel(channelName);
      }
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatTimers.set(channelName, timer);
  }

  _clearHeartbeat(channelName) {
    if (this.heartbeatTimers.has(channelName)) {
      clearInterval(this.heartbeatTimers.get(channelName));
      this.heartbeatTimers.delete(channelName);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // POLLING FALLBACK
  // ══════════════════════════════════════════════════════════════

  _startPollingFallback(channelName) {
    this._clearPollTimer(channelName);

    let pollCount = 0;

    const timer = setInterval(async () => {
      pollCount++;
      this._log('[POLL] Polling tick', { channel: channelName, tick: pollCount });

      const entry = this.subscriptions.get(channelName);
      if (!entry) {
        this._clearPollTimer(channelName);
        return;
      }

      // Notify subscribers
      entry.subscribers.forEach((sub) => {
        if (sub.callbacks.onReconnect) {
          this._safeExecute(() => sub.callbacks.onReconnect(true), 'onReconnect (poll)');
        }
        if (sub.callbacks.onStatusChange) {
          this._safeExecute(() => sub.callbacks.onStatusChange(STATES.POLLING), 'onStatusChange (poll)');
        }
      });

      // Try WebSocket recovery every 3 ticks (~90s)
      if (pollCount % 3 === 0) {
        this._log('[POLL] Attempting WebSocket recovery', { channel: channelName });
        await this.refreshChannel(channelName);
      }
    }, this.POLL_INTERVAL);

    this.pollTimers.set(channelName, timer);
  }

  _clearPollTimer(channelName) {
    if (this.pollTimers.has(channelName)) {
      clearInterval(this.pollTimers.get(channelName));
      this.pollTimers.delete(channelName);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // UNSUBSCRIBE LOGIC
  // ══════════════════════════════════════════════════════════════

  async unsubscribe(channelName, subId = null) {
    const entry = this.subscriptions.get(channelName);

    // Handle pending subscriptions
    if (!entry) {
      if (this.pendingSubscriptions.has(channelName)) {
        this._markForAbortion(channelName, subId);
      }
      return;
    }

    // Remove subscriber
    if (subId) {
      this._log('Removing subscriber', { channel: channelName, subId });
      this._removeSubscriberFromMultiplexers(channelName, subId, entry);
      entry.subscribers.delete(subId);
    } else {
      // Legacy: remove most recent
      const lastId = Array.from(entry.subscribers.keys()).pop();
      if (lastId) {
        this._log('Removing most recent subscriber', { channel: channelName, subId: lastId });
        this._removeSubscriberFromMultiplexers(channelName, lastId, entry);
        entry.subscribers.delete(lastId);
      }
    }

    // Clean up method cache
    if (entry.channel) {
      this._cleanupMethodCache(entry.channel);
    }

    // Keep channel alive if there are remaining subscribers
    if (entry.subscribers.size > 0) {
      this._log('Keeping channel alive', { channel: channelName, remaining: entry.subscribers.size });
      return;
    }

    // No more subscribers — clean up channel
    this._log('No more subscribers — removing channel', { channel: channelName });
    await this._cleanupChannel(channelName, entry);
  }

  _markForAbortion(channelName, subId) {
    this._log('Marking pending subscription for abortion', {
      channel: channelName,
      subId: subId || 'all',
    });

    if (!this.pendingUnsubscribes.has(channelName)) {
      this.pendingUnsubscribes.set(channelName, new Set());
    }

    const abortSet = this.pendingUnsubscribes.get(channelName);
    abortSet.add(subId || '__ALL__');
  }

  _removeSubscriberFromMultiplexers(channelName, subId, entry) {
    if (!entry.multiplexers) return;

    // Remove from postgres multiplexers
    entry.multiplexers.postgres.forEach((subSet, configKey) => {
      subSet.delete(subId);
      if (subSet.size === 0) {
        entry.multiplexers.postgres.delete(configKey);
      }
    });

    // Remove from broadcast multiplexers
    entry.multiplexers.broadcast.forEach((subSet, configKey) => {
      subSet.delete(subId);
      if (subSet.size === 0) {
        entry.multiplexers.broadcast.delete(configKey);
      }
    });
  }

  async _cleanupChannel(channelName, entry) {
    this._clearAllTimers(channelName);
    this.retryCount.delete(channelName);
    this.states.delete(channelName);
    this.metrics.channelMetrics.delete(channelName);

    if (entry.channel) {
      await this._safeRemoveChannel(entry.channel, channelName);
    }

    this.subscriptions.delete(channelName);
  }

  async unsubscribeAll() {
    this._log('Unsubscribing all channels', { count: this.subscriptions.size, force: true });

    // Clear all timers
    this._clearAllTimersGlobal();

    // Clear state
    this.retryCount.clear();
    this.states.clear();

    // Snapshot and clear subscriptions
    const entries = Array.from(this.subscriptions.values());
    this.subscriptions.clear();
    this.pendingSubscriptions.clear();
    this.pendingUnsubscribes.clear();
    this.metrics.channelMetrics.clear();

    // Remove all channels
    await Promise.allSettled(
      entries.map(entry => 
        entry.channel ? this._safeRemoveChannel(entry.channel, entry.channel.topic) : Promise.resolve()
      )
    );

    // Clear method cache
    this._methodCache = new WeakMap();
  }

  // ══════════════════════════════════════════════════════════════
  // CHANNEL WRAPPING & PROXY
  // ══════════════════════════════════════════════════════════════

  _wrapChannel(channel, channelName, subId) {
    return new Proxy(channel, {
      get: (target, prop) => {
        if (prop === 'unsubscribe') {
          return () => this.unsubscribe(channelName, subId);
        }

        const val = target[prop];
        if (typeof val === 'function') {
          // Cache bound methods
          let targetMap = this._methodCache.get(target);
          if (!targetMap) {
            targetMap = new Map();
            this._methodCache.set(target, targetMap);
          }

          if (!targetMap.has(prop)) {
            targetMap.set(prop, val.bind(target));
          }
          return targetMap.get(prop);
        }

        return val;
      },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // BROADCAST API
  // ══════════════════════════════════════════════════════════════

  async sendBroadcast(channelName, event, payload) {
    const entry = this.subscriptions.get(channelName);
    if (!entry?.channel) {
      this._log('Cannot send broadcast — channel not subscribed', { channel: channelName });
      return false;
    }

    try {
      const response = await entry.channel.send({
        type: 'broadcast',
        event,
        payload,
      });
      return response === 'ok';
    } catch (error) {
      this._log('Error sending broadcast', { channel: channelName, error: error.message });
      return false;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // STATE & TRANSITION
  // ══════════════════════════════════════════════════════════════

  _transition(channelName, newState) {
    const prev = this.states.get(channelName);
    if (prev === newState) return;

    this._log('State transition', { channel: channelName, from: prev || 'none', to: newState });
    this.states.set(channelName, newState);

    addRealtimeBreadcrumb(channelName, 'state_change', {
      from: prev,
      to: newState,
    });

    const entry = this.subscriptions.get(channelName);
    entry?.subscribers.forEach((sub) => {
      if (sub.callbacks?.onStatusChange) {
        this._safeExecute(
          () => sub.callbacks.onStatusChange(newState, prev),
          'onStatusChange'
        );
      }
    });
  }

  // ══════════════════════════════════════════════════════════════
  // METRICS & DIAGNOSTICS
  // ══════════════════════════════════════════════════════════════

  getChannel(channelName) {
    const entry = this.subscriptions.get(channelName);
    return entry?.channel || null;
  }

  getStats() {
    return {
      activeSubscriptions: this.subscriptions.size,
      totalSubscriptions: this.metrics.totalSubscriptions,
      totalReconnects: this.metrics.totalReconnects,
      totalErrors: this.metrics.totalErrors,
      lastErrorTime: this.metrics.lastErrorTime,
      lastErrorMessage: this.metrics.lastErrorMessage,
      details: Array.from(this.subscriptions.entries()).map(([name, entry]) => {
        const channelMetrics = this.metrics.channelMetrics.get(name) || {};
        return {
          name,
          status: entry.status,
          state: this.states.get(name) || 'unknown',
          retries: this.retryCount.get(name) || 0,
          subscriberCount: entry.subscribers.size,
          createdAt: entry.createdAt,
          lastActivity: channelMetrics.lastActivity,
          reconnects: channelMetrics.reconnects || 0,
          errors: channelMetrics.errors || 0,
        };
      }),
    };
  }

  getHealthStatus() {
    const stats = this.getStats();
    const now = Date.now();

    const healthyChannels = stats.details.filter(ch => ch.state === STATES.CONNECTED);
    const staleChannels = stats.details.filter(ch => {
      if (!ch.lastActivity) return false;
      return now - ch.lastActivity > this.STALE_CONNECTION_THRESHOLD;
    });

    return {
      healthy: healthyChannels.length === stats.activeSubscriptions && staleChannels.length === 0,
      activeChannels: stats.activeSubscriptions,
      healthyChannels: healthyChannels.length,
      staleChannels: staleChannels.length,
      errorRate: stats.totalErrors / Math.max(stats.totalSubscriptions, 1),
      reconnectRate: stats.totalReconnects / Math.max(stats.totalSubscriptions, 1),
    };
  }

  // ══════════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════════

  _validateConfig(channelName, config) {
    if (!channelName || typeof channelName !== 'string') {
      console.error('[RealtimeManager] Invalid channelName:', channelName);
      return false;
    }

    if (config && typeof config !== 'object') {
      console.error('[RealtimeManager] Invalid config:', config);
      return false;
    }

    return true;
  }

  _initChannelMetrics(channelName) {
    if (!this.metrics.channelMetrics.has(channelName)) {
      this.metrics.channelMetrics.set(channelName, {
        lastActivity: Date.now(),
        reconnects: 0,
        errors: 0,
      });
    }
  }

  _updateChannelMetric(channelName, key, value) {
    const metrics = this.metrics.channelMetrics.get(channelName);
    if (!metrics) return;

    if (typeof value === 'function') {
      metrics[key] = value(metrics);
    } else {
      metrics[key] = value;
    }
  }

  _recordError(channelName, error, errorType = ERROR_TYPES.RECOVERABLE) {
    this.metrics.totalErrors++;
    this.metrics.lastErrorTime = Date.now();
    this.metrics.lastErrorMessage = error.message;

    this._updateChannelMetric(channelName, 'errors', m => (m.errors || 0) + 1);

    this._log('Error recorded', {
      channel: channelName,
      error: error.message,
      type: errorType,
      force: true,
    });
  }

  _safeExecute(fn, context = 'callback') {
    try {
      fn();
    } catch (error) {
      console.error(`[RealtimeManager] Error in ${context}:`, error);
      this.metrics.totalErrors++;
    }
  }

  async _safeRemoveChannel(channel, channelName) {
    try {
      await supabaseRealtime.removeChannel(channel);
      this._log('Channel removed', { channel: channelName });
    } catch (error) {
      this._log('Channel removal failed (non-fatal)', {
        channel: channelName,
        error: error.message,
      });
    }
  }

  _cleanupMethodCache(channel) {
    if (this._methodCache.has(channel)) {
      this._methodCache.delete(channel);
    }
  }

  _clearAllTimers(channelName) {
    this._clearReconnectTimer(channelName);
    this._clearReconnectDebounce(channelName);
    this._clearPollTimer(channelName);
    this._clearHeartbeat(channelName);
  }

  _clearAllTimersGlobal() {
    this.reconnectTimers.forEach(timer => clearTimeout(timer));
    this.reconnectTimers.clear();

    this.reconnectDebounceTimers.forEach(timer => clearTimeout(timer));
    this.reconnectDebounceTimers.clear();

    this.pollTimers.forEach(timer => clearInterval(timer));
    this.pollTimers.clear();

    this.heartbeatTimers.forEach(timer => clearInterval(timer));
    this.heartbeatTimers.clear();
  }

  _clearReconnectTimer(channelName) {
    if (this.reconnectTimers.has(channelName)) {
      clearTimeout(this.reconnectTimers.get(channelName));
      this.reconnectTimers.delete(channelName);
    }
  }

  _clearReconnectDebounce(channelName) {
    if (this.reconnectDebounceTimers.has(channelName)) {
      clearTimeout(this.reconnectDebounceTimers.get(channelName));
      this.reconnectDebounceTimers.delete(channelName);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  async kill() {
    this._log('Kill switch triggered', { force: true });
    this._killed = true;

    // Clean up auth listener
    if (this._authSubscription) {
      try {
        this._authSubscription.unsubscribe();
      } catch (error) {
        // Non-fatal
      }
      this._authSubscription = null;
    }

    await this.unsubscribeAll();
  }

  async destroy() {
    return this.kill();
  }

  // ══════════════════════════════════════════════════════════════
  // LOGGING
  // ══════════════════════════════════════════════════════════════

  _log(message, detail = {}) {
    if (!this.VERBOSE && !detail.force) return;

    const wsInfo = {};

    try {
      const conn = supabaseRealtime.realtime?.conn;
      if (conn) {
        wsInfo.globalWsState =
          ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][conn.readyState] || conn.readyState;
        wsInfo.transport = conn.constructor?.name || 'unknown';
      }
    } catch (error) {
      // Non-fatal
    }

    console.log(`[RT] ${message}`, {
      timestamp: new Date().toISOString(),
      ...wsInfo,
      ...detail,
    });
  }
}

// ══════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ══════════════════════════════════════════════════════════════

export const realtimeManager = new RealtimeManager();

// Global cleanup
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeManager.unsubscribeAll();
  });
}

export default realtimeManager;