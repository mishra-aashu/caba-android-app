// src/utils/timeUtils.js
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

/**
 * Robustly parse PostgreSQL timestamp strings
 * @param {string|Date} timestamp - Postgres timestamp or Date object
 * @returns {Date} Parsed Date object
 */
const parseDbTimestamp = (timestamp) => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;

  // Handle PostgreSQL timestamp format like "2026-01-15 15:26:16.049+00"
  let dateStr = timestamp;
  if (typeof timestamp === 'string' && timestamp.includes(' ') && !timestamp.includes('T')) {
    dateStr = timestamp.replace(' ', 'T');
    // Ensure milliseconds and timezone are handled correctly if partially truncated
    if (dateStr.endsWith('+00') && !dateStr.includes('.')) {
      // If it ends in +00 but has no sub-seconds, add :00 for safari/older engines if needed
      // but usually T-format handles +00 fine. The previous logic added :00 which is odd for +00.
      // Let's stick to a cleaner conversion.
    }
  }
  return new Date(dateStr);
};

export const isUserOnline = (isOnline, lastSeen) => {
  if (!isOnline) return false;
  if (!lastSeen) return true;

  const date = parseDbTimestamp(lastSeen);
  const now = new Date();
  const diffMinutes = (now.getTime() - date.getTime()) / (1000 * 60);

  return diffMinutes <= 5;
};

export const formatLastSeen = (lastSeen) => {
  if (!lastSeen) {
    return 'last seen recently';
  }

  const date = parseDbTimestamp(lastSeen);
  const now = new Date();

  // Check if it was less than a minute ago
  const diffSeconds = (now.getTime() - date.getTime()) / 1000;
  if (diffSeconds < 60) {
    return 'last seen just now';
  }

  // Use formatDistanceToNow for recent times
  if (diffSeconds < 3600 * 2) { // up to 2 hours
    return `last seen ${formatDistanceToNow(date, { addSuffix: true })}`;
  }

  if (isToday(date)) {
    return `last seen today at ${format(date, 'p')}`;
  }

  if (isYesterday(date)) {
    return `last seen yesterday at ${format(date, 'p')}`;
  }

  // If it's been less than 7 days, show the day of the week
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
  if (diffDays < 7) {
    return `last seen on ${format(date, 'EEEE')}`;
  }

  return `last seen on ${format(date, 'PP')}`;
};

/**
 * Format timestamp for display (e.g., in chat list items)
 * @param {string|Date} timestamp - Timestamp to format
 * @returns {string} Formatted time string
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';

  const date = parseDbTimestamp(timestamp);
  const now = new Date();

  // Using date-fns for consistency
  if (isToday(date)) {
    return format(date, 'p'); // e.g., 3:45 PM
  }

  if (isYesterday(date)) {
    return 'Yesterday';
  }

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
  if (diffDays < 7) {
    return format(date, 'eeee'); // e.g., Monday
  }

  return format(date, 'P'); // e.g., 05/29/2023
};
