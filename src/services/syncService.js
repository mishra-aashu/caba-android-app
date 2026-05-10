import { db } from '../db/db';
import { supabase } from '../config/supabase';
import { safeDbConversion } from '../utils/dbFieldMapping';
import { EncryptionService } from './EncryptionService';
import { useSyncStore, SYNC_STATUS } from '../store/useSyncStore';

/**
 * SyncService
 * 
 * Responsibilities:
 * 1. Global catch-up sync on startup.
 * 2. Background queue processing.
 * 3. Handling missed messages after reconnection.
 */
class SyncService {
    constructor() {
        this.isSyncing = false;
        this.lastSyncTime = localStorage.getItem('last_global_sync_at') || null;
        this.periodicSyncTimer = null;
        this.syncInterval = 30000; // 30 seconds — SyncHeartbeat covers fast gaps, this does full reconciliation

    }

    /**
     * Start periodic synchronization
     * (Deprecated: Logic moved to SyncHeartbeat for better orchestration)
     */
    startPeriodicSync(userId) {
        if (!userId) return;
        console.log('[Sync] Periodic sync orchestration moved to SyncHeartbeat');
    }

    /**
     * Stop periodic synchronization
     */
    stopPeriodicSync() {
        if (this.periodicSyncTimer) {
            clearInterval(this.periodicSyncTimer);
            this.periodicSyncTimer = null;
        }
    }

    /**
     * Perform a global sync for all chats
     * Fetches any messages created after the latest locally stored message.
     */
    async performGlobalSync(userId) {
        const { status, setStatus, setLastSyncAt } = useSyncStore.getState();
        if (this.isSyncing || status === SYNC_STATUS.OFFLINE || !userId) return;
        
        this.isSyncing = true;
        setStatus(SYNC_STATUS.SYNCING);

        try {
            console.log('[Sync] Starting global catch-up...');

            // 1. Fetch Chat List (Profiles/Settings)
            await this.syncChatList(userId);

            // 2. Find the latest message timestamp across ALL chats locally
            const allMsgs = await db.getAll('messages');
            const sorted = allMsgs.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
            const latestMsg = sorted[0];
            
            const lastSyncTimestamp = latestMsg ? latestMsg.createdAt : new Date(0).toISOString();

            // 3. Fetch all messages since then from Supabase
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    sender:sender_id (id, name, avatar, is_online, last_seen),
                    receiver:receiver_id (id, name, avatar, is_online, last_seen)
                `)
                .gt('created_at', lastSyncTimestamp)
                .order('created_at', { ascending: true })
                .limit(500);

            if (error) throw error;

            if (data && data.length > 0) {
                console.log(`[Sync] Found ${data.length} new messages globally`);

                const allChats = await db.getAll('chats_list');
                const chatMap = new Map(allChats.map(c => [c.id, c]));

                const processedData = data.map(msg => {
                    const m = { ...msg };
                    if (m.content) {
                        try {
                            const chat = chatMap.get(m.chat_id);
                            m.content = EncryptionService.decrypt(
                                m.content, 
                                m.chat_id, 
                                chat?.otherUserId
                            );
                        } catch (e) {
                            console.warn('[Sync] Decryption failed for message:', m.id, e);
                        }
                    }
                    return m;
                });

                const converted = safeDbConversion(processedData);
                await db.bulkPut('messages', converted);
                await this.updateChatListHeads(converted);
            }

            const syncTime = new Date().toISOString();
            this.lastSyncTime = syncTime;
            setLastSyncAt(syncTime);
            setStatus(SYNC_STATUS.IDLE);

        } catch (error) {
            console.error('[Sync] Global sync failed:', error);
            setStatus(SYNC_STATUS.ERROR);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Updates the chats_list table with the latest message info from a sync batch
     */
    async updateChatListHeads(messages) {
        const chatsToUpdate = new Map();
        
        messages.forEach(msg => {
            if (!chatsToUpdate.has(msg.chatId) || new Date(msg.createdAt) > new Date(chatsToUpdate.get(msg.chatId))) {
                chatsToUpdate.set(msg.chatId, msg.createdAt);
            }
        });

        for (const [chatId, lastMsgAt] of chatsToUpdate.entries()) {
            const lastMsg = messages.find(m => m.chatId === chatId && m.createdAt === lastMsgAt);
            await db.update('chats_list', String(chatId), { 
                lastMessageAt: lastMsgAt,
                timestamp: lastMsgAt,
                lastMessage: lastMsg?.content || 'New message'
            }).catch(() => {});
        }
    }

    /**
     * Fetches the entire unified chat list from Supabase
     */
    async syncChatList(userId) {
        const { isOnline } = useSyncStore.getState();
        if (!userId || !isOnline) return;
        
        try {
            const { data, error } = await supabase.rpc('get_unified_chat_list', { user_id: userId });
            
            if (!error && data) {
                const { normalizeChat } = await import('../utils/chatHelpers');
                const serverChats = data.map(rawItem => normalizeChat(rawItem, userId));
                
                // ═══ Smart Merge: Preserve Local Metadata ═══
                await db.transaction('rw', ['chats_list'], async () => {
                    for (const sChat of serverChats) {
                        const localChat = await db.get('chats_list', String(sChat.id));
                        if (localChat) {
                            // Keep local fields that don't exist on server
                            const merged = {
                                ...sChat,
                                pinStatus: localChat.pinStatus || sChat.pinStatus,
                                isMuted: localChat.isMuted !== undefined ? localChat.isMuted : sChat.isMuted,
                                draft: localChat.draft || sChat.draft,
                                metadata: {
                                    ...(sChat.metadata || {}),
                                    ...(localChat.metadata || {})
                                }
                            };
                            await db.set('chats_list', merged);
                        } else {
                            await db.set('chats_list', sChat);
                        }
                    }
                });
            }
        } catch (err) {
            console.error('[Sync] Chat list sync failed:', err);
        }
    }

    /**
     * Individual chat sync (fallback if global sync missed something)
     * Now more robust and returns the new messages
     */
    async syncChat(chatId) {
        if (!navigator.onLine || !chatId) return [];

        try {
            const msgs = await db.getAll('messages', { chatId: String(chatId) });
            const sorted = msgs.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
            const latestMsg = sorted[0];

            const lastSync = latestMsg ? latestMsg.createdAt : new Date(0).toISOString();

            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    sender:sender_id (id, name, avatar, is_online, last_seen),
                    receiver:receiver_id (id, name, avatar, is_online, last_seen)
                `)
                .eq('chat_id', chatId)
                .gt('created_at', lastSync)
                .order('created_at', { ascending: true })
                .limit(100);

            if (!error && data?.length > 0) {
                const chat = await db.chats_list.get(chatId);
                const processedData = data.map(msg => {
                    const m = { ...msg };
                    if (m.content) {
                        try {
                            m.content = EncryptionService.decrypt(
                                m.content, 
                                chatId, 
                                chat?.otherUserId
                            );
                        } catch (e) {
                            console.warn('[Sync] Decryption failed during chat sync:', m.id, e);
                        }
                    }
                    return m;
                });

                const converted = safeDbConversion(processedData);
                await db.bulkPut('messages', converted);
                
                // Also update the chat head if we found new messages
                await this.updateChatListHeads(converted);
                
                return converted;
            }
            return [];
        } catch (err) {
            console.error(`[Sync] syncChat failed for ${chatId}:`, err);
            return [];
        }
    }
}

export const syncService = new SyncService();
