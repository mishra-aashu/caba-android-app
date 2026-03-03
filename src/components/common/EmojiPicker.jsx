import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

// Pre-process ALL categories once at module load — pure JS, instant, no network calls.
// This eliminates the "blank popup" flash caused by incremental lazy rendering.
const ALL_PROCESSED_CATEGORIES = data.categories
    .filter(c => c.id !== 'frequent')
    .map(cat => ({
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
    // STAGED RENDERING: Show container immediately, defer heavy grid render
    const [renderLevel, setRenderLevel] = useState(0);

    const { emojiStyle } = useEmojiStyle();

    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const pickerRef = useRef(null);
    const scrollRef = useRef(null);

    // Show/hide animation state
    useEffect(() => {
        if (isOpen) {
            setHasBeenOpened(true);
            setIsVisible(true);

            // Step 1: Render first few emojis quickly (1 frame delay)
            const timer1 = setTimeout(() => setRenderLevel(1), 16);
            // Step 2: Render the rest after animation starts (heavy lift)
            const timer2 = setTimeout(() => setRenderLevel(2), 100);

            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        } else {
            setIsVisible(false);
            // Reset render level when closed to ensure next open is also staged
            const timer = setTimeout(() => setRenderLevel(0), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

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

    const handleEmojiSelect = useCallback((emojiData) => {
        const nativeEmoji = emojiData.native || (emojiData.skins && emojiData.skins[0]?.native);
        onEmojiSelect(nativeEmoji);
        // Do NOT close the picker here — parent decides when to close.
        // This lets users pick multiple emojis without the popup disappearing.
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

    // Close ONLY on outside click — not on emoji click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                if (onOpenChange) {
                    onOpenChange(false);
                } else {
                    setInternalIsOpen(false);
                }
                onClose && onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onOpenChange, onClose]);

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

            <AnimatePresence>
                {(isOpen || hasBeenOpened) && (
                    <motion.div
                        className={`emoji-picker-popup ${isVisible ? 'visible' : ''} ${isInline ? 'inline' : ''}`}
                        initial={isInline ? false : { opacity: 0, scale: 0.9, y: 10 }}
                        animate={isVisible ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
                        exit={{ opacity: 0, scale: 0.8, y: 15 }}
                        transition={{
                            type: 'spring',
                            damping: 25,
                            stiffness: 300,
                            opacity: { duration: 0.15 }
                        }}
                    >
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
                                            {ALL_PROCESSED_CATEGORIES.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    className={`cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                                                    onClick={() => scrollToCategory(cat.id)}
                                                    title={cat.id}
                                                >
                                                    {cat.emojis[0]?.native}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* EMOJI GRID - All categories rendered upfront, no lazy loading */}
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
                                            <>
                                                {/* Render level 1: Just top categories for instant visual feedback */}
                                                {ALL_PROCESSED_CATEGORIES.slice(0, renderLevel === 1 ? 2 : (renderLevel === 2 ? 99 : 0)).map(cat => (
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

                                                {/* Show a skeleton/placeholder if still rendering (unlikely with 100ms) */}
                                                {renderLevel < 2 && (
                                                    <div className="emoji-loading-placeholder" style={{ height: '300px' }}></div>
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
                    </motion.div>
                )}
            </AnimatePresence>
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
