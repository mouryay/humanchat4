/**
 * Booking API Service
 * Client-side service for booking operations
 */

import { Booking } from '@/src/lib/db';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface TimeSlot {
  start: string;
  end: string;
  isAvailable: boolean;
}

export interface WeeklyRule {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  timezone: string;
}

export interface GetAvailabilityResponse {
  success: boolean;
  data: {
    date: string;
    timezone: string;
    slots: TimeSlot[];
  };
}

export interface CreateBookingRequest {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  timezone: string;
  meetingNotes?: string;
  idempotencyKey?: string;
}

export interface BookingResponse {
  success: boolean;
  data: Booking & {
    requiresPayment?: boolean;
    paymentIntentClientSecret?: string;  // For Stripe Elements
  };
}

export interface BookingsListResponse {
  success: boolean;
  data: Booking[];
}

/**
 * Get available time slots for an expert
 */
export const getExpertAvailability = async (
  expertId: string,
  date: string,
  timezone: string
): Promise<TimeSlot[]> => {
  const response = await fetch(
    `${API_BASE}/api/experts/${expertId}/availability?date=${date}&timezone=${encodeURIComponent(timezone)}`,
    {
      credentials: 'include'
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch availability');
  }

  const result: GetAvailabilityResponse = await response.json();
  return result.data.slots;
};

/**
 * Create a booking
 */
export const createBooking = async (
  expertId: string,
  request: CreateBookingRequest
): Promise<Booking> => {
  const response = await fetch(`${API_BASE}/api/experts/${expertId}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create booking');
  }

  const result: BookingResponse = await response.json();
  return result.data;
};

/**
 * Get user's bookings
 */
export const getUserBookings = async (
  status?: 'upcoming' | 'past' | 'canceled'
): Promise<Booking[]> => {
  const url = status
    ? `${API_BASE}/api/users/me/bookings?status=${status}`
    : `${API_BASE}/api/users/me/bookings`;

  const response = await fetch(url, {
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch bookings');
  }

  const result: BookingsListResponse = await response.json();
  return result.data;
};

/**
 * Get a single booking by ID
 */
export const getBookingById = async (bookingId: string): Promise<Booking> => {
  const response = await fetch(`${API_BASE}/api/bookings/${bookingId}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch booking');
  }

  const result: BookingResponse = await response.json();
  return result.data;
};

/**
 * Get expert's bookings (where user is the expert)
 */
export const getExpertBookings = async (
  status?: 'upcoming' | 'past' | 'canceled'
): Promise<Booking[]> => {
  const url = status
    ? `${API_BASE}/api/experts/me/bookings?status=${status}`
    : `${API_BASE}/api/experts/me/bookings`;

  const response = await fetch(url, {
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch expert bookings');
  }

  const result: BookingsListResponse = await response.json();
  return result.data;
};

/**
 * Cancel a booking
 */
export const cancelBooking = async (
  bookingId: string,
  reason?: string
): Promise<Booking> => {
  const response = await fetch(`${API_BASE}/api/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ reason })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel booking');
  }

  const result: BookingResponse = await response.json();
  return result.data;
};

/**
 * Reschedule a booking
 */
export const rescheduleBooking = async (
  bookingId: string,
  newStartTime: string,
  newEndTime: string
): Promise<Booking> => {
  const response = await fetch(`${API_BASE}/api/bookings/${bookingId}/reschedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ newStartTime, newEndTime })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to reschedule booking');
  }

  const result: BookingResponse = await response.json();
  return result.data;
};

/**
 * Get expert's blocked dates in a date range
 */
export const getExpertBlockedDates = async (
  expertId: string,
  startDate: string,
  endDate: string
): Promise<string[]> => {
  const response = await fetch(
    `${API_BASE}/api/experts/${expertId}/blocked-dates?startDate=${startDate}&endDate=${endDate}`,
    {
      credentials: 'include'
    }
  );

  if (!response.ok) {
    // If endpoint doesn't exist yet, return empty array
    return [];
  }

  const result = await response.json();
  return result.data || [];
};

export const getExpertWeeklyAvailability = async (
  expertId: string
): Promise<WeeklyRule[]> => {
  const response = await fetch(`${API_BASE}/api/experts/${expertId}/weekly-availability`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch weekly availability');
  }

  const result = await response.json();
  return (result.data || []).map((rule: any) => ({
    id: rule.id,
    dayOfWeek: rule.dayOfWeek,
    startTime: rule.startTime,
    endTime: rule.endTime,
    slotDurationMinutes: rule.slotDurationMinutes ?? 30,
    timezone: rule.timezone
  }));
};

/**
 * Update booking meeting notes
 */
export const updateBookingNotes = async (
  bookingId: string,
  meetingNotes: string
): Promise<Booking> => {
  const response = await fetch(`${API_BASE}/api/bookings/${bookingId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ meetingNotes })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update booking notes');
  }

  const result: BookingResponse = await response.json();
  return result.data;
};
