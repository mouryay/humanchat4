/**
 * Booking State Machine Service
 * 
 * Manages booking lifecycle with state machine pattern for payment integration.
 * Handles slot locking, booking creation, confirmation, and cancellation.
 */

import { query, getPool } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import { logger } from '../utils/logger.js';
import { publishEvent } from '../utils/redis.js';
import type { PoolClient } from 'pg';

// ============================================================================
// Types
// ============================================================================

export type BookingStatus =
  | 'available'
  | 'held'
  | 'awaiting_payment'
  | 'confirmed'
  | 'canceled'
  | 'completed'
  | 'no_show'
  | 'failed'
  | 'expired';

export interface BookingRecord {
  id: string;
  requester_id: string;
  responder_id: string;
  slot_id: string | null;
  session_id: string | null;
  scheduled_start: Date;
  scheduled_end: Date;
  duration_minutes: number;
  timezone: string;
  price_cents: number;
  currency: string;
  platform_fee_cents: number;
  responder_payout_cents: number;
  status: BookingStatus;
  canceled_at: Date | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  held_until: Date | null;
  hold_token: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BookingSlotRecord {
  id: string;
  responder_id: string;
  availability_id: string | null;
  start_time: Date;
  end_time: Date;
  timezone: string;
  duration_minutes: number;
  status: BookingStatus;
  held_until: Date | null;
  price_cents: number;
  is_free: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateHoldParams {
  requesterId: string;
  responderId: string;
  slotId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  durationMinutes: number;
  timezone: string;
  priceCents: number;
  currency?: string;
  holdToken: string; // Idempotency key
  notes?: string;
}

export interface ConfirmBookingParams {
  bookingId: string;
  paymentIntentId?: string;
  sessionId?: string;
}

export interface CancelBookingParams {
  bookingId: string;
  canceledBy: string;
  reason?: string;
}

// ============================================================================
// State Machine Configuration
// ============================================================================

const BOOKING_STATE_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  available: ['held'],
  held: ['awaiting_payment', 'confirmed', 'expired', 'failed'],
  awaiting_payment: ['confirmed', 'failed', 'expired'],
  confirmed: ['canceled', 'completed', 'no_show'],
  canceled: [], // Terminal state
  completed: [], // Terminal state
  no_show: [], // Terminal state
  failed: [], // Terminal state
  expired: [], // Terminal state
};

const HOLD_TTL_MINUTES = 15; // Time to complete payment

/**
 * Validate state transition
 */
function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Transition booking to new state
 */
async function transitionBookingState(
  bookingId: string,
  newStatus: BookingStatus,
  client?: PoolClient
): Promise<void> {
  const executor = client || query;

  // Get current status
  const result = await (client
    ? client.query<{ status: BookingStatus }>('SELECT status FROM bookings WHERE id = $1', [bookingId])
    : query<{ status: BookingStatus }>('SELECT status FROM bookings WHERE id = $1', [bookingId]));

  if (result.rows.length === 0) {
    throw new ApiError(404, 'Booking not found');
  }

  const currentStatus = result.rows[0].status;

  // Validate transition
  if (!canTransition(currentStatus, newStatus)) {
    throw new ApiError(
      400,
      `Invalid state transition from ${currentStatus} to ${newStatus}`
    );
  }

  // Update status
  if (client) {
    await client.query('UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, bookingId]);
  } else {
    await query('UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, bookingId]);
  }

  logger.info('Booking state transitioned', {
    bookingId,
    from: currentStatus,
    to: newStatus,
  });
}

// ============================================================================
// Slot Management
// ============================================================================

/**
 * Get available slots for a responder
 */
export async function getAvailableSlots(
  responderId: string,
  startDate: Date,
  endDate: Date
): Promise<BookingSlotRecord[]> {
  const result = await query<BookingSlotRecord>(
    `SELECT * FROM booking_slots
     WHERE responder_id = $1
       AND status = 'available'
       AND start_time >= $2
       AND start_time < $3
     ORDER BY start_time ASC`,
    [responderId, startDate, endDate]
  );

  return result.rows;
}

/**
 * Lock a slot temporarily (with TTL)
 */
async function lockSlot(slotId: string, holdMinutes: number, client: PoolClient): Promise<void> {
  const heldUntil = new Date(Date.now() + holdMinutes * 60 * 1000);

  const result = await client.query(
    `UPDATE booking_slots
     SET status = 'held', held_until = $1, updated_at = NOW()
     WHERE id = $2 AND status = 'available'
     RETURNING id`,
    [heldUntil, slotId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(409, 'Slot is no longer available');
  }
}

/**
 * Release a slot (make it available again)
 */
async function releaseSlot(slotId: string, client?: PoolClient): Promise<void> {
  if (client) {
    await client.query(
      `UPDATE booking_slots
       SET status = 'available', held_until = NULL, updated_at = NOW()
       WHERE id = $1`,
      [slotId]
    );
  } else {
    await query(
      `UPDATE booking_slots
       SET status = 'available', held_until = NULL, updated_at = NOW()
       WHERE id = $1`,
      [slotId]
    );
  }

  logger.info('Slot released', { slotId });
}

/**
 * Confirm a slot booking
 */
async function confirmSlot(slotId: string, client: PoolClient): Promise<void> {
  await client.query(
    `UPDATE booking_slots
     SET status = 'confirmed', held_until = NULL, updated_at = NOW()
     WHERE id = $1`,
    [slotId]
  );
}

// ============================================================================
// Booking Operations
// ============================================================================

/**
 * Create a booking hold (Step 1: Reserve slot)
 */
export async function createBookingHold(params: CreateHoldParams): Promise<BookingRecord> {
  const {
    requesterId,
    responderId,
    slotId,
    scheduledStart,
    scheduledEnd,
    durationMinutes,
    timezone,
    priceCents,
    currency = 'USD',
    holdToken,
    notes,
  } = params;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check for existing hold with same token (idempotency)
    const existingResult = await client.query<BookingRecord>(
      'SELECT * FROM bookings WHERE hold_token = $1',
      [holdToken]
    );

    if (existingResult.rows.length > 0) {
      await client.query('COMMIT');
      return existingResult.rows[0];
    }

    // Lock the slot
    await lockSlot(slotId, HOLD_TTL_MINUTES, client);

    // Create booking in 'held' state
    const heldUntil = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);

    const result = await client.query<BookingRecord>(
      `INSERT INTO bookings (
        requester_id, responder_id, expert_id, user_id,
        slot_id, scheduled_start, scheduled_end,
        duration_minutes, timezone, price_cents, currency, status, held_until,
        hold_token, notes
      ) VALUES ($1, $2, $2, $1, $3, $4, $5, $6, $7, $8, $9, 'held', $10, $11, $12)
      RETURNING *`,
      [
        requesterId,
        responderId,
        slotId,
        scheduledStart,
        scheduledEnd,
        durationMinutes,
        timezone,
        priceCents,
        currency,
        heldUntil,
        holdToken,
        notes,
      ]
    );

    await client.query('COMMIT');

    const booking = result.rows[0];

    // Publish WebSocket event
    await publishEvent('booking:held', {
      bookingId: booking.id,
      slotId,
      responderId,
      requesterId,
      heldUntil,
    });

    logger.info('Booking hold created', {
      bookingId: booking.id,
      requesterId,
      responderId,
      priceCents,
    });

    return booking;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to create booking hold', { error, params });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Transition booking to awaiting payment
 */
export async function markBookingAwaitingPayment(
  bookingId: string,
  paymentIntentId: string
): Promise<void> {
  await transitionBookingState(bookingId, 'awaiting_payment');

  // Extend hold time for payment completion
  const extendedHeldUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await query(
    'UPDATE bookings SET held_until = $1, updated_at = NOW() WHERE id = $2',
    [extendedHeldUntil, bookingId]
  );

  await publishEvent('booking:awaiting_payment', {
    bookingId,
    paymentIntentId,
  });

  logger.info('Booking awaiting payment', { bookingId, paymentIntentId });
}

/**
 * Confirm a booking (payment succeeded)
 */
export async function confirmBooking(params: ConfirmBookingParams): Promise<BookingRecord> {
  const { bookingId, paymentIntentId, sessionId } = params;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get booking details
    const bookingResult = await client.query<BookingRecord>(
      'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new ApiError(404, 'Booking not found');
    }

    const booking = bookingResult.rows[0];

    // Transition to confirmed
    await transitionBookingState(bookingId, 'confirmed', client);

    // Update booking
    await client.query(
      `UPDATE bookings
       SET held_until = NULL, session_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [sessionId, bookingId]
    );

    // Confirm slot
    if (booking.slot_id) {
      await confirmSlot(booking.slot_id, client);
    }

    await client.query('COMMIT');

    // Publish WebSocket event
    await publishEvent('booking:confirmed', {
      bookingId,
      requesterId: booking.requester_id,
      responderId: booking.responder_id,
      sessionId,
      scheduledStart: booking.scheduled_start,
    });

    logger.info('Booking confirmed', {
      bookingId,
      paymentIntentId,
      sessionId,
    });

    // Fetch updated booking
    const updatedResult = await query<BookingRecord>('SELECT * FROM bookings WHERE id = $1', [bookingId]);
    return updatedResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to confirm booking', { error, bookingId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cancel a booking
 */
export async function cancelBooking(params: CancelBookingParams): Promise<BookingRecord> {
  const { bookingId, canceledBy, reason } = params;

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get booking details
    const bookingResult = await client.query<BookingRecord>(
      'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new ApiError(404, 'Booking not found');
    }

    const booking = bookingResult.rows[0];

    // Check if can be canceled
    if (!['confirmed', 'awaiting_payment', 'held'].includes(booking.status)) {
      throw new ApiError(400, `Cannot cancel booking with status: ${booking.status}`);
    }

    // Transition to canceled
    await transitionBookingState(bookingId, 'canceled', client);

    // Update booking
    await client.query(
      `UPDATE bookings
       SET canceled_at = NOW(), cancelled_by = $1, cancellation_reason = $2, updated_at = NOW()
       WHERE id = $3`,
      [canceledBy, reason, bookingId]
    );

    // Release slot if held
    if (booking.slot_id && booking.status !== 'confirmed') {
      await releaseSlot(booking.slot_id, client);
    }

    await client.query('COMMIT');

    // Publish WebSocket event
    await publishEvent('booking:canceled', {
      bookingId,
      canceledBy,
      reason,
      requesterId: booking.requester_id,
      responderId: booking.responder_id,
    });

    logger.info('Booking canceled', { bookingId, canceledBy, reason });

    // Fetch updated booking
    const updatedResult = await query<BookingRecord>('SELECT * FROM bookings WHERE id = $1', [bookingId]);
    return updatedResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to cancel booking', { error, bookingId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Mark booking as failed
 */
export async function failBooking(bookingId: string, reason?: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get booking
    const bookingResult = await client.query<BookingRecord>(
      'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new ApiError(404, 'Booking not found');
    }

    const booking = bookingResult.rows[0];

    // Transition to failed
    await transitionBookingState(bookingId, 'failed', client);

    // Update booking
    await client.query(
      `UPDATE bookings
       SET cancellation_reason = $1, updated_at = NOW()
       WHERE id = $2`,
      [reason || 'Payment failed', bookingId]
    );

    // Release slot
    if (booking.slot_id) {
      await releaseSlot(booking.slot_id, client);
    }

    await client.query('COMMIT');

    // Publish WebSocket event
    await publishEvent('booking:failed', {
      bookingId,
      reason,
      requesterId: booking.requester_id,
      responderId: booking.responder_id,
    });

    logger.info('Booking failed', { bookingId, reason });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to mark booking as failed', { error, bookingId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Release expired holds (cron job)
 */
export async function releaseExpiredHolds(): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get expired bookings
    const expiredResult = await client.query<BookingRecord>(
      `SELECT * FROM bookings
       WHERE status IN ('held', 'awaiting_payment')
         AND held_until < NOW()
       FOR UPDATE`
    );

    const expiredBookings = expiredResult.rows;

    for (const booking of expiredBookings) {
      // Transition to expired
      await transitionBookingState(booking.id, 'expired', client);

      // Release slot
      if (booking.slot_id) {
        await releaseSlot(booking.slot_id, client);
      }

      // Publish event
      await publishEvent('booking:expired', {
        bookingId: booking.id,
        requesterId: booking.requester_id,
        responderId: booking.responder_id,
      });
    }

    await client.query('COMMIT');

    logger.info('Released expired holds', { count: expiredBookings.length });

    return expiredBookings.length;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to release expired holds', { error });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get booking by ID
 */
export async function getBookingById(bookingId: string): Promise<BookingRecord | null> {
  const result = await query<BookingRecord>('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  return result.rows[0] || null;
}

/**
 * Get bookings for a user
 */
export async function getUserBookings(
  userId: string,
  status?: BookingStatus[]
): Promise<BookingRecord[]> {
  let sql = `SELECT * FROM bookings WHERE (requester_id = $1 OR responder_id = $1)`;
  const params: any[] = [userId];

  if (status && status.length > 0) {
    sql += ` AND status = ANY($2)`;
    params.push(status);
  }

  sql += ` ORDER BY scheduled_start DESC`;

  const result = await query<BookingRecord>(sql, params);
  return result.rows;
}

/**
 * Get upcoming bookings
 */
export async function getUpcomingBookings(userId: string): Promise<BookingRecord[]> {
  const result = await query<BookingRecord>(
    `SELECT * FROM bookings
     WHERE (requester_id = $1 OR responder_id = $1)
       AND status = 'confirmed'
       AND scheduled_start > NOW()
     ORDER BY scheduled_start ASC`,
    [userId]
  );

  return result.rows;
}

// Export utilities
export { HOLD_TTL_MINUTES, BOOKING_STATE_TRANSITIONS };
