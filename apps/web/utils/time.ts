const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export const formatRelativeTimestamp = (timestamp: number): string => {
  const delta = Date.now() - timestamp;
  if (delta < MINUTE) {
    return 'now';
  }
  if (delta < HOUR) {
    const minutes = Math.round(delta / MINUTE);
    return `${minutes}m`;
  }
  if (delta < DAY) {
    const hours = Math.round(delta / HOUR);
    return `${hours}h`;
  }
  if (delta < WEEK) {
    const days = Math.round(delta / DAY);
    return `${days}d`;
  }
  const weeks = Math.round(delta / WEEK);
  return `${weeks}w`;
};
