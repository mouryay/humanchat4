/**
 * Expert Availability API Service
 * Client-side service for expert availability management
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface AvailabilityRule {
  id?: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  slotDurationMinutes?: number;
  timezone: string;
}

export interface AvailabilityOverride {
  id: string;
  overrideDate: string; // YYYY-MM-DD
  overrideType: 'available' | 'blocked';
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  reason: string | null;
}

export interface AvailabilitySummary {
  hasWeeklySchedule: boolean;
  totalWeeklyHours: number;
  upcomingBlockedDates: string[];
  calendarConnected: boolean;
}

/**
 * Get expert's weekly availability
 */
export const getWeeklyAvailability = async (): Promise<AvailabilityRule[]> => {
  const response = await fetch(`${API_BASE}/api/experts/me/availability`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch availability');
  }

  const result = await response.json();
  
  // Transform snake_case to camelCase
  return result.data.rules.map((rule: any) => ({
    id: rule.id,
    dayOfWeek: rule.day_of_week ?? rule.dayOfWeek,
    startTime: rule.start_time ?? rule.startTime,
    endTime: rule.end_time ?? rule.endTime,
    slotDurationMinutes: rule.slot_duration_minutes ?? rule.slotDurationMinutes ?? 30,
    timezone: rule.timezone
  }));
};

/**
 * Set weekly availability (replaces all rules)
 */
export const setWeeklyAvailability = async (
  rules: AvailabilityRule[]
): Promise<AvailabilityRule[]> => {
  const response = await fetch(`${API_BASE}/api/experts/me/availability`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ rules })
  });

  if (!response.ok) {
    throw new Error('Failed to update availability');
  }

  const result = await response.json();
  return result.data;
};

/**
 * Get availability summary
 */
export const getAvailabilitySummary = async (): Promise<AvailabilitySummary> => {
  const response = await fetch(`${API_BASE}/api/experts/me/availability`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch summary');
  }

  const result = await response.json();
  return result.data.summary;
};

/**
 * Get Google Calendar auth URL
 */
export const getGoogleAuthUrl = async (): Promise<string> => {
  const response = await fetch(`${API_BASE}/api/experts/me/calendar/auth-url`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to get auth URL');
  }

  const result = await response.json();
  return result.data.authUrl;
};

/**
 * Disconnect Google Calendar
 */
export const disconnectCalendar = async (): Promise<void> => {
  const response = await fetch(`${API_BASE}/api/experts/me/calendar`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to disconnect calendar');
  }
};

/**
 * Block date range (vacation mode)
 */
export const blockDateRange = async (
  startDate: string,
  endDate: string,
  timezone: string,
  reason?: string
): Promise<void> => {
  const response = await fetch(`${API_BASE}/api/experts/me/availability/block-dates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ startDate, endDate, timezone, reason })
  });

  if (!response.ok) {
    throw new Error('Failed to block dates');
  }
};

/**
 * Get availability overrides (blocked dates with IDs)
 */
export const getAvailabilityOverrides = async (
  startDate: string,
  endDate: string
): Promise<AvailabilityOverride[]> => {
  const response = await fetch(
    `${API_BASE}/api/experts/me/availability/overrides?startDate=${startDate}&endDate=${endDate}`,
    {
      credentials: 'include'
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch overrides');
  }

  const result = await response.json();
  
  // Transform snake_case to camelCase
  return result.data.map((override: any) => ({
    id: override.id,
    overrideDate: override.override_date,
    overrideType: override.override_type,
    startTime: override.start_time,
    endTime: override.end_time,
    timezone: override.timezone,
    reason: override.reason
  }));
};

/**
 * Delete a specific availability override
 */
export const deleteAvailabilityOverride = async (overrideId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/api/experts/me/availability/overrides/${overrideId}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to delete override');
  }
};
