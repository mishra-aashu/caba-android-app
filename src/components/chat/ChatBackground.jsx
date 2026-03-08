import React from 'react';
import styles from './ChatBackground.module.css';
const ChatBackground = ({
    children,
    active = true,
    showPattern = true,
    gradient,
    patternOpacity,
    patternSize
}) => {
    // Prop overrides (if provided, they take precedence over theme variables)
    const containerStyles = {
        ...(gradient && { '--chat-bg-gradient': gradient }),
        ...(patternOpacity && { '--chat-pattern-opacity': patternOpacity }),
        ...(patternSize && { '--chat-pattern-size': patternSize }),
    };

    return (
        <div className={styles['chat-background-container']} style={containerStyles}>
            {/* Layer 1: Linear Gradient or Image at the bottom (Controlled by CSS vars) */}
            {active && (
                <div className={styles['gradient-layer']} />
            )}

            {/* Layer 2: Repeating SVG Pattern on top with blend mode (Controlled by CSS vars) */}
            {active && showPattern && (
                <div className={styles['pattern-layer']} />
            )}

            {/* Layer 3: Actual Chat Content */}
            <div className={styles['content-layer']}>
                {children}
            </div>
        </div>
    );
};

export default ChatBackground;
