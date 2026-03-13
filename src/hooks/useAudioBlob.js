import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { db } from '../db/db';

const audioBlobCache = new Map();

/**
 * Hook to download audio as a Blob ONCE and reuse the object URL.
 * Solves the issue of 206 Partial Content requests firing repeatedly for <audio> tags.
 */
export const useAudioBlob = (mediaPath) => {
    const [audioUrl, setAudioUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!mediaPath) {
            setAudioUrl(null);
            return;
        }

        // 1. Check in-memory cache first
        if (audioBlobCache.has(mediaPath)) {
            setAudioUrl(audioBlobCache.get(mediaPath));
            return;
        }

        let isMounted = true;
        let urlToRevoke = null;

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
                    audioBlobCache.set(mediaPath, objectUrl);
                    setAudioUrl(objectUrl);
                    urlToRevoke = objectUrl;
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
            // Note: We deliberately DO NOT revoke the ObjectURL here because
            // we are caching it in audioBlobCache for reuse across re-renders.
            // Revoking it would break the audio in other message instances.
        };
    }, [mediaPath]);

    return { audioUrl, isLoading, error };
};
