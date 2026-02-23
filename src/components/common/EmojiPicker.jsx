import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { Smile, Search, X } from 'lucide-react';
import data from '@emoji-mart/data';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import KlipyGifPicker from '../chat/GifPicker.jsx';
import './EmojiPicker.css';

/**
 * Utility to convert emoji-mart unified hex (e.g. "1F602") to our lowercase hyphenated format.
 * Includes zero-padding to 4 digits for consistency with assets.
 */
const formatHex = (unified) => {
    return unified.split('-').map(part => part.toLowerCase().padStart(4, '0')).join('-');
};

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
    const [hasBeenOpened, setHasBeenOpened] = useState(false); // Track if picker has ever been opened
    const { emojiStyle } = useEmojiStyle();

    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const pickerRef = useRef(null);
    const scrollRef = useRef(null);

    // Pre-calculate categories with hex codes to avoid logic during render
    const processedCategories = useMemo(() => {
        return data.categories.map(cat => ({
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
        }));
    }, []);

    // Filtered emojis based on search (also pre-processed)
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

    useEffect(() => {
        if (isOpen) {
            setHasBeenOpened(true);
            // DIRECT TOGGLE: No more 10ms timeout which caused "visible delay"
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    const handleEmojiSelect = useCallback((emojiData) => {
        // We pass the native unicode character back, which our renderer then converts
        onEmojiSelect(emojiData.skins[0].native);
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
                                        {data.categories.filter(c => c.id !== 'frequent').map(cat => (
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

                                {/* EMOJI GRID */}
                                <div className="emoji-scroll-area" ref={scrollRef}>
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
                                        processedCategories.map(cat => (
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
                                        ))
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
    // hex is now pre-provided, zero logic here
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
