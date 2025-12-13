import { useEffect, useCallback } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import NotificationSound from '../utils/notificationSound';

export const useRealtimeMessages = (chatId, onMessage) => {
    const { supabase } = useSupabase();
    
    const stableOnMessage = useCallback((payload) => {
        onMessage(payload.new);
        NotificationSound.playMessageNotification();
    }, [onMessage]);
    
    useEffect(() => {
        if (!chatId || !supabase) return;

        const channel = supabase
            .channel(`chat_messages_${chatId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`
            }, stableOnMessage)
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [chatId, supabase, stableOnMessage]);
};