import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { X, Check, Image as ImageIcon, Trash2 } from 'lucide-react';
import styles from './WallpaperPicker.module.css';

const WallpaperPicker = ({ onClose }) => {
    const { supabase } = useSupabase();
    const { selectWallpaper, chatWallpaper } = useChatTheme();
    const [wallpapers, setWallpapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');
    const [selectedId, setSelectedId] = useState(null);  // track by ID for instant badge

    useEffect(() => {
        fetchWallpapers();
    }, []);

    const fetchWallpapers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('wallpapers')
                .select('*')
                .eq('is_active', true)
                .order('category', { ascending: true });

            if (error) throw error;
            setWallpapers(data || []);
        } catch (error) {
            console.error('Error fetching wallpapers:', error);
        } finally {
            setLoading(false);
        }
    };

    const categories = ['all', ...new Set(wallpapers.map(w => w.category))];

    const filteredWallpapers = activeCategory === 'all'
        ? wallpapers
        : wallpapers.filter(w => w.category === activeCategory);

    const handleSelect = async (wallpaper) => {
        setSelectedId(wallpaper.id);                      // instant badge feedback
        const url = wallpaper.url || wallpaper.thumbnail_url;
        await selectWallpaper(wallpaper.id, null, url);   // pass URL for instant apply
        onClose();                                         // close after selecting
    };

    const handleRemove = async () => {
        setSelectedId(null);
        await selectWallpaper(null);
        onClose();
    };

    return (
        <div className={styles['wallpaper-picker-overlay']} onClick={onClose}>
            <div className={styles['wallpaper-picker-container']} onClick={e => e.stopPropagation()}>
                <div className={styles['wallpaper-picker-header']}>
                    <h3>Chat Wallpaper</h3>
                    <button className={styles['close-btn']} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles['wallpaper-categories']}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`${styles['category-btn']} ${activeCategory === cat ? styles.active : ''}`}
                            onClick={() => setActiveCategory(cat)}
                        >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                    ))}
                </div>

                <div className={styles['wallpaper-grid']}>
                    {/* Default / Remove wallpaper tile */}
                    <div
                        className={`${styles['wallpaper-item']} ${styles['default-none']} ${selectedId === null && !chatWallpaper ? styles.selected : ''}`}
                        onClick={handleRemove}
                    >
                        <div className={`${styles['wallpaper-preview']} ${styles['none-preview']}`}>
                            <ImageIcon size={24} />
                            <span>Default</span>
                        </div>
                        {selectedId === null && !chatWallpaper && (
                            <div className={styles['selected-badge']}><Check size={14} /></div>
                        )}
                    </div>

                    {loading ? (
                        <div className={styles['loading-placeholder']}>
                            <div className={styles['loading-spinner']} />
                            Loading wallpapers...
                        </div>
                    ) : (
                        filteredWallpapers.map(wp => {
                            const isSelected = selectedId === wp.id || (!selectedId && chatWallpaper === wp.url);
                            return (
                                <div
                                    key={wp.id}
                                    className={`${styles['wallpaper-item']} ${isSelected ? styles.selected : ''}`}
                                    onClick={() => handleSelect(wp)}
                                >
                                    <div className={styles['wallpaper-preview']}>
                                        <img src={wp.thumbnail_url || wp.url} alt={wp.name} loading="lazy" />
                                    </div>
                                    {isSelected && (
                                        <div className={styles['selected-badge']}>
                                            <Check size={14} />
                                        </div>
                                    )}
                                    <div className={styles['wallpaper-name']}>{wp.name}</div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className={styles['wallpaper-picker-footer']}>
                    <button className={styles['remove-btn']} onClick={handleRemove}>
                        <Trash2 size={16} />
                        Reset to Default
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WallpaperPicker;
