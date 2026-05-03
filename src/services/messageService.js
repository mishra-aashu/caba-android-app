import { dbToFrontend, safeDbConversion } from '../utils/dbFieldMapping';
import { validateAndSanitize, coerceDataTypes } from '../utils/dataValidation';
import { db } from '../db/db';
import { EncryptionService } from './EncryptionService';
import useAuthStore from '../store/authStore';
import { driftCorrectionService } from './driftCorrectionService';

/**
 * Service function to fetch chat messages from Supabase
 * Returns the array of messages directly for use with React Query
 */
export const fetchChatMessages = async ({ chatId, supabase }) => {
    if (!chatId || chatId === 'new') {
        return [];
    }

    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            sender:sender_id (
                id,
                name,
                avatar,
                is_online,
                last_seen
            ),
            receiver:receiver_id (
                id,
                name,
                avatar,
                is_online,
                last_seen
            )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(50);

    if (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }

    const convertedData = safeDbConversion(data || []);
    return convertedData.map(message => coerceDataTypes(message, 'messages'));
};

/**
 * Fetch older messages for pagination
 */
export const fetchOlderMessages = async ({ chatId, supabase, beforeTimestamp }) => {
    if (!chatId || chatId === 'new' || !beforeTimestamp) {
        return [];
    }

    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            sender:sender_id (
                id,
                name,
                avatar,
                is_online,
                last_seen
            ),
            receiver:receiver_id (
                id,
                name,
                avatar,
                is_online,
                last_seen
            )
        `)
        .eq('chat_id', chatId)
        .lt('created_at', beforeTimestamp)
        .order('created_at', { ascending: true })
        .limit(50);

    if (error) {
        console.error('Error fetching older messages:', error);
        throw error;
    }

    const convertedData = safeDbConversion(data || []);
    return convertedData.map(message => coerceDataTypes(message, 'messages'));
};

/**
 * Edit an existing message
 */
export const editMessage = async ({ messageId, newContent, supabase }) => {
    const { data, error } = await supabase
        .from('messages')
        .update({
            content: newContent,
            updated_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .select()
        .single();

    if (error) throw error;
    return dbToFrontend(data);
};

/**
 * Delete a message
 */
export const deleteMessage = async ({ messageId, supabase }) => {
    const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

    if (error) throw error;
};

/**
 * Search message content across all chats locally
 */
export const searchMessagesLocally = async (query) => {
    if (!query || query.trim().length < 2) return [];

    const lowerQuery = query.toLowerCase();
    
    // 1. Get all local messages
    // Note: This is a linear scan. For very large local DBs, this might need optimization.
    const allMessages = await db.messages.toArray();
    
    // 2. Decrypt and filter
    const results = [];
    for (const msg of allMessages) {
        if (!msg.content) continue;

        let content = msg.content;
        // Decrypt if encrypted
        if (typeof content === 'string' && content.startsWith('🔒:')) {
            content = EncryptionService.decrypt(content, msg.chatId, msg.senderId);
        }

        if (content && typeof content === 'string' && content.toLowerCase().includes(lowerQuery)) {
            results.push({
                ...msg,
                content // Use decrypted content for the search result
            });
        }
    }

    // 2.5 Deduplicate results
    // Sometimes messages are duplicated in local DB (e.g. tempId vs real ID)
    const seenSignatures = new Set();
    const uniqueResults = [];
    
    for (const res of results) {
        // Create a unique signature for the message
        // Using content (lowercase), chatId, senderId, and a fuzzy timestamp (60 second window)
        const timestamp = new Date(res.createdAt || res.created_at).getTime();
        const fuzzyTs = Math.floor(timestamp / 60000); 
        const signature = `${res.chatId}_${res.senderId}_${res.content.toLowerCase()}_${fuzzyTs}`;
        
        if (!seenSignatures.has(signature)) {
            seenSignatures.add(signature);
            uniqueResults.push(res);
        }
    }

    if (uniqueResults.length < results.length) {
        console.warn(`[Search] Detected ${results.length - uniqueResults.length} duplicates. Triggering background cleanup.`);
        driftCorrectionService.cleanupDuplicateMessages().catch(console.error);
    }

    // 3. Enrich with chat and sender info
    const currentUser = useAuthStore.getState().user;
    const enrichedResults = await Promise.all(uniqueResults.map(async (msg) => {
        const chat = await db.chats_list.get(msg.chatId);
        
        // Correct decryption - Re-decrypt if needed with correct otherUserId
        let decryptedContent = msg.content;
        const isGroup = msg.isGroupMessage || chat?.is_group || chat?.isGroup;
        
        if (typeof msg.content === 'string' && msg.content.startsWith('🔒:')) {
            const otherUserId = isGroup ? null : (chat?.otherUserId || chat?.metadata?.otherUserId);
            decryptedContent = EncryptionService.decrypt(msg.content, msg.chatId, otherUserId);
        }

        let senderName = 'Unknown Sender';
        if (currentUser && msg.senderId === currentUser.id) {
            senderName = 'You';
        } else {
            // Try contacts first
            const contact = await db.contacts.get(msg.senderId);
            if (contact?.contactName) {
                senderName = contact.contactName;
            } else {
                // Fallback to user_profiles
                const profile = await db.user_profiles.get(msg.senderId);
                if (profile?.name) {
                    senderName = profile.name;
                } else if (msg.senderName) {
                    // Sometimes senderName might be cached in the message object itself
                    senderName = msg.senderName;
                }
            }
        }
        
        return {
            ...msg,
            content: decryptedContent,
            chatName: chat?.name || 'Unknown Chat',
            senderName: senderName,
            chatAvatar: chat?.avatar || chat?.avatar_url
        };
    }));

    // Sort by timestamp (newest first) and limit to 50 results
    return enrichedResults
        .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at))
        .slice(0, 50);
};

export default fetchChatMessages;