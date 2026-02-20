/**
 * Booking utility functions for session window checks
 */

import type { Booking } from '../../../src/lib/db';

/**
 * Check if a booking's session window is currently active
 */
export function isBookingWindowActive(booking: Booking, now: number = Date.now()): boolean {
  return (
    booking.status === 'scheduled' &&
    now >= booking.startTime &&
    now <= booking.endTime
  );
}

/**
 * Check if booking can be cancelled (more than 1 hour before start)
 */
export function canCancelBooking(booking: Booking, now: number = Date.now()): boolean {
  const oneHourBefore = booking.startTime - 60 * 60 * 1000;
  return booking.status === 'scheduled' && now < oneHourBefore;
}

/**
 * Get the next upcoming booking for a conversation
 */
export function getNextBooking(bookings: Booking[], now: number = Date.now()): Booking | null {
  return bookings
    .filter(b => b.status === 'scheduled' && b.startTime > now)
    .sort((a, b) => a.startTime - b.startTime)[0] || null;
}

/**
 * Get active booking for a conversation (if in session window)
 */
export function getActiveBooking(bookings: Booking[], now: number = Date.now()): Booking | null {
  return bookings.find(b => isBookingWindowActive(b, now)) || null;
}

/**
 * Format relative time until booking starts
 */
export function formatTimeUntilStart(startTime: number, now: number = Date.now()): string {
  const diff = startTime - now;
  
  if (diff < 0) return 'Started';
  
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
  
  return 'very soon';
}
