import { useState, useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';
import { extractWaveformData } from '../utils/audioUtils';

// Global caches with cleanup
const audioBlobCache = new Map();
const waveformCache = new Map();
const pendingRequests = new Map();

// Cleanup old blob URLs to prevent memory leaks
const MAX_CACHE_SIZE = 50;
const cleanupOldestCache = (cache) => {
    if (cache.size > MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        const url = cache.get(firstKey);
        if (url && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
        cache.delete(firstKey);
    }
};

/**
 * Hook to download audio as a Blob and extract waveform data
 * with proper caching and error handling
 */
export const useAudioBlob = (mediaPath) => {
    const [audioUrl, setAudioUrl] = useState(null);
    const [waveform, setWaveform] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        
        const loadAudio = async () => {
            // Reset state
            if (!mediaPath) {
                setAudioUrl(null);
                setWaveform([]);
                setError(null);
                return;
            }

            // Handle blob URLs or direct HTTP URLs
            if (mediaPath.startsWith('blob:') || mediaPath.startsWith('http')) {
                setAudioUrl(mediaPath);
                
                // Try to get cached waveform
                if (waveformCache.has(mediaPath)) {
                    setWaveform(waveformCache.get(mediaPath));
                } else if (mediaPath.startsWith('blob:')) {
                    // Extract waveform from blob URL
                    try {
                        const response = await fetch(mediaPath);
                        const blob = await response.blob();
                        const waveformData = await extractWaveformData(blob, 40);
                        if (mountedRef.current) {
                            waveformCache.set(mediaPath, waveformData);
                            setWaveform(waveformData);
                        }
                    } catch (err) {
                        console.warn('Failed to extract waveform from blob:', err);
                        // Set default waveform on error
                        setWaveform(Array(40).fill(0.3));
                    }
                }
                return;
            }

            // Check cache first
            if (audioBlobCache.has(mediaPath)) {
                const cachedUrl = audioBlobCache.get(mediaPath);
                const cachedWaveform = waveformCache.get(mediaPath) || Array(40).fill(0.3);
                
                if (mountedRef.current) {
                    setAudioUrl(cachedUrl);
                    setWaveform(cachedWaveform);
                }
                return;
            }

            // Check if request is already pending
            if (pendingRequests.has(mediaPath)) {
                try {
                    const result = await pendingRequests.get(mediaPath);
                    if (mountedRef.current) {
                        setAudioUrl(result.url);
                        setWaveform(result.waveform);
                    }
                } catch (err) {
                    if (mountedRef.current) {
                        setError('Failed to load audio');
                    }
                }
                return;
            }

            // Create new request
            const requestPromise = (async () => {
                if (mountedRef.current) {
                    setIsLoading(true);
                    setError(null);
                }

                try {
                    // Download from Supabase storage
                    const { data: blob, error: downloadError } = await supabase
                        .storage
                        .from('media')
                        .download(mediaPath);

                    if (downloadError) throw downloadError;
                    if (!blob) throw new Error('No data received');

                    // Create blob URL
                    const objectUrl = URL.createObjectURL(blob);
                    
                    // Extract waveform data
                    let waveformData;
                    try {
                        waveformData = await extractWaveformData(blob, 40);
                    } catch (waveformError) {
                        console.warn('Waveform extraction failed, using default:', waveformError);
                        waveformData = Array(40).fill(0.3);
                    }

                    // Cache the results
                    cleanupOldestCache(audioBlobCache);
                    cleanupOldestCache(waveformCache);
                    
                    audioBlobCache.set(mediaPath, objectUrl);
                    waveformCache.set(mediaPath, waveformData);

                    return { url: objectUrl, waveform: waveformData };

                } catch (err) {
                    console.error('Error fetching audio blob:', err);
                    
                    // Fallback to public URL
                    try {
                        const { data } = supabase.storage
                            .from('media')
                            .getPublicUrl(mediaPath);
                        
                        if (data?.publicUrl) {
                            const fallbackWaveform = Array(40).fill(0.3);
                            audioBlobCache.set(mediaPath, data.publicUrl);
                            waveformCache.set(mediaPath, fallbackWaveform);
                            return { url: data.publicUrl, waveform: fallbackWaveform };
                        }
                    } catch (fallbackError) {
                        console.error('Fallback failed:', fallbackError);
                    }
                    
                    throw err;
                }
            })();

            pendingRequests.set(mediaPath, requestPromise);

            try {
                const result = await requestPromise;
                
                if (mountedRef.current) {
                    setAudioUrl(result.url);
                    setWaveform(result.waveform);
                    setError(null);
                }
            } catch (err) {
                if (mountedRef.current) {
                    setError('Failed to load audio. Please try again.');
                }
            } finally {
                pendingRequests.delete(mediaPath);
                if (mountedRef.current) {
                    setIsLoading(false);
                }
            }
        };

        loadAudio();

        return () => {
            mountedRef.current = false;
        };
    }, [mediaPath]);

    return { audioUrl, waveform, isLoading, error };
};

// Cleanup function to be called on app unmount
export const cleanupAudioCache = () => {
    audioBlobCache.forEach((url) => {
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    });
    audioBlobCache.clear();
    waveformCache.clear();
    pendingRequests.clear();
};