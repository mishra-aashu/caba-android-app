import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { X, Check, Image as ImageIcon, Trash2 } from 'lucide-react';
import './WallpaperPicker.css';

const WallpaperPicker = ({ onClose }) => {
    const { supabase } = useSupabase();
    const { selectWallpaper, chatWallpaper } = useChatTheme();
    const [wallpapers, setWallpapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');

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
        await selectWallpaper(wallpaper.id);
    };

    const handleRemove = async () => {
        await selectWallpaper(null);
    };

    return (
        <div className="wallpaper-picker-overlay" onClick={onClose}>
            <div className="wallpaper-picker-container" onClick={e => e.stopPropagation()}>
                <div className="wallpaper-picker-header">
                    <h3>Chat Wallpaper</h3>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="wallpaper-categories">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`category-btn ${activeCategory === cat ? 'active' : ''}`}
                            onClick={() => setActiveCategory(cat)}
                        >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="wallpaper-grid">
                    <div
                        className={`wallpaper-item default-none ${!chatWallpaper ? 'selected' : ''}`}
                        onClick={handleRemove}
                    >
                        <div className="wallpaper-preview none-preview">
                            <ImageIcon size={24} />
                            <span>Default</span>
                        </div>
                        {!chatWallpaper && <div className="selected-badge"><Check size={14} /></div>}
                    </div>

                    {loading ? (
                        <div className="loading-placeholder">Loading wallpapers...</div>
                    ) : (
                        filteredWallpapers.map(wp => (
                            <div
                                key={wp.id}
                                className={`wallpaper-item ${chatWallpaper === wp.url ? 'selected' : ''}`}
                                onClick={() => handleSelect(wp)}
                            >
                                <div className="wallpaper-preview">
                                    <img src={wp.thumbnail_url || wp.url} alt={wp.name} loading="lazy" />
                                </div>
                                {chatWallpaper === wp.url && (
                                    <div className="selected-badge">
                                        <Check size={14} />
                                    </div>
                                )}
                                <div className="wallpaper-name">{wp.name}</div>
                            </div>
                        ))
                    )}
                </div>

                <div className="wallpaper-picker-footer">
                    <button className="remove-btn" onClick={handleRemove}>
                        <Trash2 size={16} />
                        Reset to Default
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WallpaperPicker;
