import { useEffect, useRef } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

export const useMessageStatusUpdates = (chatId, onStatusUpdate) => {
    const { supabase, session } = useSupabase();
    const channelRef = useRef(null);

    useEffect(() => {
        // Channel Start karne ka function
        const startChannel = () => {
            // Agar purana channel zinda hai, toh pehle usse maaro (Cleanup)
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }

            if (!chatId) return;

            console.log(`🔌 Connecting to message status updates for chat: ${chatId}...`);

            // Naya channel banao
            const channel = supabase
                .channel(`message_status_${chatId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'messages',
                        filter: `chat_id=eq.${chatId}`
                    },
                    (payload) => {
                        console.log('⚡ Message status update received:', payload);
                        onStatusUpdate(payload.new);
                    }
                )
                .subscribe((status) => {
                    console.log(`Message status updates status: ${status}`);

                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Message status updates connected!');
                    }

                    // Agar error aaye ya time out ho jaye, toh turant restart karo
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.log('❌ Message status updates connection died. Retrying in 1s...');
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
    }, [chatId, onStatusUpdate, supabase, session]);
};