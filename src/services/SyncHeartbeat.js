/**
 * SyncHeartbeat.js
 *
 * A professional-grade active polling layer that runs ALONGSIDE the WebSocket.
 * Its only job: detect when the WebSocket missed something and fill the gap.
 *
 * Why this is needed:
 * - WebSocket (Supabase Realtime) can silently drop on mobile networks
 * - CHANNEL_ERROR doesn't always fire — the socket just goes quiet
 * - Between those silent gaps, messages are lost until the next periodic sync
 *
 * Strategy:
 * - Tier 1 (Active): Poll every 15s while app is in foreground + user is online
 * - Tier 2 (Background): Poll every 45s while app is backgrounded
 * - Tier 3 (Reconnect): Immediate poll on network online / app foreground
 * - On each tick: compare local DB latest timestamp vs server — patch any gap
 */

import { db } from '../db/db';
import { supabase } from '../config/supabase';
import { safeDbConversion } from '../utils/dbFieldMapping';
import { EncryptionService } from './EncryptionService';

class SyncHeartbeat {
    constructor() {
        this.userId = null;
        this.activeChatId = null;

        // Timers
        this._foregroundTimer = null;
        this._backgroundTimer = null;
        this._capacitorListener = null;

        // State
        this._isRunning = false;
        this._lastHeartbeatAt = 0;
        this._isSyncing = false;

        // Intervals
        this.FOREGROUND_INTERVAL = 15000;  // 15s — catches WebSocket gaps fast
        this.BACKGROUND_INTERVAL = 45000;  // 45s — battery-friendly background poll
        this.MIN_BEAT_GAP = 8000;          // Never poll more than once per 8s
    }

    /**
     * Start the heartbeat for a given user.
     * Called from MainLayout after auth.
     */
    start(userId) {
        if (!userId || this._isRunning) return;
        this.userId = userId;
        this._isRunning = true;

        console.log('[SyncHeartbeat] Starting for user:', userId);

        this._startForegroundPolling();
        this._setupVisibilityListener();
        this._setupOnlineListener();
        this._setupCapacitorListener();
    }

    /**
     * Stop all polling — called on logout or unmount.
     */
    stop() {
        this._isRunning = false;
        this.userId = null;

        clearInterval(this._foregroundTimer);
        clearInterval(this._backgroundTimer);
        this._foregroundTimer = null;
        this._backgroundTimer = null;

        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        window.removeEventListener('online', this._onOnline);

        if (this._capacitorListener) {
            this._capacitorListener.remove?.();
            this._capacitorListener = null;
        }

        console.log('[SyncHeartbeat] Stopped.');
    }

    /**
     * Tell the heartbeat which chat is currently open.
     * This is used to prioritize sync for that chat.
     */
    setActiveChat(chatId) {
        this.activeChatId = chatId || null;
    }

    // ─────────────────────────────────────────────────────────
    // Polling Logic
    // ─────────────────────────────────────────────────────────

