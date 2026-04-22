import { db } from '../db/db';
import { supabase } from '../config/supabase';
import { safeDbConversion } from '../utils/dbFieldMapping';
import { EncryptionService } from './EncryptionService';

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
    }

    /**
     * Perform a global sync for all chats
     * Fetches any messages created after the latest locally stored message.
     */
    async performGlobalSync(userId) {
        if (this.isSyncing || !navigator.onLine || !userId) return;
        this.isSyncing = true;

        try {
            console.log('[Sync] Starting global catch-up...');

            // 1. Find the latest message timestamp across ALL chats locally
            const latestMsg = await db.messages
                .orderBy('createdAt')
                .reverse()
                .first();
            
            const lastSyncTimestamp = latestMsg ? latestMsg.createdAt : new Date(0).toISOString();

            // 2. Fetch all messages since then from Supabase
            // We do this globally to save requests per-chat
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    sender:sender_id (id, name, avatar, is_online, last_seen),
                    receiver:receiver_id (id, name, avatar, is_online, last_seen)
                `)
                .gt('created_at', lastSyncTimestamp)
                .order('created_at', { ascending: true })
                .limit(500); // Batch size

            if (error) throw error;

            if (data && data.length > 0) {
                console.log(`[Sync] Found ${data.length} new messages globally`);

                // Decrypt before saving
                const allChats = await db.chats_list.toArray();
                const chatMap = new Map(allChats.map(c => [c.id, c]));

                data.forEach(msg => {
                    if (msg.content) {
                        const chat = chatMap.get(msg.chat_id);
                        msg.content = EncryptionService.decrypt(
                            msg.content, 
                            msg.chat_id, 
                            chat?.otherUserId
                        );
                    }
                });

                const converted = safeDbConversion(data);
                
                // 3. Save to Dexie (bulkPut handles updates/inserts automatically)
                await db.messages.bulkPut(converted);

                // 4. Update the chat list to reflect latest activity
                await this.updateChatListHeads(converted);
            }

            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('last_global_sync_at', this.lastSyncTime);
            console.log('[Sync] Global catch-up complete');

            // 5. Ensure chat list is populated
            const localChatCount = await db.chats_list.count();
            if (localChatCount === 0) {
                await this.syncChatList(userId);
            }

        } catch (error) {
            console.error('[Sync] Global sync failed:', error);
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
            await db.chats_list.update(chatId, { 
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
        if (!userId || !navigator.onLine) return;
        
        try {
            console.log('[Sync] Fetching unified chat list...');
            const { data, error } = await supabase.rpc('get_unified_chat_list', { user_id: userId });
            
            if (!error && data) {
                const { normalizeChat } = await import('../utils/chatHelpers');
                const formattedChats = data.map(rawItem => normalizeChat(rawItem, userId));
                await db.chats_list.bulkPut(formattedChats);
                console.log(`[Sync] Synced ${formattedChats.length} chats`);
            }
        } catch (err) {
            console.error('[Sync] Chat list sync failed:', err);
        }
    }

    /**
     * Individual chat sync (fallback if global sync missed something)
     */
    async syncChat(chatId) {
        if (!navigator.onLine || !chatId) return;

        const latestMsg = await db.messages
            .where('chatId')
            .equals(chatId)
            .reverse()
            .sortBy('createdAt')
            .then(msgs => msgs[0]);

        const lastSync = latestMsg ? latestMsg.createdAt : new Date(0).toISOString();

        const { data, error } = await supabase
            .from('messages')
            .select(`*, sender:sender_id (*), receiver:receiver_id (*)`)
            .eq('chat_id', chatId)
            .gt('created_at', lastSync)
            .limit(100);

        if (!error && data?.length > 0) {
            const chat = await db.chats_list.get(chatId);
            data.forEach(msg => {
                if (msg.content) {
                    msg.content = EncryptionService.decrypt(
                        msg.content, 
                        chatId, 
                        chat?.otherUserId
                    );
                }
            });
            await db.messages.bulkPut(safeDbConversion(data));
        }
    }
}

export const syncService = new SyncService();
