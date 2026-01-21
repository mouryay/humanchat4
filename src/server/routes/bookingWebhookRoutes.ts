/**
 * Booking Webhook Routes
 * 
 * Handles Stripe webhook events for booking payments
 * CRITICAL: Must use raw body for signature verification
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError.js';
import * as bookingPaymentService from '../services/bookingPaymentService.js';
import * as paymentService from '../services/paymentDatabaseService.js';
import * as bookingService from '../services/bookingStateMachineService.js';
import { logger } from '../utils/logger.js';
import { publishEvent } from '../utils/redis.js';
import Stripe from 'stripe';

const router = Router();

// ============================================================================
// Webhook Handler
// ============================================================================

/**
 * POST /api/webhooks/bookings/stripe
 * 
 * Handle Stripe webhook events for booking payments
 * 
 * Events handled:
 * - checkout.session.completed
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - charge.refunded
 * - refund.updated
 */
router.post('/stripe', async (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['stripe-signature'];

  if (!signature || Array.isArray(signature)) {
    logger.error('Missing Stripe signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }

  try {
    // Verify webhook signature and construct event
    // Note: req.body should be raw Buffer (configured in app.ts)
    const event = bookingPaymentService.constructBookingWebhookEvent(
      req.body,
      signature
    );

    logger.info('Received Stripe booking webhook', {
      eventId: event.id,
      eventType: event.type,
    });

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event);
        break;

      case 'refund.updated':
        await handleRefundUpdated(event);
        break;

      default:
        logger.info('Unhandled booking webhook event type', { type: event.type });
    }

    // Always return 200 to acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    logger.error('Booking webhook error', { error });
    
    if (error instanceof ApiError && error.statusCode === 400) {
      // Signature verification failed
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Don't throw other errors - just log and return 500
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle checkout.session.completed
 * Triggered when customer completes Stripe Checkout
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    logger.error('Checkout session missing bookingId in metadata', {
      sessionId: session.id,
    });
    return;
  }

  try {
    // Get payment record
    const payment = await paymentService.getPaymentByStripeSessionId(session.id);

    if (!payment) {
      logger.error('Payment not found for checkout session', {
        sessionId: session.id,
        bookingId,
      });
      return;
    }

    // Update payment with payment intent ID
    const paymentIntentId = session.payment_intent as string;

    await paymentService.updatePayment({
      paymentId: payment.id,
      stripePaymentIntentId: paymentIntentId,
      status: 'processing',
    });

    logger.info('Checkout session completed', {
      bookingId,
      sessionId: session.id,
      paymentIntentId,
    });

    // Note: Actual confirmation happens in payment_intent.succeeded
  } catch (error) {
    logger.error('Error handling checkout session completed', { error, bookingId });
    throw error;
  }
}

/**
 * Handle payment_intent.succeeded
 * Triggered when payment is successfully captured
 */
async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    logger.error('Payment intent missing bookingId in metadata', {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  try {
    // Get payment record
    const payment = await paymentService.getPaymentByStripeIntentId(paymentIntent.id);

    if (!payment) {
      logger.error('Payment not found for payment intent', {
        paymentIntentId: paymentIntent.id,
        bookingId,
      });
      return;
    }

    // Update payment status
    await paymentService.markPaymentSucceeded({
      paymentId: payment.id,
      stripeChargeId: paymentIntent.latest_charge as string,
      paymentMethodId: paymentIntent.payment_method as string,
      paymentMethodType: paymentIntent.payment_method_types[0],
    });

    // Confirm booking
    await bookingService.confirmBooking({
      bookingId,
      paymentIntentId: paymentIntent.id,
    });

    // Publish WebSocket event
    await publishEvent('payment:succeeded', {
      bookingId,
      paymentId: payment.id,
      paymentIntentId: paymentIntent.id,
      amount: payment.amount_cents,
    });

    logger.info('Payment succeeded and booking confirmed', {
      bookingId,
      paymentId: payment.id,
      amount: payment.amount_cents,
    });
  } catch (error) {
    logger.error('Error handling payment intent succeeded', { error, bookingId });
    throw error;
  }
}

/**
 * Handle payment_intent.payment_failed
 * Triggered when payment fails
 */
async function handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    logger.error('Payment intent missing bookingId in metadata', {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  try {
    // Get payment record
    const payment = await paymentService.getPaymentByStripeIntentId(paymentIntent.id);

    if (!payment) {
      logger.error('Payment not found for payment intent', {
        paymentIntentId: paymentIntent.id,
        bookingId,
      });
      return;
    }

    // Get failure reason
    const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';

    // Update payment status
    await paymentService.markPaymentFailed(payment.id, failureMessage);

    // Fail booking
    await bookingService.failBooking(bookingId, failureMessage);

    // Publish WebSocket event
    await publishEvent('payment:failed', {
      bookingId,
      paymentId: payment.id,
      paymentIntentId: paymentIntent.id,
      reason: failureMessage,
    });

    logger.info('Payment failed and booking marked as failed', {
      bookingId,
      paymentId: payment.id,
      reason: failureMessage,
    });
  } catch (error) {
    logger.error('Error handling payment intent failed', { error, bookingId });
    throw error;
  }
}

/**
 * Handle charge.refunded
 * Triggered when a charge is refunded
 */
async function handleChargeRefunded(event: Stripe.Event): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = charge.payment_intent as string;

  if (!paymentIntentId) {
    logger.error('Charge missing payment intent', { chargeId: charge.id });
    return;
  }

  try {
    // Get payment record
    const payment = await paymentService.getPaymentByStripeIntentId(paymentIntentId);

    if (!payment) {
      logger.error('Payment not found for charge refund', {
        chargeId: charge.id,
        paymentIntentId,
      });
      return;
    }

    // Update payment status
    const isFullyRefunded = charge.amount_refunded === charge.amount;
    const newStatus: 'refunded' | 'partially_refunded' = isFullyRefunded
      ? 'refunded'
      : 'partially_refunded';

    await paymentService.updatePayment({
      paymentId: payment.id,
      status: newStatus,
    });

    // Update refund records
    const refunds = await paymentService.getRefundsByPaymentId(payment.id);

    for (const refund of refunds) {
      if (refund.status === 'pending' || refund.status === 'processing') {
        await paymentService.markRefundSucceeded(refund.id);
      }
    }

    // Publish WebSocket event
    await publishEvent('payment:refunded', {
      bookingId: payment.booking_id,
      paymentId: payment.id,
      amount: charge.amount_refunded,
      isFullyRefunded,
    });

    logger.info('Charge refunded', {
      bookingId: payment.booking_id,
      paymentId: payment.id,
      amountRefunded: charge.amount_refunded,
      isFullyRefunded,
    });
  } catch (error) {
    logger.error('Error handling charge refunded', { error, chargeId: charge.id });
    throw error;
  }
}

/**
 * Handle refund.updated
 * Triggered when refund status changes
 */
async function handleRefundUpdated(event: Stripe.Event): Promise<void> {
  const stripeRefund = event.data.object as Stripe.Refund;

  try {
    // Get refund record
    const refund = await paymentService.getRefundByStripeId(stripeRefund.id);

    if (!refund) {
      logger.error('Refund not found', { stripeRefundId: stripeRefund.id });
      return;
    }

    // Update refund status
    if (stripeRefund.status === 'succeeded') {
      await paymentService.markRefundSucceeded(refund.id);
    } else if (stripeRefund.status === 'failed') {
      await paymentService.markRefundFailed(refund.id, stripeRefund.failure_reason || 'Unknown');
    }

    logger.info('Refund updated', {
      refundId: refund.id,
      bookingId: refund.booking_id,
      status: stripeRefund.status,
    });
  } catch (error) {
    logger.error('Error handling refund updated', { error, stripeRefundId: stripeRefund.id });
    throw error;
  }
}

// ============================================================================
// Test Endpoint (Development Only)
// ============================================================================

if (process.env.NODE_ENV === 'development') {
  /**
   * POST /api/webhooks/bookings/test
   * Test webhook processing without Stripe
   */
  router.post('/test', async (req: Request, res: Response) => {
    const { eventType, bookingId, paymentIntentId } = req.body;

    try {
      // Simulate webhook event
      logger.info('Test webhook triggered', { eventType, bookingId });

      switch (eventType) {
        case 'payment_succeeded':
          await bookingService.confirmBooking({ bookingId, paymentIntentId });
          break;

        case 'payment_failed':
          await bookingService.failBooking(bookingId, 'Test failure');
          break;

        default:
          throw new Error(`Unknown test event type: ${eventType}`);
      }

      res.json({ success: true, message: `Test event ${eventType} processed` });
    } catch (error) {
      logger.error('Test webhook error', { error });
      res.status(500).json({ error: 'Test webhook failed' });
    }
  });
}

export default router;
