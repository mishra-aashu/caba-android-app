import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import '../../styles/emoji-styles.css';

const baseUrl = import.meta.env.BASE_URL || '/';

/**
 * Utility to convert an emoji string (grapheme) to its standard hex code format.
 * Matches emoji-datasource naming convention (e.g., "0023", "1f602", "1f468-200d-1f4bb").
 */
const getEmojiHex = (emoji) => {
  const codePoints = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0).toString(16).toLowerCase();
    // Zero-pad to at least 4 chars for small values (required by standard naming)
    codePoints.push(cp.padStart(4, '0'));
  }
  return codePoints.join('-');
};

/**
 * SafeEmoji Component - Handles individual emoji rendering with state-based fallback.
 * Uses local assets: /assets/emojis/{vendor}/{hexcode}.webp
 */
const SafeEmoji = ({ emoji, hex, vendor, className = '', style = {} }) => {
  const [hasError, setHasError] = useState(false);
  const { emojiMap, mapLoading } = useEmojiStyle();
  
  if (mapLoading) return <span className={className} style={{ width: '1.2em', height: '1.2em', display: 'inline-block' }} />;

  // Get mapping for this hex code and vendor
  const mapping = emojiMap?.[vendor]?.[hex];

  // FALLBACK: If mapping not found, image fails, or vendor is native, show native unicode emoji
  if (hasError || vendor === 'native' || !mapping) {
    return (
      <span
        className={`native-emoji-fallback ${className}`}
        style={{ ...style, fontStyle: 'normal' }}
      >
        {emoji}
      </span>
    );
  }

  const spriteUrl = `${baseUrl}assets/emojis/spritesheets/${mapping.sheet}`;
  
  // Calculate percentage positions for a 16x16 grid
  // GRID_SIZE = 16. Formulas: (col / (N-1)) * 100, (row / (N-1)) * 100
  const col = mapping.x / 32;
  const row = mapping.y / 32;
  const posX = (col / 15) * 100;
  const posY = (row / 15) * 100;

  return (
    <span
      className={`custom-emoji-sprite ${className}`}
      title={emoji}
      role="img"
      aria-label={emoji}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        width: '1.2em',
        height: '1.2em',
        backgroundImage: `url(${spriteUrl})`,
        backgroundPosition: `${posX}% ${posY}%`,
        backgroundSize: '1600% 1600%',
        backgroundRepeat: 'no-repeat',
        ...style
      }}
    />
  );
};

/**
 * EmojiRenderer Component - Offline-first emoji renderer.
 * Splits text into segments and replaces emojis with high-quality WebP images.
 */
const EmojiRenderer = ({ text, className = '', style = {}, styleOverride = null }) => {
  const { emojiStyle: globalEmojiStyle } = useEmojiStyle();
  const activeStyle = styleOverride || globalEmojiStyle;

  // Use useMemo for segmenting text to avoid recalculating on every render
  const elements = useMemo(() => {
    if (!text) return null;

    // 1. Native Fallback Shortcut
    if (activeStyle === 'native') {
      return text;
    }

    try {
      // Use Intl.Segmenter (modern browser standard) for robust emoji splitting
      // Falls back to simple splitting if not available (though widely supported now)
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        const segments = Array.from(segmenter.segment(text));

        return segments.map((s, index) => {
          const { segment } = s;

          // Basic emoji test - most emojis are multi-codepoint or in high ranges
          // We check if it's an emoji using a regex that targets emoji ranges
          const isEmoji = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}/u.test(segment);

          if (isEmoji) {
            const hex = getEmojiHex(segment);
            return (
              <SafeEmoji
                key={index}
                emoji={segment}
                hex={hex}
                vendor={activeStyle}
                className={className}
                style={style}
              />
            );
          }

          return <span key={index}>{segment}</span>;
        });
      }
    } catch (e) {
      console.error('Emoji segmentation error:', e);
    }

    // Absolute fallback: return raw text
    return text;
  }, [text, activeStyle, className, style]);

  return (
    <span className={`emoji-renderer-root ${className}`} style={{ ...style, display: 'inline' }}>
      {elements}
    </span>
  );
};

export default EmojiRenderer;