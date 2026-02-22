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
                    {/* Default / Remove wallpaper tile */}
                    <div
                        className={`wallpaper-item default-none ${selectedId === null && !chatWallpaper ? 'selected' : ''}`}
                        onClick={handleRemove}
                    >
                        <div className="wallpaper-preview none-preview">
                            <ImageIcon size={24} />
                            <span>Default</span>
                        </div>
                        {selectedId === null && !chatWallpaper && (
                            <div className="selected-badge"><Check size={14} /></div>
                        )}
                    </div>

                    {loading ? (
                        <div className="loading-placeholder">
                            <div className="loading-spinner" />
                            Loading wallpapers...
                        </div>
                    ) : (
                        filteredWallpapers.map(wp => {
                            const isSelected = selectedId === wp.id || (!selectedId && chatWallpaper === wp.url);
                            return (
                                <div
                                    key={wp.id}
                                    className={`wallpaper-item ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleSelect(wp)}
                                >
                                    <div className="wallpaper-preview">
                                        <img src={wp.thumbnail_url || wp.url} alt={wp.name} loading="lazy" />
                                    </div>
                                    {isSelected && (
                                        <div className="selected-badge">
                                            <Check size={14} />
                                        </div>
                                    )}
                                    <div className="wallpaper-name">{wp.name}</div>
                                </div>
                            );
                        })
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
