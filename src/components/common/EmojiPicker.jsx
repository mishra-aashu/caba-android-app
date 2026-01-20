import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Smile } from 'lucide-react';
import { init } from 'emoji-mart';
import data from '@emoji-mart/data';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import KlipyGifPicker from '../chat/GifPicker.jsx';
import './EmojiPicker.css';

// Lazy load emoji-mart Picker to avoid SSR issues
const Picker = lazy(() =>
  import('@emoji-mart/react').then(module => ({ default: module.default }))
);

// Initialize emoji-mart data
init({ data });

const EmojiPicker = ({
    onEmojiSelect,
    onClose,
    buttonClassName = '',
    showCloseButton = true,
    isOpen: controlledIsOpen,
    onOpenChange,
    showHeader = true,
    showArrow = false
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('emoji');
    const { emojiStyle } = useEmojiStyle();

    // Use controlled or internal state
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const setIsOpen = onOpenChange || setInternalIsOpen;
    const pickerRef = useRef(null);

    // Handle emoji selection - don't close automatically to allow multiple selections
    const handleEmojiSelect = (emoji) => {
        onEmojiSelect(emoji.native);
        // Note: Not closing automatically to allow multiple selections
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="emoji-picker-container" ref={pickerRef}>
            <button
                type="button"
                className={`emoji-picker-btn ${buttonClassName}`}
                onClick={() => setIsOpen(!isOpen)}
                title="Add emoji"
            >
                <Smile size={20} />
            </button>

            {isOpen && (
                <div className="emoji-picker-popup">
                    {/* HEADER WITH TABS AND CLOSE */}
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
                        {showCloseButton && (
                            <button
                                className="header-close-btn"
                                onClick={() => {
                                    setIsOpen(false);
                                    onClose && onClose();
                                }}
                                title="Close"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* CONTENT BASED ON TAB */}
                    <div className="picker-body">
                        {activeTab === 'emoji' && (
                            <Suspense fallback={<div className="emoji-loading">Loading emojis...</div>}>
                                <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                                    <Picker
                                        data={data}
                                        theme="dark"
                                        set="native"  // Use native emojis by default for best performance and compatibility
                                        onEmojiSelect={handleEmojiSelect}
                                        previewPosition="none"
                                        skinTonePosition="none"
                                        emojiSize={24}
                                        emojiButtonSize={32}
                                        maxFrequentRows={1}
                                        perLine={13}
                                        defaultSkinTone="neutral"
                                        categories={['frequent', 'smileys', 'people', 'animals', 'food', 'activity', 'travel', 'objects', 'symbols']}
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                </div>
                            </Suspense>
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

export default EmojiPicker;
