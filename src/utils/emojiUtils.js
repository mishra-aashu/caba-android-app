/**
 * Utility functions for emoji detection and handling
 */

/**
 * Checks if a string contains ONLY emojis (1-3 emojis) and zero text.
 * Uses Intl.Segmenter for proper grapheme cluster handling (supports emoji sequences).
 * 
 * @param {string} messageString - The message text to check
 * @returns {boolean} - True if the message is emoji-only (1-3 emojis), false otherwise
 */
export const isOnlyEmoji = (messageString) => {
  if (!messageString || typeof messageString !== 'string') {
    return false;
  }

  // Trim whitespace
  const trimmed = messageString.trim();
  
  if (!trimmed) {
    return false;
  }

  try {
    // Use Intl.Segmenter for robust emoji detection (handles emoji sequences properly)
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const segments = Array.from(segmenter.segment(trimmed));
      
      // Filter to get only emoji segments
      const emojiSegments = segments.filter(segment => {
        const { segment: text } = segment;
        // Check if the segment is an emoji using Unicode properties
        // \p{Emoji_Presentation} - emojis that have a default presentation
        // \p{Emoji}\uFE0F - emoji with variation selector
        // \p{Emoji_Modifier_Base} - base emojis that can be modified
        return /\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}/u.test(text);
      });

      // Check if:
      // 1. There are 1-3 emojis
      // 2. Total segments equal emoji segments (no non-emoji text)
      // 3. At least one emoji exists
      const isValidEmojiCount = emojiSegments.length >= 1 && emojiSegments.length <= 3;
      const isOnlyEmojis = emojiSegments.length === segments.length;
      
      return isValidEmojiCount && isOnlyEmojis;
    }
  } catch (e) {
    console.error('Error in isOnlyEmoji:', e);
  }

  // Fallback: Simple regex-based approach if Intl.Segmenter is not available
  // This is less accurate but provides a fallback
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}){1,3}$/u;
  return emojiRegex.test(trimmed);
};

/**
 * Gets the count of emojis in a message string
 * 
 * @param {string} messageString - The message text to analyze
 * @returns {number} - Number of emojis in the message
 */
export const getEmojiCount = (messageString) => {
  if (!messageString || typeof messageString !== 'string') {
    return 0;
  }

  const trimmed = messageString.trim();
  
  if (!trimmed) {
    return 0;
  }

  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const segments = Array.from(segmenter.segment(trimmed));
      
      return segments.filter(segment => {
        const { segment: text } = segment;
        return /\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}/u.test(text);
      }).length;
    }
  } catch (e) {
    console.error('Error in getEmojiCount:', e);
  }

  return 0;
};

export default isOnlyEmoji;
