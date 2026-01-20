/**
 * Payment Database Service
 * 
 * Handles payment and refund record persistence in PostgreSQL.
 * Bridges Stripe events with database state.
 */

import { query, getPool } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import { logger } from '../utils/logger.js';
import type { PoolClient } from 'pg';

// ============================================================================
// Types
// ============================================================================

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'partially_refunded';

export type RefundStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export interface PaymentRecord {
  id: string;
  booking_id: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_charge_id: string | null;
  amount_cents: number;
  currency: string;
  platform_fee_cents: number;
  responder_payout_cents: number;
  status: PaymentStatus;
  payment_method_id: string | null;
  payment_method_type: string | null;
  paid_at: Date | null;
  failed_at: Date | null;
  failure_reason: string | null;
  stripe_metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

export interface RefundRecord {
  id: string;
  payment_id: string;
  booking_id: string;
  stripe_refund_id: string | null;
  amount_cents: number;
  currency: string;
  status: RefundStatus;
  reason: string | null;
  requested_by: string | null;
  processed_at: Date | null;
  failed_at: Date | null;
  failure_reason: string | null;
  stripe_metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentParams {
  bookingId: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  amountCents: number;
  currency?: string;
  platformFeeCents?: number;
  responderPayoutCents?: number;
  stripeMetadata?: Record<string, any>;
}

export interface UpdatePaymentParams {
  paymentId: string;
  status?: PaymentStatus;
  stripeChargeId?: string;
  stripePaymentIntentId?: string;
  paymentMethodId?: string;
  paymentMethodType?: string;
  paidAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  stripeMetadata?: Record<string, any>;
}

export interface CreateRefundParams {
  paymentId: string;
  bookingId: string;
  stripeRefundId?: string;
  amountCents: number;
  currency?: string;
  reason?: string;
  requestedBy?: string;
  stripeMetadata?: Record<string, any>;
}

export interface UpdateRefundParams {
  refundId: string;
  status?: RefundStatus;
  processedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  stripeMetadata?: Record<string, any>;
}

// ============================================================================
// Payment Operations
// ============================================================================

/**
 * Create a payment record
 */
export async function createPayment(params: CreatePaymentParams): Promise<PaymentRecord> {
  const {
    bookingId,
    stripePaymentIntentId,
    stripeCheckoutSessionId,
    amountCents,
    currency = 'USD',
    platformFeeCents = 0,
    responderPayoutCents = 0,
    stripeMetadata,
  } = params;

  try {
    // Check for existing payment for this booking (idempotency)
    const existingResult = await query<PaymentRecord>(
      'SELECT * FROM payments WHERE booking_id = $1',
      [bookingId]
    );

    if (existingResult.rows.length > 0) {
      logger.info('Payment already exists for booking', { bookingId });
      return existingResult.rows[0];
    }

    const result = await query<PaymentRecord>(
      `INSERT INTO payments (
        booking_id, stripe_payment_intent_id, stripe_checkout_session_id,
        amount_cents, currency, platform_fee_cents, responder_payout_cents,
        status, stripe_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
      RETURNING *`,
      [
        bookingId,
        stripePaymentIntentId,
        stripeCheckoutSessionId,
        amountCents,
        currency,
        platformFeeCents,
        responderPayoutCents,
        stripeMetadata ? JSON.stringify(stripeMetadata) : null,
      ]
    );

    logger.info('Payment record created', {
      paymentId: result.rows[0].id,
      bookingId,
      amount: amountCents,
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create payment record', { error, bookingId });
    throw error;
  }
}

/**
 * Update a payment record
 */
export async function updatePayment(params: UpdatePaymentParams): Promise<PaymentRecord> {
  const {
    paymentId,
    status,
    stripeChargeId,
    paymentMethodId,
    paymentMethodType,
    paidAt,
    failedAt,
    failureReason,
    stripeMetadata,
  } = params;

  try {
    // Build dynamic update query
    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (stripeChargeId !== undefined) {
      updates.push(`stripe_charge_id = $${paramIndex++}`);
      values.push(stripeChargeId);
    }
    if (paymentMethodId !== undefined) {
      updates.push(`payment_method_id = $${paramIndex++}`);
      values.push(paymentMethodId);
    }
    if (paymentMethodType !== undefined) {
      updates.push(`payment_method_type = $${paramIndex++}`);
      values.push(paymentMethodType);
    }
    if (paidAt !== undefined) {
      updates.push(`paid_at = $${paramIndex++}`);
      values.push(paidAt);
    }
    if (failedAt !== undefined) {
      updates.push(`failed_at = $${paramIndex++}`);
      values.push(failedAt);
    }
    if (failureReason !== undefined) {
      updates.push(`failure_reason = $${paramIndex++}`);
      values.push(failureReason);
    }
    if (stripeMetadata !== undefined) {
      updates.push(`stripe_metadata = $${paramIndex++}`);
      values.push(JSON.stringify(stripeMetadata));
    }

    values.push(paymentId);

    const result = await query<PaymentRecord>(
      `UPDATE payments SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Payment not found');
    }

    logger.info('Payment record updated', { paymentId, status });

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update payment record', { error, paymentId });
    throw error;
  }
}

/**
 * Get payment by ID
 */
export async function getPaymentById(paymentId: string): Promise<PaymentRecord | null> {
  const result = await query<PaymentRecord>('SELECT * FROM payments WHERE id = $1', [paymentId]);
  return result.rows[0] || null;
}

/**
 * Get payment by booking ID
 */
export async function getPaymentByBookingId(bookingId: string): Promise<PaymentRecord | null> {
  const result = await query<PaymentRecord>(
    'SELECT * FROM payments WHERE booking_id = $1',
    [bookingId]
  );
  return result.rows[0] || null;
}

/**
 * Get payment by Stripe Payment Intent ID
 */
export async function getPaymentByStripeIntentId(
  intentId: string
): Promise<PaymentRecord | null> {
  const result = await query<PaymentRecord>(
    'SELECT * FROM payments WHERE stripe_payment_intent_id = $1',
    [intentId]
  );
  return result.rows[0] || null;
}

/**
 * Get payment by Stripe Checkout Session ID
 */
export async function getPaymentByStripeSessionId(
  sessionId: string
): Promise<PaymentRecord | null> {
  const result = await query<PaymentRecord>(
    'SELECT * FROM payments WHERE stripe_checkout_session_id = $1',
    [sessionId]
  );
  return result.rows[0] || null;
}

/**
 * Mark payment as succeeded (called from webhook)
 */
export async function markPaymentSucceeded(params: {
  paymentId: string;
  stripeChargeId: string;
  paymentMethodId?: string;
  paymentMethodType?: string;
}): Promise<PaymentRecord> {
  return updatePayment({
    paymentId: params.paymentId,
    status: 'succeeded',
    stripeChargeId: params.stripeChargeId,
    paymentMethodId: params.paymentMethodId,
    paymentMethodType: params.paymentMethodType,
    paidAt: new Date(),
  });
}

/**
 * Mark payment as failed (called from webhook)
 */
export async function markPaymentFailed(
  paymentId: string,
  failureReason: string
): Promise<PaymentRecord> {
  return updatePayment({
    paymentId,
    status: 'failed',
    failedAt: new Date(),
    failureReason,
  });
}

// ============================================================================
// Refund Operations
// ============================================================================

/**
 * Create a refund record
 */
export async function createRefund(params: CreateRefundParams): Promise<RefundRecord> {
  const {
    paymentId,
    bookingId,
    stripeRefundId,
    amountCents,
    currency = 'USD',
    reason,
    requestedBy,
    stripeMetadata,
  } = params;

  try {
    const result = await query<RefundRecord>(
      `INSERT INTO refunds (
        payment_id, booking_id, stripe_refund_id, amount_cents, currency,
        status, reason, requested_by, stripe_metadata
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)
      RETURNING *`,
      [
        paymentId,
        bookingId,
        stripeRefundId,
        amountCents,
        currency,
        reason,
        requestedBy,
        stripeMetadata ? JSON.stringify(stripeMetadata) : null,
      ]
    );

    logger.info('Refund record created', {
      refundId: result.rows[0].id,
      paymentId,
      bookingId,
      amount: amountCents,
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create refund record', { error, paymentId });
    throw error;
  }
}

/**
 * Update a refund record
 */
export async function updateRefund(params: UpdateRefundParams): Promise<RefundRecord> {
  const { refundId, status, processedAt, failedAt, failureReason, stripeMetadata } = params;

  try {
    // Build dynamic update query
    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (processedAt !== undefined) {
      updates.push(`processed_at = $${paramIndex++}`);
      values.push(processedAt);
    }
    if (failedAt !== undefined) {
      updates.push(`failed_at = $${paramIndex++}`);
      values.push(failedAt);
    }
    if (failureReason !== undefined) {
      updates.push(`failure_reason = $${paramIndex++}`);
      values.push(failureReason);
    }
    if (stripeMetadata !== undefined) {
      updates.push(`stripe_metadata = $${paramIndex++}`);
      values.push(JSON.stringify(stripeMetadata));
    }

    values.push(refundId);

    const result = await query<RefundRecord>(
      `UPDATE refunds SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Refund not found');
    }

    logger.info('Refund record updated', { refundId, status });

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update refund record', { error, refundId });
    throw error;
  }
}

/**
 * Get refund by ID
 */
export async function getRefundById(refundId: string): Promise<RefundRecord | null> {
  const result = await query<RefundRecord>('SELECT * FROM refunds WHERE id = $1', [refundId]);
  return result.rows[0] || null;
}

/**
 * Get refund by Stripe Refund ID
 */
export async function getRefundByStripeId(stripeRefundId: string): Promise<RefundRecord | null> {
  const result = await query<RefundRecord>(
    'SELECT * FROM refunds WHERE stripe_refund_id = $1',
    [stripeRefundId]
  );
  return result.rows[0] || null;
}

/**
 * Get refunds for a payment
 */
export async function getRefundsByPaymentId(paymentId: string): Promise<RefundRecord[]> {
  const result = await query<RefundRecord>(
    'SELECT * FROM refunds WHERE payment_id = $1 ORDER BY created_at DESC',
    [paymentId]
  );
  return result.rows;
}

/**
 * Get refunds for a booking
 */
export async function getRefundsByBookingId(bookingId: string): Promise<RefundRecord[]> {
  const result = await query<RefundRecord>(
    'SELECT * FROM refunds WHERE booking_id = $1 ORDER BY created_at DESC',
    [bookingId]
  );
  return result.rows;
}

/**
 * Mark refund as succeeded (called from webhook)
 */
export async function markRefundSucceeded(refundId: string): Promise<RefundRecord> {
  return updateRefund({
    refundId,
    status: 'succeeded',
    processedAt: new Date(),
  });
}

/**
 * Mark refund as failed (called from webhook)
 */
export async function markRefundFailed(
  refundId: string,
  failureReason: string
): Promise<RefundRecord> {
  return updateRefund({
    refundId,
    status: 'failed',
    failedAt: new Date(),
    failureReason,
  });
}

// ============================================================================
// Aggregate Queries
// ============================================================================

/**
 * Get complete payment info with booking details
 */
export async function getPaymentWithBooking(paymentId: string): Promise<any> {
  const result = await query(
    `SELECT 
      p.*,
      b.requester_id,
      b.responder_id,
      b.scheduled_start,
      b.scheduled_end,
      b.status AS booking_status,
      u_req.name AS requester_name,
      u_req.email AS requester_email,
      u_resp.name AS responder_name,
      u_resp.email AS responder_email
     FROM payments p
     JOIN bookings b ON p.booking_id = b.id
     JOIN users u_req ON b.requester_id = u_req.id
     JOIN users u_resp ON b.responder_id = u_resp.id
     WHERE p.id = $1`,
    [paymentId]
  );

  return result.rows[0] || null;
}

/**
 * Get all payments for a user (requester or responder)
 */
export async function getUserPayments(userId: string): Promise<PaymentRecord[]> {
  const result = await query<PaymentRecord>(
    `SELECT p.* FROM payments p
     JOIN bookings b ON p.booking_id = b.id
     WHERE b.requester_id = $1 OR b.responder_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );

  return result.rows;
}

// Export default
export default {
  createPayment,
  updatePayment,
  getPaymentById,
  getPaymentByBookingId,
  getPaymentByStripeIntentId,
  getPaymentByStripeSessionId,
  markPaymentSucceeded,
  markPaymentFailed,
  createRefund,
  updateRefund,
  getRefundById,
  getRefundByStripeId,
  getRefundsByPaymentId,
  getRefundsByBookingId,
  markRefundSucceeded,
  markRefundFailed,
  getPaymentWithBooking,
  getUserPayments,
};
