// src/utils/timeUtils.js
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

export const isUserOnline = (isOnline, lastSeen) => {
  if (!isOnline) return false;

  if (!lastSeen) return true; // If no last_seen, assume online if flag says so

  // Handle PostgreSQL timestamp format like "2026-01-15 15:26:16.049+00"
  let dateStr = lastSeen;
  if (typeof lastSeen === 'string' && lastSeen.includes(' ') && !lastSeen.includes('T')) {
    dateStr = lastSeen.replace(' ', 'T');
    if (dateStr.endsWith('+00')) {
      dateStr += ':00';
    }
  }

  const date = new Date(dateStr);
  const now = new Date();
  const diffMinutes = (now.getTime() - date.getTime()) / (1000 * 60);

  // Consider offline if last seen more than 5 minutes ago, even if is_online is true
  // This handles cases where the user closed the app abruptly and database wasn't updated
  return diffMinutes <= 5;
};

export const formatLastSeen = (lastSeen) => {
  if (!lastSeen) {
    return 'last seen recently';
  }

  // Handle PostgreSQL timestamp format like "2026-01-15 15:26:16.049+00"
  let dateStr = lastSeen;
  if (typeof lastSeen === 'string' && lastSeen.includes(' ') && !lastSeen.includes('T')) {
    dateStr = lastSeen.replace(' ', 'T');
    if (dateStr.endsWith('+00')) {
      dateStr += ':00';
    }
  }

  const date = new Date(dateStr);
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
