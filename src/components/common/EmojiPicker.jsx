import React, { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';
import './EmojiPicker.css';

const EmojiPicker = ({ onEmojiSelect, buttonClassName = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef(null);

    const emojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
        '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
        '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
        '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
        '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
        '🤧', '🥵', '🥶', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐',
        '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦',
        '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
        '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
        '👆', '👇', '☝️', '👋', '🤚', '🖐', '✋', '🖖', '👏', '🙌',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
        '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🔥', '✨',
        '⭐', '🌟', '💫', '💥', '💢', '💦', '💨', '🕊️', '🦋', '🌸',
        '💐', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🎉', '🎊', '🎈'
    ];

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

    const handleEmojiClick = (emoji) => {
        onEmojiSelect(emoji);
        setIsOpen(false);
    };

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
                    <div className="emoji-picker-header">
                        <span>Emojis</span>
                    </div>
                    <div className="emoji-grid">
                        {emojis.map((emoji, index) => (
                            <button
                                key={index}
                                type="button"
                                className="emoji-item"
                                onClick={() => handleEmojiClick(emoji)}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmojiPicker;
