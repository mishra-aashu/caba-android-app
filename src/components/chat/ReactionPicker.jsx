import React, { useRef, useLayoutEffect, useState } from 'react';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import EmojiRenderer from '../common/EmojiRenderer';
import styles from './ReactionPicker.module.css';

const ReactionPicker = ({ onSelect, onClose, position = { x: 0, y: 0 } }) => {
    const { preferredEmojis, emojiStyle } = useEmojiStyle();
    const pickerRef = useRef(null);
    const [adjustedPos, setAdjustedPos] = useState({ x: position.x, y: position.y });

    useLayoutEffect(() => {
        if (pickerRef.current) {
            const rect = pickerRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const margin = 10;

            let x = position.x;
            // The default CSS has translate(-50%, -100%) translateY(-10px)
            // But we'll handle positioning more explicitly here to ensure visibility
            let y = position.y - 10; // Offset from message bubble

            // Horizontal correction
            if (x - rect.width / 2 < margin) {
                x = rect.width / 2 + margin;
            } else if (x + rect.width / 2 > viewportWidth - margin) {
                x = viewportWidth - rect.width / 2 - margin;
            }

            // Vertical correction
            // If it goes above the top, move it below the message
            if (y - rect.height < margin) {
                // Assuming message bubble height is roughly 40-60px, 
                // we move it below the point where it was supposed to be above
                y = position.y + rect.height + 40;
            }

            setAdjustedPos({ x, y });
        }
    }, [position]);

    // Fallback if preferredEmojis not available
    const emojisToDisplay = preferredEmojis && preferredEmojis.length > 0
        ? preferredEmojis
        : ['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏'];

    return (
        <>
            <div className={styles['reaction-picker-overlay']} onClick={onClose} />
            <div
                ref={pickerRef}
                className={`${styles['reaction-picker-container']} ${styles['picker-fixed']}`}
                style={{
                    left: `${adjustedPos.x}px`,
                    top: `${adjustedPos.y}px`,
                    transform: 'translate(-50%, -100%)',
                }}
            >
                {emojisToDisplay.map((emoji) => (
                    <button
                        key={emoji}
                        className={styles['reaction-option-btn']}
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
