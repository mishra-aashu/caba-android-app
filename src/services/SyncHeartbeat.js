/**
 * @fileoverview SyncHeartbeat - Production-grade active polling layer
 * @version 2.0.0
 * 
 * Responsibilities:
 * - Detect and patch WebSocket message gaps
 * - Adaptive polling based on app state (foreground/background)
 * - Network-aware synchronization
 * - Graceful degradation and error recovery
 * 
 * Performance Optimizations:
 * - Debounced beat execution
 * - Abort controller for request cancellation
 * - Single-transaction bulk updates
 * - Adaptive polling intervals
 */

import { db } from '../db/db';
import { supabase } from '../config/supabase';
import { safeDbConversion } from '../utils/dbFieldMapping';
import { EncryptionService } from './EncryptionService';
import { useSyncStore, SYNC_STATUS } from '../store/useSyncStore';

// Configuration constants
const CONFIG = {
  FOREGROUND_INTERVAL: 45_000,  // 45s - Adaptive monitoring (Increased from 15s)
  BACKGROUND_INTERVAL: 90_000,  // 90s - Battery-friendly (Increased from 45s)
  MIN_BEAT_GAP: 20_000,         // Rate limiting (Increased from 8s)
  MAX_MESSAGES_PER_FETCH: 50,   // Pagination limit
  DEBOUNCE_DELAY: 2_000,        // Beat debounce (Increased from 1s)
  REQUEST_TIMEOUT: 30_000,      // Network timeout
  // WHATSAPP-STYLE: Only do a REST catch-up sync on visibility if the app was
  // hidden for longer than this threshold. For shorter hides, WebSocket Realtime
  // already delivers everything — no extra REST call needed.
  VISIBILITY_SYNC_THRESHOLD: 3 * 60 * 1000, // 3 minutes
};


class SyncHeartbeat {
  constructor() {
    // User context
    this.userId = null;
    this.activeChatId = null;

    // Timers
    this._foregroundTimer = null;
    this._backgroundTimer = null;

    // State management
    this._isRunning = false;
    this._isSyncing = false;
    this._lastHeartbeatAt = 0;

    // Track when app was hidden to calculate hide duration on resume
    this._hiddenAt = 0;

    // Request cancellation
    this._abortController = null;

    // Debounce timer
    this._debounceTimer = null;

    // Event listeners (stored for cleanup)
    this._listeners = {
      visibility: null,
      online: null,
      capacitor: null,
    };

    // Performance monitoring
    this._stats = {
      totalBeats: 0,
      successfulBeats: 0,
      failedBeats: 0,
      lastError: null,
      emptyBeats: 0,
    };
  }


  // ═══════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════

  /**
   * Initialize and start heartbeat monitoring
   * @param {string} userId - Current user ID
   */
  start(userId) {
    if (!userId || this._isRunning) {
      console.warn('[SyncHeartbeat] Already running or invalid userId');
      return;
    }

    this.userId = userId;
    this._isRunning = true;

    console.log('[SyncHeartbeat] Starting for user:', userId);

    this._initializePolling();
    this._attachEventListeners();
  }

  /**
   * Stop all polling and cleanup resources
   */
  stop() {
    if (!this._isRunning) return;

    console.log('[SyncHeartbeat] Stopping...');

    this._isRunning = false;
    this.userId = null;
    this.activeChatId = null;

    // Cancel in-flight requests
    this._cancelPendingRequests();

    // Clear all timers
    this._clearAllTimers();

    // Remove event listeners
    this._detachEventListeners();

    // Reset stats
    this._resetStats();

    console.log('[SyncHeartbeat] Stopped successfully');
  }

  /**
   * Set the currently active chat for prioritized sync
   * @param {string|null} chatId - Chat ID or null
   */
  setActiveChat(chatId) {
    if (this.activeChatId !== chatId) {
      this.activeChatId = chatId || null;
      console.log('[SyncHeartbeat] Active chat set to:', chatId);
    }
  }

  /**
   * Get current sync statistics (for debugging/monitoring)
   */
  getStats() {
    return { ...this._stats };
  }

  // ═══════════════════════════════════════════════════════════
  // Initialization
  // ═══════════════════════════════════════════════════════════

