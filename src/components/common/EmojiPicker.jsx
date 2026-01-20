import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Smile } from 'lucide-react';
import { init } from 'emoji-mart';
import data from '@emoji-mart/data';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
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
                    {/* CLOSE BUTTON */}
                    {showCloseButton && (
                        <button
                            className="picker-close-btn"
                            onClick={() => {
                                setIsOpen(false);
                                onClose && onClose();
                            }}
                            title="Close"
                        >
                            ✕
                        </button>
                    )}

                    {/* Emoji Mart Picker */}
                    <Suspense fallback={<div className="emoji-loading">Loading emojis...</div>}>
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
                            perLine={8}
                            defaultSkinTone="neutral"
                            categories={['frequent', 'smileys', 'people', 'animals', 'food', 'activity', 'travel', 'objects', 'symbols']}
                        />
                    </Suspense>
                </div>
            )}
        </div>
    );
};

export default EmojiPicker;
