import { useEffect, useRef } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

export const useRealtimeMessages = (chatId, onMessage, currentUserId) => {
    const { supabase, session } = useSupabase();
    const channelRef = useRef(null);
    const throttleRef = useRef(null);

    useEffect(() => {
        // Channel Start karne ka function
        const startChannel = () => {
            // Agar purana channel zinda hai, toh pehle usse maaro (Cleanup)
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }

            if (!chatId) return;

            console.log(`🔌 Connecting to chat messages for chat: ${chatId}...`);

            // Throttled message handler to prevent excessive updates
            const throttledMessageHandler = (payload) => {
                if (throttleRef.current) return; // Skip if already processing

                throttleRef.current = setTimeout(() => {
                    throttleRef.current = null;
                }, 100); // 100ms throttle

                console.log('⚡ New message received:', payload);
                onMessage(payload.new);
            };

            // Naya channel banao
            const channel = supabase
                .channel(`chat_messages_${chatId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `chat_id=eq.${chatId}`
                    },
                    throttledMessageHandler
                )
                .subscribe((status) => {
                    console.log(`Chat messages status: ${status}`);

                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Chat messages connected!');
                    }

                    // Agar error aaye ya time out ho jaye, toh turant restart karo
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.log('❌ Chat messages connection died. Retrying in 1s...');
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
            if (throttleRef.current) clearTimeout(throttleRef.current);
        };
    }, [chatId, supabase, session]); // Dependency array
};