  _initializePolling() {
    // Start foreground polling immediately
    this._startForegroundPolling();

    // Trigger initial beat after short delay
    setTimeout(() => {
      if (this._isRunning) {
        this._scheduleBeat('initial-sync', true);
      }
    }, 1_000);
  }

  _startForegroundPolling() {
    this._clearTimer('foreground');
    
    this._foregroundTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this._scheduleBeat('foreground-tick');
      }
    }, CONFIG.FOREGROUND_INTERVAL);
  }

  _startBackgroundPolling() {
    this._clearTimer('background');
    
    this._backgroundTimer = setInterval(() => {
      if (document.visibilityState === 'hidden') {
        this._scheduleBeat('background-tick');
      }
    }, CONFIG.BACKGROUND_INTERVAL);
  }

  // ═══════════════════════════════════════════════════════════
  // Event Listeners
  // ═══════════════════════════════════════════════════════════

  _attachEventListeners() {
    // Visibility change
    this._listeners.visibility = this._onVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this._listeners.visibility);

    // Network status (Deprecated: Handled by useConnectivity via SyncStore)
    // this._listeners.online = this._onNetworkOnline.bind(this);
    // window.addEventListener('online', this._listeners.online);

    // Capacitor app state (if available)
    this._attachCapacitorListener();
  }

  _detachEventListeners() {
    if (this._listeners.visibility) {
      document.removeEventListener('visibilitychange', this._listeners.visibility);
      this._listeners.visibility = null;
    }

    if (this._listeners.online) {
      window.removeEventListener('online', this._listeners.online);
      this._listeners.online = null;
    }

    if (this._listeners.capacitor) {
      this._listeners.capacitor.remove?.();
      this._listeners.capacitor = null;
    }
  }

  async _attachCapacitorListener() {
    try {
      const { App } = await import('@capacitor/app');

      this._listeners.capacitor = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && this._isRunning) {
          const hiddenDuration = this._hiddenAt > 0 ? Date.now() - this._hiddenAt : 0;
          this._hiddenAt = 0;

          // Same WhatsApp-style threshold — only catch-up if gone for >3 minutes
          if (hiddenDuration >= CONFIG.VISIBILITY_SYNC_THRESHOLD) {
            console.log(`[SyncHeartbeat] App resumed after ${Math.round(hiddenDuration / 1000)}s — scheduling catch-up beat`);
            this._scheduleBeat('capacitor-resume', true);
          } else {
            console.log(`[SyncHeartbeat] App resumed after ${Math.round(hiddenDuration / 1000)}s — WebSocket covers, skipping REST beat`);
          }
        } else if (!isActive) {
          this._hiddenAt = Date.now();
        }
      });
    } catch (err) {
      // Not a Capacitor environment - silent fail
    }
  }


  // ═══════════════════════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════════════════════

  _onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      const hiddenDuration = this._hiddenAt > 0 ? Date.now() - this._hiddenAt : 0;
      this._hiddenAt = 0;

      // WHATSAPP-STYLE: Only do a REST catch-up beat if the app was hidden for
      // a meaningful duration. WebSocket Realtime handles short-gap delivery.
      if (hiddenDuration >= CONFIG.VISIBILITY_SYNC_THRESHOLD) {
        console.log(`[SyncHeartbeat] App visible after ${Math.round(hiddenDuration / 1000)}s — scheduling catch-up beat`);
        this._scheduleBeat('visibility-long-absence', true);
      } else {
        console.log(`[SyncHeartbeat] App visible after ${Math.round(hiddenDuration / 1000)}s — WebSocket covers this gap, skipping REST beat`);
      }

      this._startForegroundPolling();
    } else {
      this._hiddenAt = Date.now();
      console.log('[SyncHeartbeat] App hidden — switching to background mode');
      this._startBackgroundPolling();
    }
  }


  _onNetworkOnline() {
    console.log('[SyncHeartbeat] Network reconnected - scheduling beat');
    this._scheduleBeat('network-online', true);
  }

  // ═══════════════════════════════════════════════════════════
  // Core Beat Logic
  // ═══════════════════════════════════════════════════════════

  /**
   * Schedule a beat with debouncing and rate limiting
   * @param {string} reason - Trigger reason for logging
   * @param {boolean} force - Skip rate limiting
   */
  _scheduleBeat(reason = 'tick', force = false) {
    // Clear existing debounce timer
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    // Debounce rapid beats
    this._debounceTimer = setTimeout(() => {
      this._executeBeat(reason, force);
    }, force ? 0 : CONFIG.DEBOUNCE_DELAY);
  }

  /**
   * Execute the actual sync beat
   */
  async _executeBeat(reason, force) {
    const { status, setStatus } = useSyncStore.getState();

    // Pre-flight checks
    if (!this._isRunning || !this.userId || status === SYNC_STATUS.OFFLINE) {
      return;
    }

    if (this._isSyncing) {
      console.log('[SyncHeartbeat] Sync already in progress, skipping');
      return;
    }

    // Rate limiting with adaptive back-off
    const now = Date.now();
    const backoffMultiplier = Math.min(Math.pow(1.5, this._stats.emptyBeats), 4); // Max 4x interval
    const interval = (document.visibilityState === 'visible' ? CONFIG.FOREGROUND_INTERVAL : CONFIG.BACKGROUND_INTERVAL) * backoffMultiplier;
    
    if (!force && (now - this._lastHeartbeatAt) < Math.max(CONFIG.MIN_BEAT_GAP, interval)) {
      console.log(`[SyncHeartbeat] Throttled (Backoff: ${backoffMultiplier.toFixed(1)}x), skipping beat`);
      return;
    }

    this._lastHeartbeatAt = now;
    this._isSyncing = true;
    this._stats.totalBeats++;
    setStatus(SYNC_STATUS.SYNCING);

    console.log(`[SyncHeartbeat] 🔄 Beat #${this._stats.totalBeats} (${reason})`);

    try {
      // Create abort controller for this sync session
      this._abortController = new AbortController();
      const signal = this._abortController.signal;

      // Priority 1: Sync active chat (if any)
      if (this.activeChatId) {
        await this._patchChat(this.activeChatId, signal);
      }

      // Priority 2: Sync all chat list heads
      const patchedCount = await this._patchChatListHeads(signal);

      // Track empty beats for back-off
      if (patchedCount === 0) {
        this._stats.emptyBeats++;
      } else {
        this._stats.emptyBeats = 0; // Reset on activity
      }

      // Dispatch global heartbeat event for other providers (e.g. CallProvider)
      window.dispatchEvent(new CustomEvent('app:sync-heartbeat', { 
        detail: { timestamp: now, userId: this.userId } 
      }));

      this._stats.successfulBeats++;
      setStatus(SYNC_STATUS.IDLE);
      console.log(`[SyncHeartbeat] ✅ Beat completed successfully`);

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[SyncHeartbeat] Beat aborted');
      } else {
        this._stats.failedBeats++;
        this._stats.lastError = err.message;
        setStatus(SYNC_STATUS.ERROR);
        console.error('[SyncHeartbeat] ❌ Beat failed:', err);
      }
    } finally {
      this._isSyncing = false;
      this._abortController = null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Sync Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Patch missing messages for a specific chat
   */
  async _patchChat(chatId, signal) {
    try {
      // Get latest local message
      const messages = await db.getAll('messages', { chatId: String(chatId) });
      const sorted = messages.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
      const latestLocal = sorted[0];

      const since = latestLocal?.createdAt || new Date(0).toISOString();

      // Fetch newer messages from server
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:sender_id(id, name, avatar), receiver:receiver_id(id, name, avatar)')
        .eq('chat_id', chatId)
        .gt('created_at', since)
        .order('created_at', { ascending: true })
        .limit(CONFIG.MAX_MESSAGES_PER_FETCH)
        .abortSignal(signal);

      if (error) throw error;
      if (!data?.length) return;

      console.log(`[SyncHeartbeat] 📥 Patching ${data.length} messages for chat ${chatId}`);

      // Decrypt messages
      const chat = await db.chats_list.get(chatId);
      const decrypted = await this._decryptMessages(data, chat);

      // Convert to DB format
      const converted = safeDbConversion(decrypted);

      // Single transaction write
      await db.transaction('rw', ['messages', 'chats_list'], async () => {
        await db.bulkPut('messages', converted);

        // Update chat head
        const newest = converted[converted.length - 1];
        if (newest) {
          await db.update('chats_list', String(chatId), {
            lastMessage: newest.content,
            lastMessageAt: newest.createdAt,
            timestamp: newest.createdAt,
          }).catch(err => {
            console.warn('[SyncHeartbeat] Failed to update chat head:', err);
          });
        }
      });

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(`[SyncHeartbeat] Failed to patch chat ${chatId}:`, err);
      }
      throw err;
    }
  }

  /**
   * Patch chat list heads for all chats
   */
  async _patchChatListHeads(signal) {
    try {
      // Fetch server-side chat heads
      const { data, error } = await supabase
        .rpc('get_unified_chat_list', { user_id: this.userId })
        .abortSignal(signal);

      if (error) throw error;
      if (!data?.length) return;

      // Get local chats
      const localChats = await db.getAll('chats_list');
      const localMap = new Map(
        localChats.map(c => [String(c.id), c])
      );

      // Normalize and collect stale chats
      const { normalizeChat } = await import('../utils/chatHelpers');
      const toPatch = [];

      for (const serverChat of data) {
        const chatId = String(serverChat.chat_id || serverChat.id);
        const serverTime = serverChat.last_message_time;
        const local = localMap.get(chatId);
        const localTime = local?.lastMessageAt || local?.timestamp;

        const serverIsNewer = serverTime && (
          !localTime || new Date(serverTime) > new Date(localTime)
        );

        // Skip active chat (already patched above)
        if (serverIsNewer && chatId !== this.activeChatId) {
          toPatch.push(normalizeChat(serverChat, this.userId));
        }
      }

        if (toPatch.length > 0) {
          // ═══ Smart Merge (Heartbeat Version) ═══
          await db.transaction('rw', ['chats_list'], async () => {
            for (const sChat of toPatch) {
              const localChat = await db.get('chats_list', String(sChat.id));
              if (localChat) {
                const merged = {
                  ...sChat,
                  pinStatus: localChat.pinStatus || sChat.pinStatus,
                  isMuted: localChat.isMuted !== undefined ? localChat.isMuted : sChat.isMuted,
                  draft: localChat.draft || sChat.draft,
                };
                await db.set('chats_list', merged);
              } else {
                await db.set('chats_list', sChat);
              }
            }
          });
  
          console.log(`[SyncHeartbeat] 📊 Patched ${toPatch.length} chat heads`);
          return toPatch.length;
        }
        return 0;

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[SyncHeartbeat] Failed to patch chat list:', err);
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════

  /**
   * Decrypt messages in batch
   */
  async _decryptMessages(messages, chat) {
    if (!chat?.otherUserId) return messages;

    return messages.map(msg => {
      if (!msg.content || typeof msg.content !== 'string') return msg;

      try {
        const decrypted = EncryptionService.decrypt(
          msg.content,
          chat.id,
          chat.otherUserId
        );
        return { ...msg, content: decrypted };
      } catch (err) {
        console.warn(`[SyncHeartbeat] Failed to decrypt message ${msg.id}:`, err);
        return msg; // Keep encrypted
      }
    });
  }

  /**
   * Cancel all pending network requests
   */
  _cancelPendingRequests() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /**
   * Clear a specific timer
   */
  _clearTimer(type) {
    if (type === 'foreground' && this._foregroundTimer) {
      clearInterval(this._foregroundTimer);
      this._foregroundTimer = null;
    } else if (type === 'background' && this._backgroundTimer) {
      clearInterval(this._backgroundTimer);
      this._backgroundTimer = null;
    } else if (type === 'debounce' && this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  /**
   * Clear all timers
   */
  _clearAllTimers() {
    this._clearTimer('foreground');
    this._clearTimer('background');
    this._clearTimer('debounce');
  }

  /**
   * Reset statistics
   */
  _resetStats() {
    this._stats = {
      totalBeats: 0,
      successfulBeats: 0,
      failedBeats: 0,
      lastError: null,
    };
  }
}

// Export singleton instance
export const syncHeartbeat = new SyncHeartbeat();