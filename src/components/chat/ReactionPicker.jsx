import React from 'react';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import EmojiRenderer from '../common/EmojiRenderer';
import './ReactionPicker.css';

const ReactionPicker = ({ onSelect, onClose, position }) => {
    const { preferredEmojis, emojiStyle } = useEmojiStyle();

    // Fallback if preferredEmojis not available
    const emojisToDisplay = preferredEmojis && preferredEmojis.length > 0
        ? preferredEmojis
        : ['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏'];

    return (
        <>
            <div className="reaction-picker-overlay" onClick={onClose} />
            <div
                className="reaction-picker-container"
                style={{
                    position: 'fixed',
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    transform: 'translate(-50%, -100%) translateY(-10px)'
                }}
            >
                {emojisToDisplay.map((emoji) => (
                    <button
                        key={emoji}
                        className="reaction-option-btn"
                        onClick={() => {
                            onSelect(emoji);
                            onClose();
                        }}
                        title={`React with ${emoji}`}
                    >
                        <EmojiRenderer
                            text={emoji}
                            styleOverride={emojiStyle}
                            className={emojiStyle === 'native' ? 'native-emoji' : 'custom-emoji-img'}
                        />
                    </button>
                ))}
            </div>
        </>
    );
};

export default ReactionPicker;
