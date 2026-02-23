import React, { useState } from 'react';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import { toArray } from 'react-emoji-render';
import '../../styles/emoji-styles.css';

// Central configuration for emoji styles
const STYLE_CONFIG = {
  twitter: {
    baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
    ext: '.png',
    isUppercase: false
  },
  apple: {
    baseUrl: 'https://unpkg.com/emoji-datasource-apple@14.0.0/img/apple/64/',
    ext: '.png',
    isUppercase: true
  },
  google: {
    baseUrl: 'https://unpkg.com/emoji-datasource-google@14.0.0/img/google/64/',
    ext: '.png',
    isUppercase: true
  }
};

/**
 * SafeEmoji Component - Handles individual emoji rendering with state-based fallback.
 */
const SafeEmoji = ({ src, token, className = '', style = {} }) => {
  const [hasError, setHasError] = useState(false);

  // GUARANTEED FALLBACK: If image fails, show native unicode emoji
  if (hasError) {
    return <span className={`native-emoji-fallback ${className}`} style={style}>{token}</span>;
  }

  return (
    <img
      src={src}
      alt={token}
      className={`custom-emoji-img ${className}`}
      style={style}
      loading="lazy"
      onError={() => {
        console.warn(`Emoji load failed: ${src}`);
        setHasError(true);
      }}
    />
  );
};

/**
 * EmojiRenderer Component - The "Principal Engineer" Revert
 * 
 * Instead of fragile manual hex math, we leverage react-emoji-render's 
 * internal parser by providing a dummy ID and then intercepting the generated output.
 */
const EmojiRenderer = ({ text, className = '', style = {}, styleOverride = null }) => {
  const { emojiStyle: globalEmojiStyle } = useEmojiStyle();
  const activeStyle = styleOverride || globalEmojiStyle;

  // 1. Native Fallback
  if (activeStyle === 'native' || !STYLE_CONFIG[activeStyle]) {
    return <span className={className} style={style}>{text}</span>;
  }

  const config = STYLE_CONFIG[activeStyle];

  // 2. LEVERAGE LIBRARY MATH
  // We use a dummy ID to force toArray() to generate codepoints for us.
  const ID = "LIB_PARSER_";
  const emojiArray = toArray(text, {
    baseUrl: ID,
    ext: config.ext,
    protocol: 'https'
  });

  return (
    <span className={`emoji-renderer-root ${className}`} style={style} renderfulltext="true" renderemoji="true">
      {emojiArray.map((part, index) => {
        // toArray returns React elements (img) for emojis when baseUrl is provided
        if (React.isValidElement(part) && part.type === 'img') {
          const { src, alt } = part.props;

          // lib generates: "https:LIB_PARSER_/{hex}.{ext}"
          // We extract the hex token and apply our own casing/FE0F rules.
          const hex = src.split('/').pop().split('.')[0];

          // Clean up the hex (remove variation selectors common in filenames)
          let cleanHex = hex.replace(/fe0f/gi, '').replace(/-$/, '');
          cleanHex = cleanHex.split('-').filter(Boolean).join('-');

          const finalToken = config.isUppercase ? cleanHex.toUpperCase() : cleanHex.toLowerCase();
          const finalSrc = `${config.baseUrl}${finalToken}${config.ext}`;

          return <SafeEmoji key={index} src={finalSrc} token={alt} />;
        }

        // Return plain text parts or children of non-img elements
        return <span key={index}>{typeof part === 'string' ? part : part.props.children}</span>;
      })}
    </span>
  );
};

export default EmojiRenderer;