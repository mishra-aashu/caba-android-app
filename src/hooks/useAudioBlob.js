import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { extractWaveformData } from '../utils/audioUtils';

const audioBlobCache = new Map();
const waveformCache = new Map();

/**
 * Hook to download audio as a Blob ONCE and reuse the object URL.
 * Also extracts waveform data for visualization.
 */
export const useAudioBlob = (mediaPath) => {
    const [audioUrl, setAudioUrl] = useState(null);
    const [waveform, setWaveform] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!mediaPath) {
            setAudioUrl(null);
            setWaveform([]);
            return;
        }

        // 1. Check in-memory cache first
        if (audioBlobCache.has(mediaPath)) {
            setAudioUrl(audioBlobCache.get(mediaPath));
            setWaveform(waveformCache.get(mediaPath) || []);
            return;
        }

        let isMounted = true;

        const fetchAudio = async () => {
            setIsLoading(true);
            try {
                // 2. Try fetching from Supabase storage as a Blob
                const { data, error: downloadError } = await supabase
                    .storage
                    .from('media')
                    .download(mediaPath);

                if (downloadError) throw downloadError;

                if (data && isMounted) {
                    const objectUrl = URL.createObjectURL(data);
                    
                    // Extract waveform before setting state
                    const waveformData = await extractWaveformData(data, 40);
                    
                    if (isMounted) {
                        audioBlobCache.set(mediaPath, objectUrl);
                        waveformCache.set(mediaPath, waveformData);
                        setAudioUrl(objectUrl);
                        setWaveform(waveformData);
                    }
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Error fetching audio blob:', err);
                    setError(err);
                    // Fallback to the public URL if Blob download fails
                    const { data } = supabase.storage.from('media').getPublicUrl(mediaPath);
                    setAudioUrl(data.publicUrl);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchAudio();

        return () => {
            isMounted = false;
        };
    }, [mediaPath]);

    return { audioUrl, waveform, isLoading, error };
};
