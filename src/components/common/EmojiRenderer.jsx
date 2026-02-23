import React, { useState } from 'react';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import { Twemoji } from 'react-emoji-render';
import '../../styles/emoji-styles.css';

// Central configuration for emoji styles
const STYLE_CONFIG = {
  twitter: {
    baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
    ext: '.png',
    isUppercase: false // Twemoji filenames are lowercase
  },
  apple: {
    // Stability: Using specific versioned unpkg path for emoji-datasource-apple
    baseUrl: 'https://unpkg.com/emoji-datasource-apple@14.0.0/img/apple/64/',
    ext: '.png',
    isUppercase: true // emoji-datasource filenames are UPPERCASE
  },
  google: {
    baseUrl: 'https://unpkg.com/emoji-datasource-google@14.0.0/img/google/64/',
    ext: '.png',
    isUppercase: true // emoji-datasource filenames are UPPERCASE
  }
};

/**
 * SafeEmoji Component - Handles individual emoji rendering with state-based fallback.
 */
const SafeEmoji = ({ src, token }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <span className="native-emoji-fallback">{token}</span>;
  }

  return (
    <img
      src={src}
      alt={token}
      className="custom-emoji-img"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
};

/**
 * EmojiRenderer Component - Bulletproof Implementation
 * 
 * Handles custom emoji styles with:
 * 1. Strict CDN token mapping (casing/sanitization)
 * 2. Automatic fail-safe fallback to native OS emoji on 404 using state
 */
const EmojiRenderer = ({ text, className = '', style = {}, styleOverride = null }) => {
  const { emojiStyle: globalEmojiStyle } = useEmojiStyle();
  const activeStyle = styleOverride || globalEmojiStyle;

  // 1. Native Fallback
  if (activeStyle === 'native' || !STYLE_CONFIG[activeStyle]) {
    return <span className={className} style={style}>{text}</span>;
  }

  const config = STYLE_CONFIG[activeStyle];

  return (
    <Twemoji
      text={text}
      options={{
        callback: (token) => {
          // Sanitization: Remove variation selectors (standard in emoji-datasource filenames)
          let cleanToken = token.replace(/-fe0f/g, '');
          cleanToken = config.isUppercase ? cleanToken.toUpperCase() : cleanToken.toLowerCase();
          return `${config.baseUrl}${cleanToken}${config.ext}`;
        }
      }}
      svg={false} // Force PNGs
      className={`custom-emoji-renderer ${className}`}
      style={style}
      // Fail-safe logic: If the image fails to load, we revert to native text
      renderFullText={(fullText) => <span>{fullText}</span>}
      renderEmoji={(props) => {
        const { src, token, key } = props;
        return (
          <span key={key} className="emoji-container">
            <SafeEmoji src={src} token={token} />
          </span>
        );
      }}
    />
  );
};

export default EmojiRenderer;