import React from 'react';
import styles from './ChatBackground.module.css';

/**
 * ChatBackground — 3-layer background system
 *
 * Layer stack (bottom → top):
 *   0  container       base colour (--chat-bg-base)
 *   1  gradient-layer  theme gradient OR wallpaper photo
 *   2  pattern-layer   repeating SVG tile (only when showPattern=true)
 *   3  content-layer   transparent wrapper for app UI
 *
 * CSS variables are set on :root by ChatThemeProvider.
 * This component has zero inline styles — everything comes through CSS vars
 * so there is no clash between CSS Modules and inline props.
 */
const ChatBackground = ({ children, showPattern }) => {
    return (
        <div className={styles['chat-background-container']}>
            {/* Layer 1: gradient / wallpaper */}
            <div className={styles['gradient-layer']} aria-hidden="true" />

            {/* Layer 2: SVG pattern tile — only mounted when relevant */}
            {showPattern && (
                <div className={styles['pattern-layer']} aria-hidden="true" />
            )}

            {/* Layer 3: transparent content shell */}
            <div className={styles['content-layer']}>
                {children}
            </div>
        </div>
    );
};

export default React.memo(ChatBackground);