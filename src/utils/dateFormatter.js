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
    return dayjs();
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
  const date = parseTimestamp(timestamp);

  // If from today, show time
  if (date.isToday()) {
    return date.format('h:mm A');
  }

  // If from yesterday, show "Yesterday"
  if (date.isYesterday()) {
    return 'Yesterday';
  }

  // If older than yesterday, show date in DD/MM/YYYY format
  return date.format('DD/MM/YYYY');
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

export default {
  formatBubbleTime,
  formatInboxTime,
  formatChatDivider,
};
