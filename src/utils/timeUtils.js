// src/utils/timeUtils.js
// Now using dayjs for all date formatting - see dateFormatter.js for new utilities
// Keeping this file for backward compatibility - re-exports from dateFormatter

import { formatInboxTime, formatBubbleTime } from './dateFormatter';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';

// Extend with plugins
dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);

/**
 * Robustly parse timestamp to dayjs object
 * @param {string|Date} timestamp - Postgres timestamp or Date object
 * @returns {dayjs.Dayjs} Parsed dayjs object
 */
const parseDbTimestamp = (timestamp) => {
  if (!timestamp) return dayjs();
  if (timestamp instanceof Date) return dayjs(timestamp);
  
  // Handle PostgreSQL timestamp format like "2026-01-15 15:26:16.049+00"
  let dateStr = timestamp;
  if (typeof timestamp === 'string' && timestamp.includes(' ') && !timestamp.includes('T')) {
    dateStr = timestamp.replace(' ', 'T');
  }
  return dayjs(dateStr);
};

export const isUserOnline = (isOnline, lastSeen) => {
  if (!isOnline) return false;
  if (!lastSeen) return true;

  const date = parseDbTimestamp(lastSeen);
  const now = dayjs();
  const diffMinutes = now.diff(date, 'minute');

  return diffMinutes <= 5;
};

export const formatLastSeen = (lastSeen) => {
  if (!lastSeen) {
    return 'recently';
  }

  const date = parseDbTimestamp(lastSeen);
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

  return date.format('PP');
};

/**
 * Format timestamp for display (e.g., in chat list items)
 * Now uses dayjs via dateFormatter.js
 * @param {string|Date} timestamp - Timestamp to format
 * @returns {string} Formatted time string
 */
export const formatTime = (timestamp) => {
  return formatInboxTime(timestamp);
};
