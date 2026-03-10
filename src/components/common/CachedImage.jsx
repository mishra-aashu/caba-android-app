import React, { useState, useEffect } from 'react';
import { FileCache } from '../../utils/FileCache';

/**
 * CachedImage Component
 * Automatically caches remote images to the local filesystem and loads from cache when available.
 */
const CachedImage = ({ src, alt, className, style, onClick, onLoad, onError }) => {
    const [displaySrc, setDisplaySrc] = useState(src);

    useEffect(() => {
        let isMounted = true;

        const resolveSrc = async () => {
            if (!src) return;

            const cached = await FileCache.getCachedUrl(src);
            if (isMounted) {
                setDisplaySrc(cached);
            }
        };

        resolveSrc();

        return () => { isMounted = false; };
    }, [src]);

    return (
        <img
            src={displaySrc}
            alt={alt}
            className={className}
            style={style}
            onClick={onClick}
            onLoad={onLoad}
            onError={onError}
        />
    );
};

export default CachedImage;
