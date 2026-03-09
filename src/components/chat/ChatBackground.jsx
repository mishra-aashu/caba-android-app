import React from 'react';
import styles from './ChatBackground.module.css';

// ✅ FIX: Removed unused `patternSvg` import — it was imported but never referenced.
//         Pattern rendering is handled entirely via CSS variables set by ChatThemeProvider.

const ChatBackground = ({
  children,
  active = true,
  showPattern = true,
  // Manual override props — only used when parent explicitly passes them.
  // Leave undefined to let CSS variables from ChatThemeProvider drive everything.
  gradient,
  wallpaperUrl,
  patternUrl,
  patternOpacity,
  patternSize,
}) => {
  // Only inject inline styles when props are EXPLICITLY provided.
  // Undefined props are skipped so the CSS variables remain in control.
  const containerStyles = {
    ...(gradient      && { '--chat-bg-gradient':      gradient }),
    ...(wallpaperUrl  && { '--chat-bg-image':         `url("${wallpaperUrl}")` }),
    ...(patternUrl    && { '--pattern-url':           `url("${patternUrl}")` }),
    ...(patternOpacity !== undefined && { '--chat-pattern-opacity': patternOpacity }),
    ...(patternSize   && { '--chat-pattern-size':     patternSize }),
  };

  return (
    <div
      className={[
        styles['chat-background-container'],
        showPattern ? styles['has-pattern'] : '',
      ].filter(Boolean).join(' ')}
      style={Object.keys(containerStyles).length > 0 ? containerStyles : undefined}
    >
      {/* Layer 1: Gradient / wallpaper image */}
      {active && <div className={styles['gradient-layer']} />}

      {/* Layer 2: SVG pattern overlay */}
      {active && showPattern && <div className={styles['pattern-layer']} />}

      {/* Layer 3: Chat content — transparent so layers below show through */}
      <div className={styles['content-layer']}>
        {children}
      </div>
    </div>
  );
};

export default ChatBackground;