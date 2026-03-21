import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Search, X } from 'lucide-react';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import KlipyGifPicker from '../chat/GifPicker.jsx';
import './EmojiPicker.css';

const baseUrl = import.meta.env.BASE_URL || '/';

const EmojiPicker = ({
    onEmojiSelect,
    onClose,
    buttonClassName = '',
    showCloseButton = true,
    isOpen: controlledIsOpen,
    onOpenChange,
    showTrigger = true,
    isInline = false
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('emoji');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [renderLevel, setRenderLevel] = useState(0);

    const { emojiStyle, emojiMap, mapLoading, preferredEmojis = [] } = useEmojiStyle();

    // Dynamically group emojis from iamcal raw data
    const categories = useMemo(() => {
        if (!emojiMap?.raw) return [];
        
        const groups = {};
        
        // Helper to find raw emoji data by native/unified
        const findEmojiByNative = (native) => {
            return emojiMap.raw.find(item => {
                const itemNative = String.fromCodePoint(...item.unified.split('-').map(u => parseInt(u, 16)));
                return itemNative === native;
            });
        };

        const transformEmoji = (item, catName) => ({
            id: item.unified.toLowerCase(),
            name: item.short_name,
            native: String.fromCodePoint(...item.unified.split('-').map(u => parseInt(u, 16))),
            hex: item.unified.toLowerCase(),
            category: catName
        });

        // 1. Handle "Frequently Used" / "Recent"
        if (preferredEmojis.length > 0) {
            groups['Recent'] = {
                id: 'recent',
                name: 'Recent',
                icon: '🕒',
                emojis: preferredEmojis.map(native => {
                    const item = findEmojiByNative(native);
                    return item ? transformEmoji(item, 'Recent') : null;
                }).filter(Boolean)
            };
        }

        emojiMap.raw.forEach(item => {
            const rawCat = item.category;
            let catName = rawCat;
            if (rawCat === 'Smileys & Emotion') catName = 'Smileys';
            
            if (!groups[catName]) {
                groups[catName] = { 
                    id: catName.replace(/\s+/g, '-'), 
                    name: catName, 
                    emojis: [],
                    // Default icon is first emoji, but we'll override special ones
                    icon: String.fromCodePoint(...item.unified.split('-').map(u => parseInt(u, 16)))
                };
                
                // Override icons for better visual clarity
                if (catName === 'Smileys') groups[catName].icon = '😀';
                if (catName === 'People & Body') groups[catName].icon = '👋';
            }
            
            groups[catName].emojis.push(transformEmoji(item, catName));
        });

        // 2. Special sorting for "Smileys" to put actual faces first
        // Most face smileys start with 1f6 or 1f9
        if (groups['Smileys']) {
            groups['Smileys'].emojis.sort((a, b) => {
                const isFaceA = a.hex.startsWith('1f6') || a.hex.startsWith('1f9aa') || (a.hex >= '1f600' && a.hex <= '1f64f');
                const isFaceB = b.hex.startsWith('1f6') || b.hex.startsWith('1f9aa') || (b.hex >= '1f600' && b.hex <= '1f64f');
                if (isFaceA && !isFaceB) return -1;
                if (!isFaceA && isFaceB) return 1;
                return 0; // Keep original order for same type
            });
        }
        
        const order = [
            'Recent',
            'Smileys',
            'People & Body',
            'Animals & Nature',
            'Food & Drink',
            'Travel & Places',
            'Activities',
            'Objects',
            'Symbols',
            'Flags'
        ];

        return order.map(name => groups[name]).filter(Boolean);
    }, [emojiMap, preferredEmojis]);

    // Set initial category when categories are loaded
    useEffect(() => {
        if (categories.length > 0 && !activeCategory) {
            setActiveCategory(categories[0].id);
        }
    }, [categories, activeCategory]);

    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const pickerRef = useRef(null);
    const scrollRef = useRef(null);

    // Initial render level
    useEffect(() => {
        if (isOpen) {
            setRenderLevel(1);
        } else {
            setRenderLevel(0);
        }
    }, [isOpen]);

    // Incremental rendering logic
    useEffect(() => {
        if (isOpen && renderLevel > 0 && renderLevel < categories.length) {
            const timer = setTimeout(() => {
                setRenderLevel(prev => prev + 1);
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [isOpen, renderLevel, categories.length]);

    // Filtered emojis based on search
    const filteredEmojis = useMemo(() => {
        if (!searchQuery || !categories.length) return null;
        const query = searchQuery.toLowerCase();
        let matches = [];
        
        for (const cat of categories) {
            const catMatches = cat.emojis.filter(e => 
                e.name.toLowerCase().includes(query) || 
                e.hex.includes(query)
            );
            matches.push(...catMatches);
            if (matches.length > 100) break;
        }
        return matches.slice(0, 100);
    }, [searchQuery, categories]);

    const handleEmojiSelect = useCallback((emojiData) => {
        onEmojiSelect(emojiData.native);
    }, [onEmojiSelect]);

    const handleToggle = useCallback(() => {
        if (onOpenChange) {
            onOpenChange(!isOpen);
        } else {
            setInternalIsOpen(!isOpen);
        }
    }, [isOpen, onOpenChange]);

    const scrollToCategory = useCallback((categoryId) => {
        setActiveCategory(categoryId);
        setSearchQuery('');
        const element = document.getElementById(`cat-${categoryId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event) => {
            if (event.target.closest('.emoji-picker-btn')) return;
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                if (onOpenChange) onOpenChange(false);
                else setInternalIsOpen(false);
                onClose && onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [isOpen, onOpenChange, onClose]);

    return (
        <div 
            className={`emoji-picker-container ${!showTrigger ? 'no-trigger' : ''}`} 
            ref={pickerRef}
        >
            {showTrigger && (
                <button
                    type="button"
                    className={`emoji-picker-btn ${buttonClassName}`}
                    onClick={handleToggle}
                    title="Add emoji"
                >
                    <Smile size={20} />
                </button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className={`emoji-picker-popup ${isInline ? 'inline' : ''}`}
                        initial={isInline ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 15 }}
                        animate={isInline ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                        exit={isInline ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300, duration: 0.2 }}
                    >
                        <div className="picker-header">
                            <div className="picker-tabs">
                                <button className={`tab-btn ${activeTab === 'emoji' ? 'active' : ''}`} onClick={() => setActiveTab('emoji')}>Emoji</button>
                                <button className={`tab-btn ${activeTab === 'gif' ? 'active' : ''}`} onClick={() => setActiveTab('gif')}>GIF</button>
                            </div>
                            <div className="header-actions">
                                {activeTab === 'emoji' && (
                                    <button
                                        className={`header-action-btn ${isSearchOpen ? 'active' : ''}`}
                                        onClick={() => {
                                            setIsSearchOpen(!isSearchOpen);
                                            if (isSearchOpen) setSearchQuery('');
                                        }}
                                        title="Search emojis"
                                    >
                                        <Search size={18} />
                                    </button>
                                )}
                                {showCloseButton && (
                                    <button
                                        className="header-close-btn"
                                        onClick={() => {
                                            if (onOpenChange) onOpenChange(false);
                                            else setInternalIsOpen(false);
                                            onClose && onClose();
                                        }}
                                        title="Close"
                                    ><X size={18} /></button>
                                )}
                            </div>
                        </div>

                        <div className="picker-body">
                            {activeTab === 'emoji' && (
                                <>
                                    {isSearchOpen && (
                                        <div className="gif-search-bar">
                                            <input
                                                type="text"
                                                placeholder="Search emojis..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                autoFocus
                                            />
                                            <Search className="search-icon" size={16} />
                                        </div>
                                    )}

                                    {!searchQuery && categories.length > 0 && (
                                        <div className="emoji-category-bar">
                                            {categories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    className={`cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                                                    onClick={() => scrollToCategory(cat.id)}
                                                    title={cat.name}
                                                >
                                                    {cat.icon}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="emoji-scroll-area" ref={scrollRef}>
                                        {searchQuery ? (
                                            <div className="emoji-grid">
                                                {filteredEmojis.map(emoji => (
                                                    <EmojiItem key={emoji.id} emoji={emoji} style={emojiStyle} onSelect={handleEmojiSelect} />
                                                ))}
                                                {filteredEmojis.length === 0 && <div className="no-recent">No emojis found</div>}
                                            </div>
                                        ) : (
                                            <>
                                                {categories.slice(0, renderLevel).map(cat => (
                                                    <div key={cat.id} id={`cat-${cat.id}`} className="category-section">
                                                        <div className="category-title">{cat.name}</div>
                                                        <div className="emoji-grid">
                                                            {cat.emojis.map(emoji => (
                                                                <EmojiItem key={emoji.id} emoji={emoji} style={emojiStyle} onSelect={handleEmojiSelect} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                                {renderLevel < categories.length && <div style={{ height: '300px' }} />}
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                            {activeTab === 'gif' && <KlipyGifPicker onSelectGif={onEmojiSelect} />}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const EmojiItem = memo(({ emoji, style, onSelect }) => {
    const { emojiMap, mapLoading } = useEmojiStyle();
    
    if (mapLoading) return <div className="emoji-item" style={{ width: '100%', aspectRatio: '1/1' }} />;

    const mapping = emojiMap?.mapping?.[emoji.hex];
    const sheetName = emojiMap?.sheets?.[style];

    if (style === 'native' || !mapping || !sheetName) {
        return (
            <div className="emoji-item" onClick={() => onSelect(emoji)} title={emoji.name}>
                <span style={{ fontSize: '1.2em' }}>{emoji.native}</span>
            </div>
        );
    }

    const spriteUrl = `${baseUrl}assets/emojis/spritesheets/${sheetName}`;
    const GRID_SIZE = 62; 
    const posX = (mapping.x / (GRID_SIZE - 1)) * 100;
    const posY = (mapping.y / (GRID_SIZE - 1)) * 100;

    return (
        <div className="emoji-item" onClick={() => onSelect(emoji)} title={emoji.name}>
            <span
                className="emoji-sprite-item"
                role="img"
                aria-label={emoji.name}
                style={{
                    display: 'inline-block',
                    width: '24px',
                    height: '24px',
                    backgroundImage: `url(${spriteUrl})`,
                    backgroundPosition: `${posX}% ${posY}%`,
                    backgroundSize: `${GRID_SIZE * 100}% ${GRID_SIZE * 100}%`,
                    backgroundRepeat: 'no-repeat',
                    imageRendering: 'auto',
                    WebkitImageRendering: 'optimize-contrast'
                }}
            />
        </div>
    );
});

export default EmojiPicker;
