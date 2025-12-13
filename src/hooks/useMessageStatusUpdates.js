import { useEffect } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

export const useMessageStatusUpdates = (chatId, onStatusUpdate) => {
    const { supabase } = useSupabase();
    
    useEffect(() => {
        if (!chatId || !supabase) return;

        const channel = supabase
            .channel(`message_status_${chatId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`
            }, (payload) => {
                onStatusUpdate(payload.new);
            })
            .subscribe();

        return () => channel.unsubscribe();
    }, [chatId, onStatusUpdate, supabase]);
};