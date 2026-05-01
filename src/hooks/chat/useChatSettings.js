import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import toast from 'react-hot-toast';
import { useVanishPresets } from './useVanishPresets';
import { useNavigate } from 'react-router-dom';


/**
 * useChatSettings
 * 
 * Handles:
 * - Room mute toggle
 * - Temporary (vanish) chat settings
 * - Duration presets
 * - Duration presets
 * - Blocking users
 */

const parseDuration = (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        // Handle HH:MM:SS
        const parts = val.split(':');
        if (parts.length === 3) {
            return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        }
        // Handle "1 day", "2 hours" etc if needed (simple version)
        if (val.includes('day')) return parseInt(val) * 86400;
        return parseInt(val) || 86400;
    }
    return 86400;
};
export function useChatSettings({
    chatId,
    otherUserId,
    currentUser,
}) {
    const { supabase } = useSupabase();
    const navigate = useNavigate();

    const [isMuted, setIsMuted] = useState(false);
    const [isTempChat, setIsTempChat] = useState(false);
    const [selectedVanishDuration, setSelectedVanishDuration] = useState(86400);


    // Load initial settings and subscribe to realtime updates for SYNC
    useEffect(() => {
        if (!chatId || !currentUser?.id) return;

        // Reset states while loading new chat settings
        setIsTempChat(false);
        setIsMuted(false);

        // Local mute
        const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
        setIsMuted(!!mutedChats[chatId]);

        // Remote temp chat settings (SYNCED)
        const fetchSettings = async () => {
            try {
                // [SYNC FIX] Fetch settings for this chat (from anyone, but typically it will be from the active user or their partner)
                // We want to know if ANYONE has enabled vanish mode for this chat.
                const { data } = await supabase
                    .from('temporary_chat_settings')
                    .select('is_enabled, vanish_duration, vanish_duration_seconds')
                    .eq('chat_id', chatId)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (data) {
                    setIsTempChat(data.is_enabled);
                    const dur = data.vanish_duration_seconds || data.vanish_duration;
                    if (dur) {
                        setSelectedVanishDuration(parseDuration(dur));
                    }
                }
            } catch (err) {
                console.warn('Fallback to local temp chat state');
            }
        };

        fetchSettings();

        // [REALTIME SYNC] Subscribe to changes in vanish mode for this chat
        const channel = supabase
            .channel(`vanish_sync_${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'temporary_chat_settings',
                    filter: `chat_id=eq.${chatId}`
                },
                (payload) => {
                    console.log('[Vanish Sync] Remote update received:', payload);
                    if (payload.new) {
                        const nextEnabled = payload.new.is_enabled;
                        const nextDuration = payload.new.vanish_duration_seconds || payload.new.vanish_duration;
                        
                        setIsTempChat(nextEnabled);
                        if (nextDuration) {
                            setSelectedVanishDuration(parseDuration(nextDuration));
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chatId, currentUser?.id, supabase]);

    const { presets: vanishPresets, isLoading: isVanishLoading } = useVanishPresets();



    const handleMuteToggle = useCallback(() => {
        const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
        const newState = !isMuted;
        if (newState) mutedChats[chatId] = true;
        else delete mutedChats[chatId];

        localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
        setIsMuted(newState);
        toast.success(newState ? 'Notifications muted' : 'Notifications unmuted');
    }, [chatId, isMuted]);

    const confirmBlockUser = useCallback(async () => {
        if (!otherUserId || !currentUser) return;
        try {
            const { error } = await supabase.from('relationships').upsert({
                user_id: currentUser.id,
                target_id: otherUserId,
                status: 'blocked'
            });
            if (error) throw error;
            toast.success('User blocked');
            navigate('/');
        } catch (error) {
            console.error('Block failed:', error);
            toast.error('Failed to block user');
        }
    }, [otherUserId, currentUser, supabase, navigate]);

    const updateVanishDuration = useCallback(async (durationSeconds) => {
        if (!chatId || !currentUser?.id) return;
        try {
            setSelectedVanishDuration(durationSeconds);
            const { error } = await supabase
                .from('temporary_chat_settings')
                .upsert({
                    chat_id: chatId,
                    user_id: currentUser.id,
                    is_enabled: true, // Auto-enable if setting duration
                    vanish_duration_seconds: parseInt(durationSeconds) || 86400,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'chat_id,user_id' });

            if (error) throw error;
            setIsTempChat(true);
            toast.success(`Vanish duration set to ${durationSeconds}s`);
        } catch (error) {
            console.error('Failed to update vanish duration:', error);
            toast.error('Failed to update duration');
        }
    }, [chatId, currentUser, supabase]);

    const toggleVanishMode = useCallback(async () => {
        if (!chatId || !currentUser?.id) return;
        const nextState = !isTempChat;
        try {
            setIsTempChat(nextState);
            const { error } = await supabase
                .from('temporary_chat_settings')
                .upsert({
                    chat_id: chatId,
                    user_id: currentUser.id,
                    is_enabled: nextState,
                    vanish_duration_seconds: parseInt(selectedVanishDuration) || 86400,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'chat_id,user_id' });

            if (error) throw error;
            toast.success(nextState ? 'Vanish Mode turned on' : 'Vanish Mode turned off');
        } catch (error) {
            console.error('Failed to toggle vanish mode:', error);
            setIsTempChat(!nextState); // Rollback
            toast.error('Failed to toggle vanish mode');
        }
    }, [chatId, currentUser, isTempChat, selectedVanishDuration, supabase]);

    return useMemo(() => ({
        isMuted,
        isTempChat,
        setIsTempChat,
        toggleVanishMode,
        selectedVanishDuration,
        setSelectedVanishDuration,
        vanishPresets,
        isVanishLoading,
        handleMuteToggle,
        confirmBlockUser,
        updateVanishDuration,
    }), [
        isMuted, isTempChat, toggleVanishMode, 
        selectedVanishDuration, vanishPresets, 
        isVanishLoading, handleMuteToggle, 
        confirmBlockUser, updateVanishDuration
    ]);
}
