import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { Smile, Search, X } from 'lucide-react';
import data from '@emoji-mart/data';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import KlipyGifPicker from '../chat/GifPicker.jsx';
import './EmojiPicker.css';

// Number of categories to render initially (top categories)
const INITIAL_CATEGORIES_COUNT = 3;
// Number of categories to load per scroll
const CATEGORIES_PER_LOAD = 2;

/**
 * Utility to convert emoji-mart unified hex (e.g. "1F602") to our lowercase hyphenated format.
 * Includes zero-padding to 4 digits for consistency with assets.
 */
const formatHex = (unified) => {
    return unified.split('-').map(part => part.toLowerCase().padStart(4, '0')).join('-');
};

// Pre-process a single category - called lazily
const processCategory = (cat) => ({
    ...cat,
    emojis: cat.emojis.map(id => {
        const emoji = data.emojis[id];
        return {
            id,
            name: emoji.name,
            native: emoji.skins[0].native,
            hex: formatHex(emoji.skins[0].unified)
        };
    })
});

// Get filtered categories (excluding 'frequent' which is usually empty)
const getFilteredCategories = () => data.categories.filter(c => c.id !== 'frequent');

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
    const [isVisible, setIsVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('smileys');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [hasBeenOpened, setHasBeenOpened] = useState(false);
    // Lazy loading state
    const [visibleCategoriesCount, setVisibleCategoriesCount] = useState(INITIAL_CATEGORIES_COUNT);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    const { emojiStyle } = useEmojiStyle();
    const filteredCategories = useMemo(() => getFilteredCategories(), []);

    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const pickerRef = useRef(null);
    const scrollRef = useRef(null);
    const loadingRef = useRef(null);

    // Reset visible categories when picker opens
    useEffect(() => {
        if (isOpen) {
            setHasBeenOpened(true);
            setIsVisible(true);
            setVisibleCategoriesCount(INITIAL_CATEGORIES_COUNT);
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    // Get only the categories that should be visible (lazy loaded)
    const visibleCategories = useMemo(() => {
        return filteredCategories.slice(0, visibleCategoriesCount);
    }, [filteredCategories, visibleCategoriesCount]);

    // Process only visible categories
    const processedVisibleCategories = useMemo(() => {
        return visibleCategories.map(cat => processCategory(cat));
    }, [visibleCategories]);

    // Filtered emojis based on search
    const filteredEmojis = useMemo(() => {
        if (!searchQuery) return null;
        const query = searchQuery.toLowerCase();
        return Object.values(data.emojis).filter(emoji =>
            emoji.name.toLowerCase().includes(query) ||
            emoji.keywords.some(k => k.toLowerCase().includes(query))
        ).slice(0, 50).map(emoji => ({
            id: emoji.id,
            name: emoji.name,
            native: emoji.skins[0].native,
            hex: formatHex(emoji.skins[0].unified)
        }));
    }, [searchQuery]);

    // Scroll handler for lazy loading
    const handleScroll = useCallback(() => {
        if (scrollRef.current && !searchQuery && visibleCategoriesCount < filteredCategories.length) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            // Load more when user scrolls to 80% of content
            if (scrollTop + clientHeight >= scrollHeight * 0.8) {
                if (!isLoadingMore) {
                    setIsLoadingMore(true);
                    // Small delay to prevent too many rapid loads
                    setTimeout(() => {
                        setVisibleCategoriesCount(prev => Math.min(prev + CATEGORIES_PER_LOAD, filteredCategories.length));
                        setIsLoadingMore(false);
                    }, 100);
                }
            }
        }
    }, [searchQuery, visibleCategoriesCount, filteredCategories.length, isLoadingMore]);

    // Set up intersection observer for lazy loading
    useEffect(() => {
        if (!scrollRef.current || searchQuery) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !isLoadingMore && visibleCategoriesCount < filteredCategories.length) {
                        setIsLoadingMore(true);
                        setTimeout(() => {
                            setVisibleCategoriesCount(prev => Math.min(prev + CATEGORIES_PER_LOAD, filteredCategories.length));
                            setIsLoadingMore(false);
                        }, 100);
                    }
                });
            },
            { rootMargin: '100px' }
        );

        // Observe the loading trigger element
        if (loadingRef.current) {
            observer.observe(loadingRef.current);
        }

        return () => observer.disconnect();
    }, [searchQuery, isLoadingMore, visibleCategoriesCount, filteredCategories.length]);

    const handleEmojiSelect = useCallback((emojiData) => {
        // Handle different emoji data formats
        const nativeEmoji = emojiData.native || (emojiData.skins && emojiData.skins[0]?.native);
        onEmojiSelect(nativeEmoji);
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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                if (onOpenChange) {
                    onOpenChange(false);
                } else {
                    setInternalIsOpen(false);
                }
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onOpenChange]);

    return (
        <div className="emoji-picker-container" ref={pickerRef}>
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

            {(isOpen || hasBeenOpened) && (
                <div className={`emoji-picker-popup ${isVisible ? 'visible' : ''} ${isInline ? 'inline' : ''}`}>
                    <div className="picker-header">
                        <div className="picker-tabs">
                            <button
                                className={`tab-btn ${activeTab === 'emoji' ? 'active' : ''}`}
                                onClick={() => setActiveTab('emoji')}
                            >
                                Emoji
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'gif' ? 'active' : ''}`}
                                onClick={() => setActiveTab('gif')}
                            >
                                GIF
                            </button>
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
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="picker-body">
                        {activeTab === 'emoji' && (
                            <>
                                {/* SEARCH BAR (Conditional) */}
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

                                {/* CATEGORY BAR */}
                                {!searchQuery && (
                                    <div className="emoji-category-bar">
                                        {filteredCategories.map(cat => (
                                            <button
                                                key={cat.id}
                                                className={`cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                                                onClick={() => scrollToCategory(cat.id)}
                                                title={cat.id}
                                            >
                                                {data.emojis[cat.emojis[0]]?.skins[0].native}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* EMOJI GRID - With lazy loading */}
                                <div className="emoji-scroll-area" ref={scrollRef} onScroll={handleScroll}>
                                    {searchQuery ? (
                                        <div className="emoji-grid">
                                            {filteredEmojis.map(emoji => (
                                                <EmojiItem
                                                    key={emoji.id}
                                                    emoji={emoji}
                                                    style={emojiStyle}
                                                    onSelect={handleEmojiSelect}
                                                />
                                            ))}
                                            {filteredEmojis.length === 0 && <div className="no-recent">No emojis found</div>}
                                        </div>
                                    ) : (
                                        <>
                                            {processedVisibleCategories.map(cat => (
                                                <div key={cat.id} id={`cat-${cat.id}`} className="category-section">
                                                    <div className="emoji-grid">
                                                        {cat.emojis.map(emoji => (
                                                            <EmojiItem
                                                                key={emoji.id}
                                                                emoji={emoji}
                                                                style={emojiStyle}
                                                                onSelect={handleEmojiSelect}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            {/* Loading trigger element */}
                                            {!searchQuery && visibleCategoriesCount < filteredCategories.length && (
                                                <div ref={loadingRef} className="emoji-loading-trigger">
                                                    {isLoadingMore && <div className="loading-spinner-small"></div>}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}

                        {activeTab === 'gif' && (
                            <KlipyGifPicker
                                onSelectGif={(gifUrl) => onEmojiSelect(gifUrl)}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Use memo to prevent re-rendering every emoji on every picker update
const EmojiItem = memo(({ emoji, style, onSelect }) => {
    const [hasError, setHasError] = useState(false);
    const assetPath = `/assets/emojis/${style}/${emoji.hex}.webp`;

    return (
        <div
            className="emoji-item"
            onClick={() => onSelect(emoji)}
            title={emoji.name}
        >
            {(!hasError && style !== 'native') ? (
                <img
                    src={assetPath}
                    alt={emoji.name}
                    loading="lazy"
                    onError={() => setHasError(true)}
                    className="emoji-img"
                />
            ) : (
                <span style={{ fontSize: '1em' }}>{emoji.native}</span>
            )}
        </div>
    );
});

export default EmojiPicker;