    _startForegroundPolling() {
        clearInterval(this._foregroundTimer);
        this._foregroundTimer = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this._beat('foreground-tick');
            }
        }, this.FOREGROUND_INTERVAL);
    }

    _startBackgroundPolling() {
        clearInterval(this._backgroundTimer);
        this._backgroundTimer = setInterval(() => {
            if (document.visibilityState !== 'visible') {
                this._beat('background-tick');
            }
        }, this.BACKGROUND_INTERVAL);
    }

    // ─────────────────────────────────────────────────────────
    // Event Listeners
    // ─────────────────────────────────────────────────────────

    _onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            console.log('[SyncHeartbeat] App visible — immediate beat');
            this._beat('visibility-shown', true);
        }
    };

    _onOnline = () => {
        console.log('[SyncHeartbeat] Network online — immediate beat');
        this._beat('network-online', true);
    };

    _setupVisibilityListener() {
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    _setupOnlineListener() {
        window.addEventListener('online', this._onOnline);
    }

    async _setupCapacitorListener() {
        try {
            const { App } = await import('@capacitor/app');
            this._capacitorListener = await App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) {
                    console.log('[SyncHeartbeat] Capacitor foreground — immediate beat');
                    this._beat('capacitor-foreground', true);
                }
            });
        } catch {
            // Not a Capacitor environment
        }
    }

    // ─────────────────────────────────────────────────────────
    // The Beat — Core Catch-up Logic
    // ─────────────────────────────────────────────────────────

    async _beat(reason = 'tick', force = false) {
        if (!this._isRunning || !this.userId || !navigator.onLine) return;
        if (this._isSyncing) return;

        const now = Date.now();
        if (!force && now - this._lastHeartbeatAt < this.MIN_BEAT_GAP) return;
        this._lastHeartbeatAt = now;
        this._isSyncing = true;

        console.log(`[SyncHeartbeat] Beat (${reason})`);

        try {
            // ── Step 1: Patch the active chat first (highest priority) ──
            if (this.activeChatId) {
                await this._patchChat(this.activeChatId);
            }

            // ── Step 2: Patch chat list heads for all chats ──
            await this._patchChatListHeads();

        } catch (err) {
            console.warn('[SyncHeartbeat] Beat failed:', err.message);
        } finally {
            this._isSyncing = false;
        }
    }

    /**
     * Fetch messages newer than local state for a specific chat.
     * This patches the gap if the WebSocket missed an INSERT.
     */
    async _patchChat(chatId) {
        const latestLocal = await db.messages
            .where('[chatId+createdAt]')
            .between([chatId, ''], [chatId, '\uffff'])
            .reverse()
            .first();

        const since = latestLocal?.createdAt || new Date(0).toISOString();

        const { data, error } = await supabase
            .from('messages')
            .select('*, sender:sender_id(id, name, avatar), receiver:receiver_id(id, name, avatar)')
            .eq('chat_id', chatId)
            .gt('created_at', since)
            .order('created_at', { ascending: true })
            .limit(50);

        if (error || !data?.length) return;

        console.log(`[SyncHeartbeat] Patching ${data.length} missed messages in chat ${chatId}`);

        const chat = await db.chats_list.get(chatId);
        const processed = data.map(msg => {
            const m = { ...msg };
            if (m.content && chat?.otherUserId) {
                try {
                    m.content = EncryptionService.decrypt(m.content, chatId, chat.otherUserId);
                } catch { /* keep encrypted */ }
            }
            return m;
        });

        const converted = safeDbConversion(processed);

        await db.transaction('rw', [db.messages, db.chats_list], async () => {
            await db.messages.bulkPut(converted);

            // Update chat head with latest message
            const newest = converted[converted.length - 1];
            if (newest) {
                await db.chats_list.update(chatId, {
                    lastMessage: newest.content,
                    lastMessageAt: newest.createdAt,
                    timestamp: newest.createdAt,
                }).catch(() => {});
            }
        });
    }

    /**
     * Check each chat in chats_list and verify the server's latest message_at
     * matches local. If not, dispatch a sync request for that chat.
     */
    async _patchChatListHeads() {
        // Get server-side chat list heads in one RPC call
        const { data, error } = await supabase
            .rpc('get_unified_chat_list', { user_id: this.userId });

        if (error || !data?.length) return;

        const localChats = await db.chats_list.toArray();
        const localMap = new Map(localChats.map(c => [String(c.id), c]));

        let patchCount = 0;

        for (const serverChat of data) {
            const chatId = String(serverChat.chat_id || serverChat.id);
            const serverTime = serverChat.last_message_time;
            const local = localMap.get(chatId);

            // If server has a newer timestamp than local, this chat was missed
            const localTime = local?.lastMessageAt || local?.timestamp;
            const serverIsNewer = serverTime && (!localTime || new Date(serverTime) > new Date(localTime));

            if (serverIsNewer) {
                patchCount++;
                // Patch missed messages for this specific chat
                if (chatId !== this.activeChatId) {
                    // For non-active chats, just update the head (faster, no message fetch)
                    const { normalizeChat } = await import('../utils/chatHelpers');
                    const normalized = normalizeChat(serverChat, this.userId);
                    await db.chats_list.put(normalized).catch(() => {});
                } else {
                    // Active chat already handled in _patchChat above
                }
            }
        }

        if (patchCount > 0) {
            console.log(`[SyncHeartbeat] Patched ${patchCount} stale chat heads`);
        }
    }
}

export const syncHeartbeat = new SyncHeartbeat();
