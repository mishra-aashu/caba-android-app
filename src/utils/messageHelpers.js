/**
 * getStableMessageId - Generates a stable, unique ID for any message object.
 * 
 * Logic:
 * 1. Database ID (id) - best for persisted messages
 * 2. Temporary ID (tempId) - for optimistic messages
 * 3. Fallback Index (msg-index) - last resort for unkeyed items
 */
export const getStableMessageId = (message, index) => {
  if (!message) return `msg-fallback-${index}`;
  return message.id || message.tempId || `msg-${index}`;
};

/**
 * extractMessageContent - Safely extracts text content for copying
 */
export const extractMessageContent = (message) => {
  if (!message) return '';
  
  // Priority 1: Direct content
  if (message.content) return message.content;
  
  // Priority 2: Media caption (if exists)
  if (message.caption) return message.caption;
  
  // Priority 3: Type labels
  const type = message.mediaType || message.media_type || message.messageType || message.message_type;
  if (type === 'voice' || type === 'audio') return '[Voice Message]';
  if (type === 'image') return '[Image]';
  if (type === 'video') return '[Video]';
  if (type === 'game_invite') return '[Game Invite: Truth or Dare]';
  
  return '';
};
