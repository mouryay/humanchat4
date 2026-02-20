/**
 * Booking Payment Service
 * 
 * Handles payment processing for bookings using Stripe Checkout.
 * Separates booking payments from session payments.
 */

import Stripe from 'stripe';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { logger } from '../utils/logger.js';

// Initialize Stripe client for bookings
const stripe = new Stripe(env.stripeSecretKey, {
  apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
  typescript: true,
  appInfo: {
    name: 'HumanChat-Bookings',
    version: '1.0.0',
    url: 'https://humanchat.com',
  },
});

// ============================================================================
// Types
// ============================================================================

export interface CreateBookingCheckoutParams {
  bookingId: string;
  amountCents: number;
  currency?: string;
  requesterEmail: string;
  responderName: string;
  scheduledStart: Date;
  durationMinutes: number;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CreateBookingPaymentIntentParams {
  bookingId: string;
  amountCents: number;
  currency?: string;
  requesterEmail: string;
  metadata?: Record<string, string>;
}

export interface RefundBookingParams {
  paymentIntentId: string;
  amountCents?: number; // If not provided, full refund
  reason?: string;
  metadata?: Record<string, string>;
}

// ============================================================================
// Checkout Session Methods (Recommended for MVP)
// ============================================================================

/**
 * Create a Checkout Session for booking payment
 * 
 * Recommended approach:
 * - Stripe handles the entire payment UI
 * - Automatic 3D Secure handling
 * - Mobile-optimized
 * - Less frontend code
 * - Better conversion rates
 */
export async function createBookingCheckoutSession(
  params: CreateBookingCheckoutParams
): Promise<Stripe.Checkout.Session> {
  const {
    bookingId,
    amountCents,
    currency = 'usd',
    requesterEmail,
    responderName,
    scheduledStart,
    durationMinutes,
    successUrl,
    cancelUrl,
    metadata = {},
  } = params;

  try {
    // Validate minimum amount ($0.50)
    if (amountCents < 50) {
      throw new ApiError(400, 'Payment amount must be at least $0.50');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: requesterEmail,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Session with ${responderName}`,
              description: `${durationMinutes}-minute session scheduled for ${scheduledStart.toLocaleString()}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: {
          bookingId,
          type: 'booking',
          ...metadata,
        },
      },
      metadata: {
        bookingId,
        type: 'booking',
        ...metadata,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes to complete payment
      allow_promotion_codes: true, // Enable promo codes
    });

    logger.info('Booking checkout session created', {
      sessionId: session.id,
      bookingId,
      amount: amountCents,
      responder: responderName,
    });

    return session;
  } catch (error) {
    logger.error('Failed to create booking checkout session', { error, bookingId });
    if (error instanceof Stripe.errors.StripeError) {
      throw new ApiError(400, `Stripe error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Retrieve a Checkout Session with line items
 */
export async function getBookingCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  try {
    return await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'line_items'],
    });
  } catch (error) {
    logger.error('Failed to retrieve booking checkout session', { error, sessionId });
    if (error instanceof Stripe.errors.StripeError) {
      throw new ApiError(404, `Checkout session not found: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Expire a Checkout Session (if payment not completed)
 */
export async function expireBookingCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  try {
    const session = await stripe.checkout.sessions.expire(sessionId);
    logger.info('Booking checkout session expired', { sessionId });
    return session;
  } catch (error) {
    logger.error('Failed to expire booking checkout session', { error, sessionId });
    if (error instanceof Stripe.errors.StripeError) {
      throw new ApiError(400, `Cannot expire checkout session: ${error.message}`);
    }
    throw error;
  }
}

// ============================================================================
// Payment Intent Methods (Alternative: For custom payment UI)
// ============================================================================

/**
 * Create a Payment Intent for booking
 * 
 * Use this if you want custom payment UI with Stripe Payment Element
 * More control but requires more frontend code
 */
export async function createBookingPaymentIntent(
  params: CreateBookingPaymentIntentParams
): Promise<Stripe.PaymentIntent> {
  const {
    bookingId,
    amountCents,
    currency = 'usd',
    requesterEmail,
    metadata = {},
  } = params;

  try {
    // Validate minimum amount
    if (amountCents < 50) {
      throw new ApiError(400, 'Payment amount must be at least $0.50');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: requesterEmail,
      metadata: {
        bookingId,
        type: 'booking',
        ...metadata,
      },
      description: `HumanChat Booking ${bookingId}`,
    });

    logger.info('Booking payment intent created', {
      paymentIntentId: paymentIntent.id,
      bookingId,
      amount: amountCents,
    });

    return paymentIntent;
  } catch (error) {
    logger.error('Failed to create booking payment intent', { error, bookingId });
    if (error instanceof Stripe.errors.StripeError) {
      throw new ApiError(400, `Stripe error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Retrieve a Payment Intent
 */
export async function getBookingPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    logger.error('Failed to retrieve booking payment intent', { error, paymentIntentId });
    if (error instanceof Stripe.errors.StripeError) {
      throw new ApiError(404, `Payment intent not found: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Cancel a Payment Intent
 */
export async function cancelBookingPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  try {
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    logger.info('Booking payment intent canceled', { paymentIntentId });
    return paymentIntent;
  } catch (error) {
    logger.error('Failed to cancel booking payment intent', { error, paymentIntentId });
    if (error instanceof Stripe.errors.StripeError) {
      throw new ApiError(400, `Cannot cancel payment intent: ${error.message}`);
    }
    throw error;
  }
}

// ============================================================================
// Refund Methods
// ============================================================================

/**
 * Create a refund for a booking payment
 * 
 * Refund policies:
 * - More than 24 hours before: Full refund
 * - Less than 24 hours: 50% refund (configurable)
 * - After session start: No refund
 */
export async function createBookingRefund(
  params: RefundBookingParams
): Promise<Stripe.Refund> {
  const { paymentIntentId, amountCents, reason, metadata = {} } = params;

  try {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      metadata: {
        type: 'booking_refund',
        ...metadata,
      },
    };

    // Partial or full refund
    if (amountCents) {
      refundParams.amount = amountCents;
    }

    // Stripe refund reasons: duplicate, fraudulent, requested_by_customer
    if (reason) {
      refundParams.reason = 'requested_by_customer';
    }

    const refund = await stripe.refunds.create(refundParams);

    logger.info('Booking refund created', {
      refundId: refund.id,
      paymentIntentId,
      amount: amountCents || 'full',
      reason,
    });

    return refund;
  } catch (error) {
    logger.error('Failed to create booking refund', { error, paymentIntentId });
    if (error instanceof Stripe.errors.StripeError) {
      throw new ApiError(400, `Stripe refund error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Retrieve a refund
 */
export async function getBookingRefund(refundId: string): Promise<Stripe.Refund> {
  try {
    return await stripe.refunds.retrieve(refundId);
  } catch (error) {
    logger.error('Failed to retrieve booking refund', { error, refundId });
    if (error instanceof Stripe.errors.StripeError) {
      throw new ApiError(404, `Refund not found: ${error.message}`);
    }
    throw error;
  }
}

// ============================================================================
// Webhook Verification
// ============================================================================

/**
 * Construct and verify a webhook event from Stripe
 * 
 * CRITICAL: Must use raw body (Buffer) for signature verification
 */
export function constructBookingWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  if (!env.stripeWebhookSecret) {
    throw new ApiError(500, 'Stripe webhook secret not configured');
  }
  try {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      env.stripeWebhookSecret
    );
  } catch (error) {
    logger.error('Booking webhook signature verification failed', { error });
    throw new ApiError(400, 'Invalid webhook signature');
  }
}

/**
 * Verify webhook signature without constructing event
 */
export function verifyBookingWebhookSignature(
  payload: string | Buffer,
  signature: string
): boolean {
  if (!env.stripeWebhookSecret) {
    throw new ApiError(500, 'Stripe webhook secret not configured');
  }
  try {
    stripe.webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Utility Methods
// ============================================================================

/**
 * Calculate refund amount based on cancellation policy
 * 
 * Policy:
 * - More than 24 hours before: 100% refund
 * - 12-24 hours before: 50% refund
 * - Less than 12 hours: No refund
 * - After session start: No refund
 */
export function calculateRefundAmount(
  originalAmountCents: number,
  scheduledStart: Date,
  canceledAt: Date = new Date()
): number {
  const hoursUntilSession = (scheduledStart.getTime() - canceledAt.getTime()) / (1000 * 60 * 60);

  if (hoursUntilSession < 0) {
    // Session already started
    return 0;
  } else if (hoursUntilSession < 12) {
    // Less than 12 hours: no refund
    return 0;
  } else if (hoursUntilSession < 24) {
    // 12-24 hours: 50% refund
    return Math.floor(originalAmountCents * 0.5);
  } else {
    // More than 24 hours: full refund
    return originalAmountCents;
  }
}

/**
 * Format amount for display
 */
export function formatBookingAmount(amountCents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Get Stripe client instance
 */
export function getStripeClient(): Stripe {
  return stripe;
}

/**
 * Create checkout session for a booking (convenience wrapper)
 * Fetches booking details and creates checkout session
 */
export async function createCheckoutSession(bookingId: string): Promise<{ url: string; sessionId: string }> {
  const { query } = await import('../db/postgres.js');
  
  // Fetch booking details
  const result = await query(
    `SELECT 
      b.id as booking_id,
      b.price_cents,
      b.duration_minutes,
      b.scheduled_start,
      b.requester_id,
      b.responder_id,
      requester.email as requester_email,
      responder.name as responder_name
     FROM bookings b
     JOIN users requester ON requester.id = b.requester_id
     JOIN users responder ON responder.id = b.responder_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, 'Booking not found');
  }

  const booking = result.rows[0];

  if (!booking.price_cents || booking.price_cents === 0) {
    throw new ApiError(400, 'Booking does not require payment');
  }

  const session = await createBookingCheckoutSession({
    bookingId: booking.booking_id,
    amountCents: booking.price_cents,
    requesterEmail: booking.requester_email,
    responderName: booking.responder_name,
    scheduledStart: new Date(booking.scheduled_start),
    durationMinutes: booking.duration_minutes,
    successUrl: `${env.appUrl}/bookings/${bookingId}/confirmation?payment=success`,
    cancelUrl: `${env.appUrl}/bookings/${bookingId}/payment-canceled`,
    metadata: {
      requesterId: booking.requester_id,
      responderId: booking.responder_id
    }
  });

  logger.info('Checkout session created for booking', { bookingId, sessionId: session.id });

  return {
    url: session.url!,
    sessionId: session.id
  };
}

// Export default
export default {
  createBookingCheckoutSession,
  getBookingCheckoutSession,
  expireBookingCheckoutSession,
  createBookingPaymentIntent,
  getBookingPaymentIntent,
  cancelBookingPaymentIntent,
  createBookingRefund,
  getBookingRefund,
  constructBookingWebhookEvent,
  verifyBookingWebhookSignature,
  calculateRefundAmount,
  formatBookingAmount,
  dollarsToCents,
  centsToDollars,
  getStripeClient,
  createCheckoutSession,
};
