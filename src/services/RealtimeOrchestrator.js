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
                    },
                    // 5. Game Invitations
                    {
                        event: '*',
                        schema: 'public',
                        table: 'game_invitations',
                        filter: `receiver_id=eq.${this.userId}`,
                        handler: () => {
                            window.dispatchEvent(new CustomEvent('app:game-invites-update'));
                        }
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
                const chat = await db.get('chats_list', chatId);
                decryptedContent = EncryptionService.decrypt(
                    newRecord.content,
                    chatId,
                    chat?.otherUserId
                );
            } catch (err) {
                decryptedContent = '[Encrypted]';
            }

            const frontendMsg = dbToFrontend({ ...newRecord, content: decryptedContent });
            const tempId = newRecord.client_id || newRecord.tempId;

            // Atomic update: Message + Chat Head
            await db.transaction('rw', ['messages', 'chats_list'], async () => {
                // 1. Cleanup optimistic message if it exists
                if (tempId) {
                    await db.delete('messages', `temp_${tempId}`).catch(() => {});
                    const existingTemp = await db.getAll('messages', { tempId });
                    for (const m of existingTemp) {
                        await db.delete('messages', m.id);
                    }
                }

                // 2. Store normalized message
                await db.set('messages', frontendMsg);
                
                const existingChat = await db.get('chats_list', chatId);
                if (existingChat) {
                    await db.update('chats_list', chatId, {
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
            await db.delete('messages', oldRecord.id);
        }
        else if (eventType === 'UPDATE') {
            const updated = dbToFrontend(newRecord);
            await db.update('messages', updated.id, updated).catch(() => {});
        }
    }

    async _handleChatEvent(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        if (eventType === 'DELETE') {
            const chatId = String(oldRecord.id);
            console.log('[RealtimeOrchestrator] Chat deleted on server:', chatId);
            await db.transaction('rw', ['chats_list', 'messages'], async () => {
                await db.delete('chats_list', chatId);
                const msgs = await db.getAll('messages', { chatId });
                for (const m of msgs) await db.delete('messages', m.id);
            });
            return;
        }

        if (eventType === 'INSERT' && newRecord?.id) {
            // A brand-new chat appeared — check if we already have it locally.
            // If yes, the message handler already updated it. No REST call needed.
            // If not, we genuinely need to sync (e.g. someone else started a chat with us).
            const chatId = String(newRecord.id);
            const existingChat = await db.get('chats_list', chatId).catch(() => null);
            if (!existingChat) {
                console.log('[RealtimeOrchestrator] New unknown chat detected, syncing:', chatId);
                window.dispatchEvent(new CustomEvent('app:sync-required', {
                    detail: { reason: 'new-chat', chatId }
                }));
            }
            // If we already have it — do nothing. The message handler keeps Dexie fresh.
            return;
        }

        // UPDATE on chats table: metadata change (e.g. vanish mode toggle, archive).
        // No need for a full global sync — the local Dexie record will be corrected
        // on the next periodic heartbeat. Firing a REST call here causes a request
        // cascade on every message send (messages update chat's last_message_at → chat UPDATE event).
        // So we intentionally skip the sync dispatch here.
        if (eventType === 'UPDATE') {
            // Lightweight: only update fields we care about in Dexie
            if (newRecord?.id) {
                const chatId = String(newRecord.id);
                await db.update('chats_list', chatId, {
                    isVanishEnabled: newRecord.is_vanish_enabled ?? undefined,
                }).catch(() => {}); // silent — record may not exist locally yet
            }
        }
    }

    async _handleGroupEvent(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        if (eventType === 'DELETE') {
            const chatId = String(oldRecord.id);
            console.log('[RealtimeOrchestrator] Group deleted on server:', chatId);
            await db.transaction('rw', ['chats_list', 'messages'], async () => {
                await db.delete('chats_list', chatId);
                const msgs = await db.getAll('messages', { chatId });
                for (const m of msgs) await db.delete('messages', m.id);
            });
            return;
        }

        if (eventType === 'INSERT' && newRecord?.id) {
            // New group — check local
            const chatId = String(newRecord.id);
            const existingChat = await db.get('chats_list', chatId).catch(() => null);
            if (!existingChat) {
                window.dispatchEvent(new CustomEvent('app:sync-required', {
                    detail: { reason: 'new-group', chatId }
                }));
            }
            return;
        }

        // UPDATE (name/avatar/settings change) — update Dexie in-place, skip full REST sync
        if (eventType === 'UPDATE' && newRecord?.id) {
            const chatId = String(newRecord.id);
            await db.update('chats_list', chatId, {
                ...(newRecord.name && { name: newRecord.name }),
                ...(newRecord.avatar_url && { avatar: newRecord.avatar_url }),
            }).catch(() => {});
        }
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
        await db.update('user_profiles', profile.id, {
            name: profile.name,
            avatar: profile.avatar_url,
            lastSeen: profile.last_seen
        }).catch(() => {});
        
        // Also update any chats where this user is the "other user"
        const allChats = await db.getAll('chats_list');
        const affectedChats = allChats.filter(c => c.otherUserId === profile.id);
            
        for (const chat of affectedChats) {
            await db.update('chats_list', chat.id, {
                otherUserName: profile.name,
                otherUserAvatar: profile.avatar_url,
                isOnline: profile.is_online
            });
        }
    }
}

export const realtimeOrchestrator = new RealtimeOrchestrator();
