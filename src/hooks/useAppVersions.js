import { useQuery } from '@tanstack/react-query';
import { supabase } from '../config/supabase';

/**
 * Hook to get app versions aggressively cached
 */
export const useAppVersions = () => {
    return useQuery({
        queryKey: ['app_versions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('app_versions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
};
