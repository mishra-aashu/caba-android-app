import { supabase, supabaseRealtime } from '../config/supabase';

const STATES = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
  POLLING: 'polling',
  ERROR: 'error',
};

// Error severity classification
const ERROR_TYPES = {
  RECOVERABLE: 'recoverable',
  FATAL: 'fatal',
  NETWORK: 'network',
};

class RealtimeManager {
  constructor() {
    // Map<string, { channel, status, config, subscribers: Map<string, { callbacks, config }> }>
    this.subscriptions = new Map();
    this.subIdCounter = 0;
    this.pendingSubscriptions = new Map();
    this.pendingUnsubscribes = new Map(); // Map<channelName, Set<subId>>
    this.reconnectTimers = new Map();
    this.retryCount = new Map();
    this.states = new Map();
    this.pollTimers = new Map();
    this.heartbeatTimers = new Map(); // NEW: Connection health monitoring
    this.reconnectDebounceTimers = new Map(); // NEW: Prevent reconnect storms
    this._killed = false;
    this.VERBOSE = false;

    // Cache for bound Proxy methods to avoid GC pressure
    this._methodCache = new WeakMap();

    // NEW: Metrics tracking
    this.metrics = {
      totalSubscriptions: 0,
      totalReconnects: 0,
      totalErrors: 0,
      lastErrorTime: null,
      lastErrorMessage: null,
      channelMetrics: new Map(), // Per-channel metrics
    };

    this.MAX_RETRIES = 8;
    this.BASE_RETRY_DELAY = 1000;
    this.POLL_WS_RETRY_INTERVAL = 120000;
    this.HEARTBEAT_INTERVAL = 30000; // NEW: 30s heartbeat
    this.RECONNECT_DEBOUNCE_MS = 2000; // NEW: Debounce reconnections
    this.STALE_CONNECTION_THRESHOLD = 90000; // NEW: 90s without activity = stale

    if (typeof window !== 'undefined') {
      this._setupAuthListener();
      this._setupNetworkListeners(); // NEW: Network state monitoring
    }
  }

  // ══════════════════════════════════════════════════════════════
  // NEW: Network & Lifecycle Listeners
  // ══════════════════════════════════════════════════════════════

