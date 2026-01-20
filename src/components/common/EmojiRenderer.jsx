import React from 'react';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';

// Helper function to convert emoji to hex code for CDN URLs
const toHex = (emoji) => {
  return emoji.codePointAt(0).toString(16);
};

// Emoji Renderer Component - Uses native emojis for best performance
const EmojiRenderer = ({ text, className = '', style = {} }) => {
  // For now, using native emojis for best performance and compatibility
  // This ensures emojis always work and load fast
  return (
    <span className={className} style={style}>
      {text}
    </span>
  );
};

// Hook for programmatic emoji rendering
export const useEmojiRenderer = () => {
  const { emojiStyle } = useEmojiStyle();

  const renderEmoji = (emoji) => {
    if (emojiStyle === 'native') {
      return emoji;
    }

    const hex = toHex(emoji);
    const imageUrl = emojiStyle === 'twitter'
      ? `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${hex}.png`
      : `https://fonts.gstatic.com/s/e/notoemoji/latest/${hex}/512.png`;

    return (
      <img
        src={imageUrl}
        alt={emoji}
        className="emoji-image"
        style={{
          height: '1em',
          width: '1em',
          verticalAlign: 'middle',
          display: 'inline-block'
        }}
        onError={(e) => {
          // Fallback to native emoji
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'inline';
        }}
      />
    );
  };

  const renderText = (text) => {
    return <EmojiRenderer text={text} />;
  };

  return { renderEmoji, renderText, emojiStyle };
};

export default EmojiRenderer;