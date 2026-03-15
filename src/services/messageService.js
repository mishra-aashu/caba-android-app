import { dbToFrontend, safeDbConversion } from '../utils/dbFieldMapping';
import { validateAndSanitize, coerceDataTypes } from '../utils/dataValidation';

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

export default fetchChatMessages;