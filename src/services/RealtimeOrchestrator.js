import { realtimeManager } from '../utils/realtimeManager';
import { db } from '../db/db';
import { dbToFrontend } from '../utils/dbFieldMapping';
import { EncryptionService } from './EncryptionService';

/**
 * RealtimeOrchestrator
 * 
 * THE Central Hub for all realtime database updates.
 * Instead of individual hooks subscribing to tables, this service
 * listens once and updates the local Dexie DB, which UI hooks then observe.
 */
class RealtimeOrchestrator {
    constructor() {
        this.userId = null;
        this.channelName = null;
        this.isInitialized = false;
    }

    /**
     * Start the orchestrator for a specific user
     */
    initialize(userId) {
        if (!userId) return;
        if (this.isInitialized && this.userId === userId) return;

        this.userId = userId;
        this.channelName = `global_sync_${userId}`;
        this.isInitialized = true;

        console.log('[RealtimeOrchestrator] Initializing for user:', userId);
        this._subscribe();
    }

    /**
     * Stop the orchestrator and cleanup
     */
    destroy() {
        if (this.channelName) {
            realtimeManager.unsubscribe(this.channelName);
        }
        this.isInitialized = false;
        this.userId = null;
    }

    _subscribe() {
        realtimeManager.subscribe(
            this.channelName,
            {},
            {
                postgres_changes: [
                    // 1. Messages - The most frequent update
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'messages', 
                        handler: (p) => this._handleMessageEvent(p) 
                    },
                    // 2. Chats - Metadata changes (e.g. pinned, archived)
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'chats', 
                        handler: (p) => this._handleChatEvent(p) 
                    },
                    // 3. Groups - Membership or Group info changes
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'groups', 
                        handler: (p) => this._handleGroupEvent(p) 
                    },
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'group_members', 
                        handler: (p) => this._handleGroupMemberEvent(p) 
                    },
                    // 4. Profiles - Contact info changes (Avatar/Name)
                    { 
                        event: 'UPDATE', 
                        schema: 'public', 
                        table: 'profiles', 
                        handler: (p) => this._handleProfileEvent(p) 
                    }
                ],
                onReconnect: () => {
                    console.log('[RealtimeOrchestrator] Reconnected - Dispatching sync request');
                    window.dispatchEvent(new CustomEvent('app:sync-required', { 
                        detail: { reason: 'reconnect', userId: this.userId } 
                    }));
                }
            }
        );
    }

    // ──────────────────────────────────────────────────────────
    // Event Handlers
    // ──────────────────────────────────────────────────────────

    async _handleMessageEvent(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        if (eventType === 'INSERT') {
            const chatId = String(newRecord.chat_id);
            const isMyMessage = newRecord.sender_id === this.userId;
            
            // Decrypt for local storage
            let decryptedContent = newRecord.content;
            try {
                const chat = await db.chats_list.get(chatId);
                decryptedContent = EncryptionService.decrypt(
                    newRecord.content,
                    chatId,
                    chat?.otherUserId
                );
            } catch (err) {
                decryptedContent = '[Encrypted]';
            }

            const frontendMsg = dbToFrontend({ ...newRecord, content: decryptedContent });

            // Atomic update: Message + Chat Head
            await db.transaction('rw', [db.messages, db.chats_list], async () => {
                await db.messages.put(frontendMsg);
                
                const existingChat = await db.chats_list.get(chatId);
                if (existingChat) {
                    await db.chats_list.update(chatId, {
                        lastMessage: decryptedContent,
                        lastMessageAt: frontendMsg.createdAt,
                        timestamp: frontendMsg.createdAt,
                        unreadCount: isMyMessage ? 0 : (Number(existingChat.unreadCount) || 0) + 1,
                        isMyMessage
                    });
                } else {
                    // Chat doesn't exist locally - trigger a chat list sync
                    window.dispatchEvent(new CustomEvent('app:sync-required', { 
                        detail: { reason: 'new-chat', chatId } 
                    }));
                }
            });
        } 
        else if (eventType === 'DELETE') {
            await db.messages.delete(oldRecord.id);
        }
        else if (eventType === 'UPDATE') {
            const updated = dbToFrontend(newRecord);
            await db.messages.update(updated.id, updated).catch(() => {});
        }
    }

    async _handleChatEvent(payload) {
        const { eventType, old: oldRecord } = payload;
        
        if (eventType === 'DELETE') {
            const chatId = String(oldRecord.id);
            console.log('[RealtimeOrchestrator] Chat deleted on server:', chatId);
            await db.transaction('rw', [db.chats_list, db.messages], async () => {
                await db.chats_list.delete(chatId);
                await db.messages.where('chatId').equals(chatId).delete();
            });
            return;
        }

        // For other events (INSERT/UPDATE), trigger a sync
        window.dispatchEvent(new CustomEvent('app:sync-required', { 
            detail: { reason: 'chat-update' } 
        }));
    }

    async _handleGroupEvent(payload) {
        const { eventType, old: oldRecord } = payload;
        
        if (eventType === 'DELETE') {
            const chatId = String(oldRecord.id);
            console.log('[RealtimeOrchestrator] Group deleted on server:', chatId);
            await db.transaction('rw', [db.chats_list, db.messages], async () => {
                await db.chats_list.delete(chatId);
                await db.messages.where('chatId').equals(chatId).delete();
            });
            return;
        }

        window.dispatchEvent(new CustomEvent('app:sync-required', { 
            detail: { reason: 'group-update' } 
        }));
    }


    async _handleGroupMemberEvent(payload) {
        // If I was added to a group, sync chat list
        if (payload.eventType === 'INSERT' && payload.new.user_id === this.userId) {
            window.dispatchEvent(new CustomEvent('app:sync-required', { 
                detail: { reason: 'added-to-group' } 
            }));
        }
    }

    async _handleProfileEvent(payload) {
        const { new: profile } = payload;
        // Update user_profiles table for cache
        await db.user_profiles.update(profile.id, {
            name: profile.name,
            avatar: profile.avatar_url,
            lastSeen: profile.last_seen
        }).catch(() => {});
        
        // Also update any chats where this user is the "other user"
        const affectedChats = await db.chats_list
            .where('otherUserId')
            .equals(profile.id)
            .toArray();
            
        for (const chat of affectedChats) {
            await db.chats_list.update(chat.id, {
                otherUserName: profile.name,
                otherUserAvatar: profile.avatar_url,
                isOnline: profile.is_online
            });
        }
    }
}

export const realtimeOrchestrator = new RealtimeOrchestrator();