  _setupNetworkListeners() {
    if (typeof window === 'undefined') return;

    // Handle online/offline events
    window.addEventListener('online', () => {
      this._log('Network online — triggering reconnect', { force: true });
      this._handleNetworkReconnect();
    });

    window.addEventListener('offline', () => {
      this._log('Network offline — pausing reconnection attempts', { force: true });
      this._pauseReconnections();
    });

    // Handle visibility changes (tab becomes active)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this._log('Tab visible — checking connection health');
        this._checkAllConnectionHealth();
      }
    });
  }

  _setupAuthListener() {
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

  // ══════════════════════════════════════════════════════════════
  // NEW: Network Event Handlers
  // ══════════════════════════════════════════════════════════════

  _handleNetworkReconnect() {
    // Clear all pending reconnect timers
    for (const [name] of this.subscriptions) {
      this._clearReconnectTimer(name);
      this.retryCount.set(name, 0); // Reset retry count on network recovery
    }

    // Trigger resubscribe for all channels
    this._resubscribeAll();
  }

  _pauseReconnections() {
    // Clear all active reconnect timers while offline
    for (const [name] of this.subscriptions) {
      this._clearReconnectTimer(name);
      this._clearReconnectDebounce(name);
      this._transition(name, STATES.DISCONNECTED);
    }
  }

  async _checkAllConnectionHealth() {
    for (const [name, entry] of this.subscriptions) {
      if (entry.status === 'SUBSCRIBED') {
        const isStale = await this._isConnectionStale(name);
        if (isStale) {
          this._log('Stale connection detected, refreshing', { channel: name, force: true });
          await this.refreshChannel(name);
        }
      }
    }
  }

  async _isConnectionStale(channelName) {
    const metrics = this.metrics.channelMetrics.get(channelName);
    if (!metrics || !metrics.lastActivity) return false;

    const timeSinceActivity = Date.now() - metrics.lastActivity;
    return timeSinceActivity > this.STALE_CONNECTION_THRESHOLD;
  }

  // ══════════════════════════════════════════════════════════════
  // Manager Lifecycle
  // ══════════════════════════════════════════════════════════════

  revive() {
    this._killed = false;
    this._log('Manager revived', { force: true });
    if (!this._authSubscription) {
      this._setupAuthListener();
    }
  }

  async _resubscribeAll() {
    this._log('Re-establishing all subscriptions after auth change', {
      count: this.subscriptions.size,
      force: true,
    });

    const entries = Array.from(this.subscriptions.entries());

    for (const [name, entry] of entries) {
      // Clean old channel before re-subscribing
      if (entry.channel) {
        await this._safeRemoveChannel(entry.channel, name);
      }

      // Capture subscribers before deleting entry
      const savedSubscribers = Array.from(entry.subscribers.values());

      // Remove from map so subscribe() doesn't see stale SUBSCRIBED status
      this.subscriptions.delete(name);
      this._clearReconnectTimer(name);
      this._clearHeartbeat(name);
      this.retryCount.set(name, 0);

      // Re-subscribe each one
      for (const sub of savedSubscribers) {
        await this.subscribe(name, sub.config, sub.callbacks);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // Core Subscription Logic
  // ══════════════════════════════════════════════════════════════

  async subscribe(channelName, config, callbacks = {}) {
    if (this._killed) {
      this._log('Refusing subscribe — manager is killed', { channel: channelName });
      return null;
    }

    // NEW: Validate config
    if (!this._validateConfig(channelName, config)) {
      this._log('Invalid config — aborting subscribe', { channel: channelName, config });
      return null;
    }

    // Track metrics
    this.metrics.totalSubscriptions++;
    this._initChannelMetrics(channelName);

    const existing = this.subscriptions.get(channelName);
    const subId = `sub_${++this.subIdCounter}`;

    // ── Add subscriber to existing channel ──
    if (existing?.channel) {
      this._log('Adding subscriber to existing channel', { channel: channelName, subId });

      existing.subscribers.set(subId, { callbacks, config });
      this._addHandlersForSubscriber(existing.channel, channelName, subId, callbacks);

      const wrappedChannel = this._wrapChannel(existing.channel, channelName, subId);

      // Fire late-join events
      if (existing.status === 'SUBSCRIBED') {
        this._fireLateJoinEvents(channelName, subId, callbacks, existing.channel);
      }

      return wrappedChannel;
    }

    // ── Wait for in-flight subscription ──
    if (this.pendingSubscriptions.has(channelName)) {
      this._log('Subscription in-flight — waiting', { channel: channelName });
      try {
        await this.pendingSubscriptions.get(channelName);
        return this.subscribe(channelName, config, callbacks);
      } catch (e) {
        this._log('In-flight subscription failed', { channel: channelName, error: e.message });
        this._recordError(channelName, e, ERROR_TYPES.RECOVERABLE);
        throw e;
      }
    }

    // ── Create new subscription ──
    this._transition(channelName, STATES.CONNECTING);

    const subscriptionPromise = this._createSubscription(channelName, config, callbacks, subId);

    this.pendingSubscriptions.set(channelName, subscriptionPromise);
    return subscriptionPromise;
  }

  async _createSubscription(channelName, config, callbacks, subId) {
    try {
      this._clearReconnectTimer(channelName);
      this._clearReconnectDebounce(channelName);

      // Remove old channel if exists
      const existing = this.subscriptions.get(channelName);
      if (existing?.channel) {
        this._log('Removing old channel before re-subscribe', { channel: channelName });
        await this._safeRemoveChannel(existing.channel, channelName);
        this.subscriptions.delete(channelName);
      }

      this._log('Creating new channel', { channel: channelName, config });

      // NEW: Wrap channel creation in timeout
      const channel = await this._createChannelWithTimeout(channelName, config);

      if (!channel) {
        throw new Error('Channel creation timed out');
      }

      // Check if aborted while creating
      const abortedSubs = this.pendingUnsubscribes.get(channelName);
      const isAborted = abortedSubs && (abortedSubs.has(subId) || abortedSubs.has('__ALL__'));

      if (isAborted) {
        this._log('Aborting subscription establishment — already unsubscribed', {
          channel: channelName,
          subId,
        });

        if (abortedSubs.has(subId)) abortedSubs.delete(subId);
        if (abortedSubs.size === 0) this.pendingUnsubscribes.delete(channelName);

        await this._safeRemoveChannel(channel, channelName);
        return null;
      }

      // Store subscription
      this.subscriptions.set(channelName, {
        channel,
        status: 'SUBSCRIBING',
        subscribers: new Map([[subId, { callbacks, config }]]),
        createdAt: Date.now(), // NEW: Track creation time
      });

      // Register handlers
      this._registerHandlers(channel, channelName);

      // Subscribe with status tracking
      channel.subscribe((status, err) => {
        this._handleSubscriptionStatus(channelName, status, err, callbacks);
      });

      // NEW: Start heartbeat monitoring
      this._startHeartbeat(channelName);

      return this._wrapChannel(channel, channelName, subId);
    } catch (error) {
      console.error(`[RealtimeManager] Error creating subscription ${channelName}:`, error);
      this._recordError(channelName, error, ERROR_TYPES.FATAL);
      this._transition(channelName, STATES.ERROR);
      return null;
    } finally {
      this.pendingSubscriptions.delete(channelName);
    }
  }

  // NEW: Channel creation with timeout
  async _createChannelWithTimeout(channelName, config, timeoutMs = 10000) {
    return Promise.race([
      Promise.resolve(supabaseRealtime.channel(channelName, { config })),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Channel creation timeout')), timeoutMs)
      ),
    ]).catch((err) => {
      this._log('Channel creation failed', { channel: channelName, error: err.message });
      return null;
    });
  }

  _handleSubscriptionStatus(channelName, status, err, callbacks) {
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
      this._transition(channelName, STATES.CONNECTED);

      const wasReconnecting = (this.retryCount.get(channelName) || 0) > 0;
      this.retryCount.set(channelName, 0);
      this._clearPollTimer(channelName);

      if (wasReconnecting) {
        this.metrics.totalReconnects++;
        this._updateChannelMetric(channelName, 'reconnects', (m) => (m.reconnects || 0) + 1);

        // Fire reconnect callbacks for ALL subscribers
        if (entry) {
          entry.subscribers.forEach((sub) => {
            if (sub.callbacks.onReconnect) sub.callbacks.onReconnect(true);
          });
        }
      }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      this._transition(channelName, STATES.DISCONNECTED);
      
      // Classify error type
      const errorType = status === 'TIMED_OUT' ? ERROR_TYPES.NETWORK : ERROR_TYPES.RECOVERABLE;
      this._recordError(channelName, new Error(status), errorType);

      // Use debounced reconnect to prevent storms
      this._scheduleDebouncedReconnect(channelName, entry?.config, callbacks);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // NEW: Debounced Reconnection (Prevents Reconnect Storms)
  // ══════════════════════════════════════════════════════════════

  _scheduleDebouncedReconnect(channelName, config, callbacks) {
    // If already debouncing, skip
    if (this.reconnectDebounceTimers.has(channelName)) {
      this._log('Reconnect already debouncing, skipping', { channel: channelName });
      return;
    }

    const debounceTimer = setTimeout(() => {
      this.reconnectDebounceTimers.delete(channelName);
      this._scheduleReconnect(channelName, config, callbacks);
    }, this.RECONNECT_DEBOUNCE_MS);

    this.reconnectDebounceTimers.set(channelName, debounceTimer);
  }

  _clearReconnectDebounce(channelName) {
    if (this.reconnectDebounceTimers.has(channelName)) {
      clearTimeout(this.reconnectDebounceTimers.get(channelName));
      this.reconnectDebounceTimers.delete(channelName);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // Handler Registration
  // ══════════════════════════════════════════════════════════════

  _registerHandlers(channel, channelName) {
    // Presence handlers
    channel.on('presence', { event: 'sync' }, () => {
      this._updateChannelMetric(channelName, 'lastActivity', Date.now());
      const entry = this.subscriptions.get(channelName);
      if (entry) {
        entry.subscribers.forEach((sub) => {
          const cb = sub.callbacks?.presence;
          if (typeof cb === 'function') cb();
          else if (cb?.callback) cb.callback();
        });
      }
    });

    channel.on('presence', { event: 'join' }, (payload) => {
      this._updateChannelMetric(channelName, 'lastActivity', Date.now());
      const entry = this.subscriptions.get(channelName);
      if (entry) {
        entry.subscribers.forEach((sub) => {
          const cb = sub.callbacks?.presence_join || sub.callbacks?.presence;
          if (typeof cb === 'function' && sub.callbacks?.presence_join) cb(payload);
        });
      }
    });

    channel.on('presence', { event: 'leave' }, (payload) => {
      this._updateChannelMetric(channelName, 'lastActivity', Date.now());
      const entry = this.subscriptions.get(channelName);
      if (entry) {
        entry.subscribers.forEach((sub) => {
          const cb = sub.callbacks?.presence_leave || sub.callbacks?.presence;
          if (typeof cb === 'function' && sub.callbacks?.presence_leave) cb(payload);
        });
      }
    });

    // Register handlers for first subscriber
    const initialEntry = this.subscriptions.get(channelName);
    const subId = Array.from(initialEntry?.subscribers.keys() || [])[0];
    const callbacks = initialEntry?.subscribers.get(subId)?.callbacks;
    if (subId && callbacks) {
      this._addHandlersForSubscriber(channel, channelName, subId, callbacks);
    }
  }

  _addHandlersForSubscriber(channel, channelName, subId, callbacks) {
    // Postgres Changes
    const pgCallbacks = callbacks?.postgres_changes;
    if (pgCallbacks) {
      const listeners = Array.isArray(pgCallbacks) ? pgCallbacks : [pgCallbacks];
      listeners.forEach((listenerConfig, index) => {
        const { handler, ...supabaseConfig } = listenerConfig;
        channel.on('postgres_changes', supabaseConfig, (payload) => {
          this._updateChannelMetric(channelName, 'lastActivity', Date.now());
          const entry = this.subscriptions.get(channelName);
          const subscriber = entry?.subscribers.get(subId);
          const latestCbs = subscriber?.callbacks?.postgres_changes;
          const latestListeners = Array.isArray(latestCbs) ? latestCbs : [latestCbs];
          const latestHandler = latestListeners[index]?.handler;
          if (latestHandler) {
            this._safeExecute(() => latestHandler(payload), 'postgres_changes handler');
          }
        });
      });
    }

    // Broadcast
    const bcConfig = callbacks?.broadcast;
    if (bcConfig) {
      const eventName = typeof bcConfig === 'object' ? bcConfig.event : '*';
      if (eventName === '*') {
        this._log('Warning: Broadcast wildcard "*" might not be supported by Supabase', {
          channel: channelName,
        });
      }

      channel.on('broadcast', { event: eventName }, (payload) => {
        this._updateChannelMetric(channelName, 'lastActivity', Date.now());
        const entry = this.subscriptions.get(channelName);
        const subscriber = entry?.subscribers.get(subId);
        const cb = subscriber?.callbacks?.broadcast;
        const finalCb = typeof cb === 'function' ? cb : cb?.callback;
        if (finalCb) {
          this._safeExecute(() => finalCb(payload), 'broadcast handler');
        }
      });
    }
  }

  // NEW: Fire late-join events for subscribers added to existing channels
  _fireLateJoinEvents(channelName, subId, callbacks, channel) {
    setTimeout(() => {
      this._log('Firing late-join SUBSCRIBED status', { channel: channelName, subId });

      if (callbacks.onStatusChange) {
        this._safeExecute(
          () => callbacks.onStatusChange('SUBSCRIBED'),
          'onStatusChange (late-join)'
        );
      }

      // Fire presence sync immediately so new subscriber gets current state
      const pCb = callbacks.presence;
      if (pCb) {
        // NEW: Hydrate presence state from channel
        const presenceState = channel.presenceState();
        this._safeExecute(() => {
          if (typeof pCb === 'function') pCb(presenceState);
          else if (pCb.callback) pCb.callback(presenceState);
        }, 'presence (late-join hydration)');
      }
    }, 0);
  }

  // ══════════════════════════════════════════════════════════════
  // Channel Wrapping & Proxy
  // ══════════════════════════════════════════════════════════════

  _wrapChannel(channel, channelName, subId) {
    return new Proxy(channel, {
      get: (target, prop) => {
        if (prop === 'unsubscribe') {
          return () => this.unsubscribe(channelName, subId);
        }

        const val = target[prop];
        if (typeof val === 'function') {
          // Cache bound methods to reduce GC pressure
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
  // Reconnection Logic
  // ══════════════════════════════════════════════════════════════

  _scheduleReconnect(channelName, config, callbacks) {
    this._clearReconnectTimer(channelName);

    // NEW: Don't reconnect if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this._log('Skipping reconnect — network offline', { channel: channelName });
      return;
    }

    const attempt = (this.retryCount.get(channelName) || 0) + 1;
    this.retryCount.set(channelName, attempt);

    if (attempt > this.MAX_RETRIES) {
      this._log('Max retries reached — switching to polling fallback', { channel: channelName });
      this._transition(channelName, STATES.POLLING);

      const entry = this.subscriptions.get(channelName);
      if (entry) {
        entry.subscribers.forEach((sub) => {
          if (sub.callbacks.onMaxRetriesReached) {
            this._safeExecute(sub.callbacks.onMaxRetriesReached, 'onMaxRetriesReached');
          }
        });
      }

      this._startPollingFallback(channelName, config, callbacks);
      return;
    }

    this._transition(channelName, STATES.RECONNECTING);

    const delay = Math.min(this.BASE_RETRY_DELAY * Math.pow(2, attempt - 1), 30000);
    this._log('Reconnect scheduled', { channel: channelName, attempt, delay });

    const timer = setTimeout(async () => {
      // Re-fetch latest config and callbacks from all subscribers
      const entry = this.subscriptions.get(channelName);
      if (entry && entry.subscribers.size > 0) {
        const savedSubscribers = Array.from(entry.subscribers.values());
        
        // Clean existing channel
        if (entry.channel) {
          await this._safeRemoveChannel(entry.channel, channelName);
        }
        this.subscriptions.delete(channelName);

        // Resubscribe all
        for (const sub of savedSubscribers) {
          await this.subscribe(channelName, sub.config, sub.callbacks);
        }
      }
    }, delay);

    this.reconnectTimers.set(channelName, timer);
  }

  async refreshChannel(channelName) {
    const entry = this.subscriptions.get(channelName);
    if (!entry) return;

    this._log('Manual refresh triggered', { channel: channelName, force: true });
    this._clearReconnectTimer(channelName);
    this._clearReconnectDebounce(channelName);
    this._clearPollTimer(channelName);
    this._clearHeartbeat(channelName);
    this.retryCount.set(channelName, 0);

    // Force remove old channel
    if (entry.channel) {
      await this._safeRemoveChannel(entry.channel, channelName);
    }

    // Snapshot all subscribers before clearing
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

  // ══════════════════════════════════════════════════════════════
  // NEW: Heartbeat / Connection Health Monitoring
  // ══════════════════════════════════════════════════════════════

  _startHeartbeat(channelName) {
    this._clearHeartbeat(channelName);

    const timer = setInterval(() => {
      const entry = this.subscriptions.get(channelName);
      if (!entry || entry.status !== 'SUBSCRIBED') {
        this._clearHeartbeat(channelName);
        return;
      }

      // Check if connection is stale
      const metrics = this.metrics.channelMetrics.get(channelName);
      if (metrics && metrics.lastActivity) {
        const timeSinceActivity = Date.now() - metrics.lastActivity;
        if (timeSinceActivity > this.STALE_CONNECTION_THRESHOLD) {
          this._log('Heartbeat detected stale connection', {
            channel: channelName,
            timeSinceActivity,
            force: true,
          });
          this.refreshChannel(channelName);
        }
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
  // Unsubscribe Logic
  // ══════════════════════════════════════════════════════════════

  async unsubscribe(channelName, subId = null) {
    const entry = this.subscriptions.get(channelName);

    // Handle pending subscriptions that haven't landed yet
    if (!entry) {
      if (this.pendingSubscriptions.has(channelName)) {
        this._log('Unsubscribe called for pending channel — marking for abortion', {
          channel: channelName,
          subId: subId || 'all',
        });

        if (!this.pendingUnsubscribes.has(channelName)) {
          this.pendingUnsubscribes.set(channelName, new Set());
        }

        const abortedSet = this.pendingUnsubscribes.get(channelName);
        if (subId) {
          abortedSet.add(subId);
        } else {
          abortedSet.add('__ALL__');
        }
      }
      return;
    }

    if (subId) {
      this._log('Removing specific subscriber', { channel: channelName, subId });
      entry.subscribers.delete(subId);

      // NEW: Clean up method cache for this subscriber
      this._cleanupMethodCache(entry.channel);
    } else {
      // Legacy: remove most recent subscriber
      const lastId = Array.from(entry.subscribers.keys()).pop();
      this._log('Removing most recent subscriber (legacy call)', {
        channel: channelName,
        subId: lastId,
      });
      if (lastId) {
        entry.subscribers.delete(lastId);
        this._cleanupMethodCache(entry.channel);
      }
    }

    if (entry.subscribers.size > 0) {
      this._log('Remaining subscribers, keeping channel open', {
        channel: channelName,
        count: entry.subscribers.size,
      });
      return;
    }

    // No more subscribers — clean up channel
    this._log('No more subscribers, removing channel', { channel: channelName });
    this._clearReconnectTimer(channelName);
    this._clearReconnectDebounce(channelName);
    this._clearPollTimer(channelName);
    this._clearHeartbeat(channelName);
    this.retryCount.delete(channelName);
    this.states.delete(channelName);

    // Wait for pending subscription
    if (this.pendingSubscriptions.has(channelName)) {
      try {
        await this.pendingSubscriptions.get(channelName);
      } catch (e) {
        // Ignore
      }
      this.pendingSubscriptions.delete(channelName);
    }

    if (entry.channel) {
      await this._safeRemoveChannel(entry.channel, channelName);
    }

    this.subscriptions.delete(channelName);
    this.metrics.channelMetrics.delete(channelName);
  }

  async unsubscribeAll() {
    this._log('Unsubscribing all channels', { count: this.subscriptions.size, force: true });

    // Clear all timers
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();

    this.reconnectDebounceTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectDebounceTimers.clear();

    this.pollTimers.forEach((timer) => clearInterval(timer));
    this.pollTimers.clear();

    this.heartbeatTimers.forEach((timer) => clearInterval(timer));
    this.heartbeatTimers.clear();

    this.retryCount.clear();
    this.states.clear();

    const entries = Array.from(this.subscriptions.values());
    this.subscriptions.clear();
    this.pendingSubscriptions.clear();
    this.pendingUnsubscribes.clear();

    // Remove all channels
    await Promise.allSettled(
      entries.map(async (entry) => {
        if (entry.channel) {
          await this._safeRemoveChannel(entry.channel, entry.channel.topic);
        }
      })
    );

    // Clear method cache
    this._methodCache = new WeakMap();
  }

  // ══════════════════════════════════════════════════════════════
  // Polling Fallback
  // ══════════════════════════════════════════════════════════════

  _startPollingFallback(channelName, config, callbacks) {
    this._clearPollTimer(channelName);

    let pollCount = 0;

    const timer = setInterval(async () => {
      pollCount++;
      this._log('[POLL] Polling fallback tick', { channel: channelName, tick: pollCount });

      // Fire reconnect callback for ALL subscribers
      const entry = this.subscriptions.get(channelName);
      if (entry) {
        entry.subscribers.forEach((sub) => {
          if (sub.callbacks.onReconnect) {
            this._safeExecute(() => sub.callbacks.onReconnect(true), 'onReconnect (poll)');
          }
        });
      }

      // Every 4 ticks (~2 minutes), try WebSocket recovery
      if (pollCount % 4 === 0) {
        this._log('[POLL] Attempting WebSocket recovery', { channel: channelName });

        const currentEntry = this.subscriptions.get(channelName);
        const savedSubscribers = currentEntry
          ? Array.from(currentEntry.subscribers.values())
          : null;

        if (currentEntry?.channel) {
          await this._safeRemoveChannel(currentEntry.channel, channelName);
          this.subscriptions.delete(channelName);
        }

        this.retryCount.set(channelName, 0);

        if (savedSubscribers?.length > 0) {
          for (const sub of savedSubscribers) {
            await this.subscribe(channelName, sub.config, sub.callbacks);
          }
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

  // ══════════════════════════════════════════════════════════════
  // State Management
  // ══════════════════════════════════════════════════════════════

  _transition(channelName, newState) {
    const prev = this.states.get(channelName);
    if (prev === newState) return;

    this._log('State transition', { channel: channelName, from: prev || 'none', to: newState });
    this.states.set(channelName, newState);

    const entry = this.subscriptions.get(channelName);
    if (entry) {
      entry.subscribers.forEach((sub) => {
        if (sub.callbacks?.onStatusChange) {
          this._safeExecute(
            () => sub.callbacks.onStatusChange(newState, prev),
            'onStatusChange'
          );
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // Utilities & Helpers
  // ══════════════════════════════════════════════════════════════

  getChannel(channelName) {
    return this.subscriptions.get(channelName) || null;
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

  // NEW: Health check API
  getHealthStatus() {
    const stats = this.getStats();
    const now = Date.now();

    const healthyChannels = stats.details.filter((ch) => ch.state === STATES.CONNECTED);
    const staleChannels = stats.details.filter((ch) => {
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

  // NEW: Config validation
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

  // NEW: Initialize per-channel metrics
  _initChannelMetrics(channelName) {
    if (!this.metrics.channelMetrics.has(channelName)) {
      this.metrics.channelMetrics.set(channelName, {
        lastActivity: Date.now(),
        reconnects: 0,
        errors: 0,
      });
    }
  }

  // NEW: Update channel metric
  _updateChannelMetric(channelName, key, value) {
    const metrics = this.metrics.channelMetrics.get(channelName);
    if (!metrics) return;

    if (typeof value === 'function') {
      metrics[key] = value(metrics);
    } else {
      metrics[key] = value;
    }
  }

  // NEW: Record error with classification
  _recordError(channelName, error, errorType = ERROR_TYPES.RECOVERABLE) {
    this.metrics.totalErrors++;
    this.metrics.lastErrorTime = Date.now();
    this.metrics.lastErrorMessage = error.message;

    this._updateChannelMetric(channelName, 'errors', (m) => (m.errors || 0) + 1);

    this._log('Error recorded', {
      channel: channelName,
      error: error.message,
      type: errorType,
      force: true,
    });
  }

  // NEW: Safe callback execution with error boundary
  _safeExecute(fn, context = 'callback') {
    try {
      fn();
    } catch (err) {
      console.error(`[RealtimeManager] Error in ${context}:`, err);
      this.metrics.totalErrors++;
    }
  }

  // NEW: Safe channel removal with error handling
  async _safeRemoveChannel(channel, channelName) {
    try {
      await supabaseRealtime.removeChannel(channel);
      this._log('Channel removed successfully', { channel: channelName });
    } catch (e) {
      this._log('Channel removal failed (non-fatal)', {
        channel: channelName,
        error: e.message,
      });
    }
  }

  // NEW: Clean up method cache for removed channels
  _cleanupMethodCache(channel) {
    if (this._methodCache.has(channel)) {
      this._methodCache.delete(channel);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // Lifecycle Management
  // ══════════════════════════════════════════════════════════════

  async kill() {
    this._log('Kill switch triggered', { force: true });
    this._killed = true;

    // Clean up auth listener
    if (this._authSubscription) {
      try {
        this._authSubscription.unsubscribe();
      } catch (e) {
        // non-fatal
      }
      this._authSubscription = null;
    }

    // Clear all timers
    for (const [name] of this.subscriptions.entries()) {
      this._clearReconnectTimer(name);
      this._clearReconnectDebounce(name);
      this._clearPollTimer(name);
      this._clearHeartbeat(name);
    }

    const entries = Array.from(this.subscriptions.values());
    this.subscriptions.clear();
    this.states.clear();
    this.retryCount.clear();
    this.reconnectTimers.clear();
    this.reconnectDebounceTimers.clear();
    this.pollTimers.clear();
    this.heartbeatTimers.clear();
    this.pendingSubscriptions.clear();
    this.pendingUnsubscribes.clear();
    this.metrics.channelMetrics.clear();

    // Remove all channels
    await Promise.allSettled(
      entries.map(async (entry) => {
        if (entry.channel) {
          await this._safeRemoveChannel(entry.channel, entry.channel.topic);
        }
      })
    );

    // Clear method cache
    this._methodCache = new WeakMap();
  }

  destroy() {
    return this.kill();
  }

  // ══════════════════════════════════════════════════════════════
  // Logging
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
    } catch (e) {
      // non-fatal
    }

    console.log(`[RT] ${message}`, {
      timestamp: new Date().toISOString(),
      ...wsInfo,
      ...detail,
    });
  }
}

// ══════════════════════════════════════════════════════════════
// Singleton Export
// ══════════════════════════════════════════════════════════════

export const realtimeManager = new RealtimeManager();

// Global cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeManager.unsubscribeAll();
  });
}

export default realtimeManager;