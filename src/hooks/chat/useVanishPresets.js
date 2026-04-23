import { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';

/**
 * useVanishPresets
 * 
 * Fetches and manages vanish duration presets from the database.
 * Used for both per-chat vanish mode and global vanish settings.
 */
export function useVanishPresets() {
    const { supabase } = useSupabase();
    const [presets, setPresets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPresets = async () => {
            try {
                const { data, error } = await supabase
                    .from('vanish_duration_presets')
                    .select('*')
                    .order('duration_seconds', { ascending: true });
                
                if (error) throw error;
                if (data) setPresets(data);
            } catch (err) {
                console.error('[useVanishPresets] Error fetching presets:', err);
                // Fallback presets in case of error
                setPresets([
                    { id: '1h', display_name: '1 Hour', duration_seconds: 3600, icon: 'fa-clock' },
                    { id: '1d', display_name: '1 Day', duration_seconds: 86400, icon: 'fa-calendar-day' },
                    { id: '1w', display_name: '1 Week', duration_seconds: 604800, icon: 'fa-calendar-week' }
                ]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPresets();
    }, [supabase]);

    return { presets, isLoading };
}
