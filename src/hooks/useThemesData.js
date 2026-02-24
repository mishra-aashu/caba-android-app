import { useQuery } from '@tanstack/react-query';
import { supabase } from '../config/supabase';

// ----------------------------------------------------------------------
// Aggressively Cached Static/Semi-Static Data Hooks
// ----------------------------------------------------------------------

export const useUserTheme = (userId) => {
    return useQuery({
        queryKey: ['user_themes', userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('user_themes')
                .select('theme_id')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) throw error;
            return data?.theme_id || null;
        },
        enabled: !!userId,
        staleTime: Infinity,           // Never stale until invalidated
        gcTime: 1000 * 60 * 60 * 24,   // Kept in cache for 24 hours
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
};

export const useChatThemeQuery = (chatId) => {
    return useQuery({
        queryKey: ['chat_themes', chatId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('chat_themes')
                .select('theme_name')
                .eq('chat_id', chatId)
                .maybeSingle();

            if (error) throw error;
            return data?.theme_name || null;
        },
        enabled: !!chatId,
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
};

export const useChatWallpaperQuery = (chatId) => {
    return useQuery({
        queryKey: ['chat_wallpapers', chatId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('chat_wallpapers')
                .select(`custom_url, wallpaper:wallpapers(url)`)
                .eq('chat_id', chatId)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                return data.custom_url || data.wallpaper?.url || null;
            }
            return null;
        },
        enabled: !!chatId,
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
};
