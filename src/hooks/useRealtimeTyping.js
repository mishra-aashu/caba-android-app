import { useEffect, useState, useCallback, useRef } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

export const useTypingIndicator = (chatId, currentUserId) => {
    const { supabase, session } = useSupabase();
    const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
    const channelRef = useRef(null);

    useEffect(() => {
        // Channel Start karne ka function
        const startChannel = () => {
            // Agar purana channel zinda hai, toh pehle usse maaro (Cleanup)
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }

            if (!chatId) return;

            console.log(`🔌 Connecting to typing indicators for chat: ${chatId}...`);

            // Naya channel banao
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
                .subscribe((status) => {
                    console.log(`Typing indicators status: ${status}`);

                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Typing indicators connected!');
                    }

                    // Agar error aaye ya time out ho jaye, toh turant restart karo
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.log('❌ Typing indicators connection died. Retrying in 1s...');
                        setTimeout(startChannel, 1000);
                    }
                });

            channelRef.current = channel;
        };

        // Initial Start
        startChannel();

        // Cleanup when component unmounts
        return () => {
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, [chatId, currentUserId, supabase, session]);

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