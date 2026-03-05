import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

/**
 * useChatSettings
 * 
 * Handles:
 * - Room mute toggle
 * - Temporary (vanish) chat settings
 * - Duration presets
 * - Blocking users
 */
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
    const [vanishPresets, setVanishPresets] = useState([]);

    // Load initial settings
    useEffect(() => {
        if (!chatId || !currentUser?.id) return;

        // Local mute
        const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
        setIsMuted(!!mutedChats[chatId]);

        // Remote temp chat settings
        const fetchSettings = async () => {
            try {
                const { data } = await supabase
                    .from('temporary_chat_settings')
                    .select('is_enabled, vanish_duration')
                    .eq('chat_id', chatId)
                    .eq('user_id', currentUser.id)
                    .maybeSingle();

                if (data) {
                    setIsTempChat(data.is_enabled);
                    if (data.vanish_duration) setSelectedVanishDuration(data.vanish_duration);
                }
            } catch (err) {
                console.warn('Fallback to local temp chat state');
            }
        };

        fetchSettings();
    }, [chatId, currentUser, supabase]);

    // Fetch presets (cached at module level if possible, but fine here for now)
    useEffect(() => {
        const fetchPresets = async () => {
            const { data } = await supabase
                .from('vanish_duration_presets')
                .select('*')
                .order('duration_seconds', { ascending: true });
            if (data) setVanishPresets(data);
        };
        fetchPresets();
    }, [supabase]);

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

    return {
        isMuted,
        isTempChat,
        setIsTempChat,
        selectedVanishDuration,
        setSelectedVanishDuration,
        vanishPresets,
        handleMuteToggle,
        confirmBlockUser,
    };
}
