import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

export const useTypingIndicator = (chatId, currentUserId) => {
    const { supabase } = useSupabase();
    const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);

    useEffect(() => {
        if (!chatId || !supabase) return;

        const channel = supabase
            .channel(`typing_${chatId}`)
            .on('broadcast', { event: 'typing' }, (payload) => {
                if (payload.payload.userId !== currentUserId) {
                    setIsOtherUserTyping(payload.payload.isTyping);

                    if (payload.payload.isTyping) {
                        setTimeout(() => setIsOtherUserTyping(false), 3000);
                    }
                }
            })
            .subscribe();

        return () => channel.unsubscribe();
    }, [chatId, currentUserId, supabase]);

    const sendTypingStatus = useCallback((isTyping) => {
        if (!supabase || !chatId) return;
        
        const channel = supabase.channel(`typing_${chatId}`);
        channel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: currentUserId, isTyping }
        });
    }, [supabase, chatId, currentUserId]);

    return { isOtherUserTyping, sendTypingStatus };
};