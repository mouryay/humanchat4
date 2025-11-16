const DEFAULT_TIMEZONE = 'UTC';

const baseFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

const timeFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit'
  });

const tzFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short'
  });

export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? DEFAULT_TIMEZONE;
  } catch (error) {
    console.warn('Unable to resolve timezone, defaulting to UTC', error);
    return DEFAULT_TIMEZONE;
  }
};

export const formatSlotDate = (isoDate: string, timeZone: string): string => {
  return baseFormatter(timeZone).format(new Date(isoDate));
};

export const formatSlotTimeRange = (startIso: string, endIso: string, timeZone: string): string => {
  const start = timeFormatter(timeZone).format(new Date(startIso));
  const end = timeFormatter(timeZone).format(new Date(endIso));
  return `${start} - ${end}`;
};

export const getTimezoneAbbreviation = (timeZone: string, isoDate?: string): string => {
  const parts = tzFormatter(timeZone).formatToParts(isoDate ? new Date(isoDate) : new Date());
  const tzPart = parts.find((part) => part.type === 'timeZoneName');
  return tzPart?.value ?? timeZone;
};

export const getSlotDurationMinutes = (startIso: string, endIso: string): number => {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
};
