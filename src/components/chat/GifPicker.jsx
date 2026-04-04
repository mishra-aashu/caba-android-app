import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import debounce from 'lodash/debounce';
import styles from './GifPicker.module.css';

// Giphy API Configuration (Provided by USER)
const gf = new GiphyFetch('q5HuloFjQZArLJ7yMJhecRiZvrr7Idza');

const KlipyGifPicker = ({ onSelectGif }) => {
    const [search, setSearch] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [gridKey, setGridKey] = useState("trending");
    const [containerWidth, setContainerWidth] = useState(300); // Default fallback
    
    const containerRef = useRef(null);

    // Update width on resize
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth - 20); // Subtract padding
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // Fetching function for Giphy Grid
    const fetchGifs = (offset) => {
        if (search.trim()) {
            return gf.search(search, { offset, limit: 12 });
        }
        return gf.trending({ offset, limit: 12 });
    };

    // Handle Search with Debounce
    const debouncedSearch = useMemo(
        () => debounce((query) => {
            setIsSearching(false);
            setGridKey(query || "trending");
        }, 600),
        []
    );

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearch(query);
        setIsSearching(true);
        debouncedSearch(query);
    };

    // Handle GIF selection
    const handleGifClick = (gif, e) => {
        if (e) e.preventDefault();
        // Use fixed_height for better quality
        const gifUrl = gif.images.fixed_height.url;
        onSelectGif(gifUrl);
    };

    return (
        <div className={styles['gif-picker-container']} ref={containerRef}>
            {/* Search Bar */}
            <div className={styles['gif-search-bar']}>
                <input
                    type="text"
                    placeholder="Search GIPHY..."
                    value={search}
                    onChange={handleSearch}
                    autoFocus
                />
                {isSearching ? (
                    <div className={styles['search-spinner']}></div>
                ) : (
                    <span className={styles['search-icon']}>🔍</span>
                )}
            </div>

            {/* Giphy SDK Grid */}
            <div className={styles['gif-grid-scroll']}>
                <Grid
                    key={`${gridKey}-${containerWidth}`}
                    onGifClick={handleGifClick}
                    fetchGifs={fetchGifs}
                    width={containerWidth}
                    columns={containerWidth < 400 ? 2 : 3}
                    gutter={8}
                    noLink={true}
                    hideAttribution={true}
                />
            </div>

            <div className={styles['giphy-branding']}>
                <img 
                    src="https://developers.giphy.com/branch/master/static/header-logo-0fec0225d189c79ec4d773ad089eb376.png" 
                    alt="Powered by GIPHY" 
                    height="14" 
                />
            </div>
        </div>
    );
};

export default KlipyGifPicker;