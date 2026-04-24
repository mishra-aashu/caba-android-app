/**
 * dateFormatter.js
 * 
 * Centralized date/time formatting utilities using dayjs.
 * Provides WhatsApp/Telegram-level professional timestamp formatting.
 * 
 * Plugins used:
 * - isToday: Check if a date is today
 * - isYesterday: Check if a date is yesterday
 * - calendar: For calendar-style formatting
 */

import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import calendar from 'dayjs/plugin/calendar';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with plugins
dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.extend(calendar);
dayjs.extend(relativeTime);

/**
 * Parse various timestamp formats into a dayjs object.
 * Handles PostgreSQL timestamps, ISO strings, Date objects, and numeric timestamps.
 * 
 * @param {string|Date|number|null|undefined} timestamp - The timestamp to parse
 * @returns {dayjs.Dayjs} A dayjs object (or current time if invalid/null)
 */
const parseTimestamp = (timestamp) => {
  // Handle null/undefined
  if (timestamp === null || timestamp === undefined) {
    return null;
  }

  // Handle Date objects
  if (timestamp instanceof Date) {
    return dayjs(timestamp);
  }

  // Handle numeric timestamps
  if (typeof timestamp === 'number') {
    return dayjs(timestamp);
  }

  // Handle string timestamps
  if (typeof timestamp === 'string') {
    // Handle PostgreSQL timestamp format: "2026-01-15 15:26:16.049+00"
    // Convert to ISO format for better parsing
    let normalizedTimestamp = timestamp;

    if (timestamp.includes(' ') && !timestamp.includes('T')) {
      // Convert "2026-01-15 15:26:16.049+00" to "2026-01-15T15:26:16.049+00"
      normalizedTimestamp = timestamp.replace(' ', 'T');
    }

    const parsed = dayjs(normalizedTimestamp);

    // If invalid, return current time
    if (!parsed.isValid()) {
      console.warn(`Invalid timestamp: ${timestamp}`);
      return dayjs();
    }

    return parsed;
  }

  // Fallback to current time
  return dayjs();
};

/**
 * formatBubbleTime
 * 
 * Formats timestamp for messages inside the chat bubble.
 * Returns strictly "h:mm A" format (e.g., "10:45 AM").
 * 
 * @param {string|Date|number|null|undefined} timestamp - The message timestamp
 * @returns {string} Formatted time string (e.g., "10:45 AM")
 */
export const formatBubbleTime = (timestamp) => {
  const date = parseTimestamp(timestamp);
  return date.format('h:mm A');
};

/**
 * formatTime
 *
 * General-purpose time formatter. Returns time in "h:mm A" format.
 * Alias for formatBubbleTime - previously exported from timeUtils.js.
 *
 * @param {string|Date|number|null|undefined} timestamp
 * @returns {string} Formatted time string (e.g., "10:45 AM")
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = parseTimestamp(timestamp);
    if (!date || !date.isValid()) return '';
    return date.format('h:mm A');
  } catch (error) {
    console.error('Error formatting time:', error);
    return '';
  }
};

/**
 * formatInboxTime
 * 
 * Formats timestamp for the main chat list/inbox.
 * - If message is from today: "h:mm A" (e.g., "10:45 AM")
 * - If from yesterday: "Yesterday"
 * - If older than yesterday: "DD/MM/YYYY" (e.g., "24/02/2026")
 * 
 * @param {string|Date|number|null|undefined} timestamp - The message timestamp
 * @returns {string} Formatted time string for inbox display
 */
export const formatInboxTime = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    const date = parseTimestamp(timestamp);
    if (!date || !date.isValid()) return '';

    const now = dayjs();
    
    // If from today, show time
    if (date.isSame(now, 'day')) {
      return date.format('h:mm A');
    }

    // If from yesterday, show "Yesterday"
    if (date.isSame(now.subtract(1, 'day'), 'day')) {
      return 'Yesterday';
    }

    // If older than yesterday, show date in DD/MM/YYYY format
    return date.format('DD/MM/YYYY');
  } catch (error) {
    console.error('Error formatting inbox time:', error);
    return '';
  }
};

/**
 * formatChatDivider
 * 
 * Formats timestamp for date dividers inside the chat screen.
 * - If message is from today: "Today"
 * - If from yesterday: "Yesterday"
 * - If older: "DD MMMM YYYY" (e.g., "24 February 2026")
 * 
 * @param {string|Date|number|null|undefined} timestamp - The message timestamp
 * @returns {string} Formatted date string for chat dividers
 */
export const formatChatDivider = (timestamp) => {
  const date = parseTimestamp(timestamp);

  // If from today, show "Today"
  if (date.isToday()) {
    return 'Today';
  }

  // If from yesterday, show "Yesterday"
  if (date.isYesterday()) {
    return 'Yesterday';
  }

  // If older, show full date: "DD MMMM YYYY"
  return date.format('DD MMMM YYYY');
};

/**
 * isUserOnline
 * 
 * Determines if a user should be considered "online" based on their
 * status flag and last seen timestamp.
 * 
 * @param {boolean} isOnline - The user's online status flag from DB
 * @param {string|Date|number} lastSeen - The user's last seen timestamp
 * @returns {boolean} True if the user is considered online
 */
export const isUserOnline = (isOnline, lastSeen) => {
  if (!lastSeen) return Boolean(isOnline);

  const date = parseTimestamp(lastSeen);
  if (!date) return Boolean(isOnline);

  const now = dayjs();
  const diffMinutes = now.diff(date, 'minute');

  // If DB says online, but last_seen is more than 5 minutes ago, treat as offline
  // This handles "ghost" online status where a user didn't sign out properly.
  if (isOnline) {
    return diffMinutes <= 5;
  }

  // If DB says offline, but last_seen is within 2 minutes, might be a brief disconnect
  return diffMinutes <= 2;
};

/**
 * formatLastSeen
 * 
 * Formats the "last seen" timestamp for display (e.g., "just now", "5 minutes ago").
 * 
 * @param {string|Date|number} lastSeen - The last seen timestamp
 * @returns {string} Formatted last seen string
 */
export const formatLastSeen = (lastSeen) => {
  if (!lastSeen) {
    return 'recently';
  }

  const date = parseTimestamp(lastSeen);
  const now = dayjs();
  const diffSeconds = now.diff(date, 'second');

  // Check if it was less than a minute ago
  if (diffSeconds < 60) {
    return 'just now';
  }

  // Use relative time for recent times (up to 2 hours)
  if (diffSeconds < 3600 * 2) {
    return date.from(now);
  }

  if (date.isToday()) {
    return `today at ${date.format('h:mm A')}`;
  }

  if (date.isYesterday()) {
    return `yesterday at ${date.format('h:mm A')}`;
  }

  // If it's been less than 7 days, show the day of the week
  const diffDays = now.diff(date, 'day');
  if (diffDays < 7) {
    return date.format('dddd');
  }

  return date.format('DD/MM/YYYY');
};

export default {
  formatBubbleTime,
  formatInboxTime,
  formatChatDivider,
  isUserOnline,
  formatLastSeen,
};
