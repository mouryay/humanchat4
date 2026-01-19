/**
 * Booking Payment API Routes
 * 
 * Handles booking-payment operations with Stripe integration
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from '../errors/ApiError.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as bookingService from '../services/bookingStateMachineService.js';
import * as paymentService from '../services/paymentDatabaseService.js';
import * as bookingPaymentService from '../services/bookingPaymentService.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Validation Schemas
// ============================================================================

const holdBookingSchema = z.object({
  body: z.object({
    responderId: z.string().uuid(),
    slotId: z.string().uuid(),
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
    durationMinutes: z.number().int().min(15),
    timezone: z.string(),
    priceCents: z.number().int().min(0),
    currency: z.string().length(3).optional(),
    notes: z.string().optional(),
  }),
});

const createPaymentIntentSchema = z.object({
  body: z.object({
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  }),
});

const confirmBookingSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid().optional(),
  }),
});

const cancelBookingSchema = z.object({
  body: z.object({
    reason: z.string().optional(),
  }),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/bookings/hold
 * Create a booking hold (Step 1: Reserve slot)
 */
router.post(
  '/hold',
  validateRequest(holdBookingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const {
        responderId,
        slotId,
        scheduledStart,
        scheduledEnd,
        durationMinutes,
        timezone,
        priceCents,
        currency,
        notes,
      } = req.body;

      // Generate idempotency token
      const holdToken = `${userId}-${slotId}-${Date.now()}`;

      const booking = await bookingService.createBookingHold({
        requesterId: userId,
        responderId,
        slotId,
        scheduledStart: new Date(scheduledStart),
        scheduledEnd: new Date(scheduledEnd),
        durationMinutes,
        timezone,
        priceCents,
        currency,
        holdToken,
        notes,
      });

      res.status(201).json({
        booking: {
          id: booking.id,
          status: booking.status,
          scheduledStart: booking.scheduled_start,
          scheduledEnd: booking.scheduled_end,
          priceCents: booking.price_cents,
          currency: booking.currency,
        },
        heldUntil: booking.held_until,
        message: 'Booking hold created. Complete payment within 15 minutes.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/bookings/:bookingId/payment-intent
 * Create a Stripe Checkout Session for booking payment (Step 2)
 */
router.post(
  '/:bookingId/payment-intent',
  validateRequest(createPaymentIntentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { bookingId } = req.params;
      const { successUrl, cancelUrl } = req.body;

      // Get booking
      const booking = await bookingService.getBookingById(bookingId);
      if (!booking) {
        throw new ApiError(404, 'Booking not found');
      }

      // Verify user is the requester
      if (booking.requester_id !== userId) {
        throw new ApiError(403, 'Not authorized to pay for this booking');
      }

      // Check booking status
      if (booking.status !== 'held') {
        throw new ApiError(400, `Cannot pay for booking with status: ${booking.status}`);
      }

      // Check if booking is expired
      if (booking.held_until && new Date(booking.held_until) < new Date()) {
        throw new ApiError(400, 'Booking hold has expired');
      }

      // Skip payment if free
      if (booking.price_cents === 0) {
        const confirmed = await bookingService.confirmBooking({
          bookingId,
        });

        return res.json({
          message: 'Free booking confirmed',
          booking: confirmed,
        });
      }

      // Get responder info
      const { query } = await import('../db/postgres.js');
      const responderResult = await query('SELECT name, email FROM users WHERE id = $1', [
        booking.responder_id,
      ]);
      const responder = responderResult.rows[0];

      // Create Stripe Checkout Session
      const checkoutSession = await bookingPaymentService.createBookingCheckoutSession({
        bookingId,
        amountCents: booking.price_cents,
        currency: booking.currency,
        requesterEmail: req.user!.email,
        responderName: responder.name,
        scheduledStart: new Date(booking.scheduled_start),
        durationMinutes: booking.duration_minutes,
        successUrl:
          successUrl ||
          `${env.frontendUrl}/bookings/${bookingId}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: cancelUrl || `${env.frontendUrl}/bookings/${bookingId}/cancel`,
        metadata: {
          bookingId,
          requesterId: userId,
          responderId: booking.responder_id,
        },
      });

      // Create payment record
      await paymentService.createPayment({
        bookingId,
        stripeCheckoutSessionId: checkoutSession.id,
        amountCents: booking.price_cents,
        currency: booking.currency,
        platformFeeCents: booking.platform_fee_cents,
        responderPayoutCents: booking.responder_payout_cents,
      });

      // Update booking status
      const paymentIntentId = checkoutSession.payment_intent as string;
      await bookingService.markBookingAwaitingPayment(bookingId, paymentIntentId);

      logger.info('Checkout session created for booking', {
        bookingId,
        checkoutSessionId: checkoutSession.id,
        amount: booking.price_cents,
      });

      res.json({
        checkoutSessionId: checkoutSession.id,
        checkoutUrl: checkoutSession.url,
        expiresAt: new Date(checkoutSession.expires_at * 1000),
        message: 'Redirect user to checkoutUrl to complete payment',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/bookings/:bookingId/confirm
 * Confirm a booking (after payment or for free bookings)
 */
router.post(
  '/:bookingId/confirm',
  validateRequest(confirmBookingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { bookingId } = req.params;
      const { sessionId } = req.body;

      // Get booking
      const booking = await bookingService.getBookingById(bookingId);
      if (!booking) {
        throw new ApiError(404, 'Booking not found');
      }

      // Verify user is involved in booking
      if (booking.requester_id !== userId && booking.responder_id !== userId) {
        throw new ApiError(403, 'Not authorized');
      }

      // Confirm booking
      const confirmed = await bookingService.confirmBooking({
        bookingId,
        sessionId,
      });

      logger.info('Booking confirmed via API', {
        bookingId,
        userId,
        sessionId,
      });

      res.json({
        booking: confirmed,
        message: 'Booking confirmed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/bookings/:bookingId/cancel
 * Cancel a booking with refund logic
 */
router.post(
  '/:bookingId/cancel',
  validateRequest(cancelBookingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { bookingId } = req.params;
      const { reason } = req.body;

      // Get booking
      const booking = await bookingService.getBookingById(bookingId);
      if (!booking) {
        throw new ApiError(404, 'Booking not found');
      }

      // Verify user is involved in booking
      if (booking.requester_id !== userId && booking.responder_id !== userId) {
        throw new ApiError(403, 'Not authorized');
      }

      // Cancel booking
      const canceled = await bookingService.cancelBooking({
        bookingId,
        canceledBy: userId,
        reason,
      });

      // Handle refund if payment was made
      let refund = null;
      const payment = await paymentService.getPaymentByBookingId(bookingId);

      if (payment && payment.status === 'succeeded') {
        // Calculate refund amount based on policy
        const refundAmount = bookingPaymentService.calculateRefundAmount(
          payment.amount_cents,
          new Date(booking.scheduled_start),
          new Date()
        );

        if (refundAmount > 0 && payment.stripe_payment_intent_id) {
          // Create Stripe refund
          const stripeRefund = await bookingPaymentService.createBookingRefund({
            paymentIntentId: payment.stripe_payment_intent_id,
            amountCents: refundAmount,
            reason,
            metadata: {
              bookingId,
              canceledBy: userId,
            },
          });

          // Create refund record
          refund = await paymentService.createRefund({
            paymentId: payment.id,
            bookingId,
            stripeRefundId: stripeRefund.id,
            amountCents: refundAmount,
            currency: payment.currency,
            reason,
            requestedBy: userId,
          });

          logger.info('Refund initiated for canceled booking', {
            bookingId,
            refundId: refund.id,
            amount: refundAmount,
          });
        }
      }

      logger.info('Booking canceled via API', {
        bookingId,
        userId,
        reason,
        refundAmount: refund?.amount_cents || 0,
      });

      res.json({
        booking: canceled,
        refund,
        message: refund
          ? `Booking canceled. Refund of ${bookingPaymentService.formatBookingAmount(refund.amount_cents, canceled.currency)} initiated.`
          : 'Booking canceled',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/bookings/:bookingId
 * Get booking details
 */
router.get('/:bookingId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { bookingId } = req.params;

    const booking = await bookingService.getBookingById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Verify user is involved
    if (booking.requester_id !== userId && booking.responder_id !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    // Get payment info if exists
    const payment = await paymentService.getPaymentByBookingId(bookingId);

    res.json({
      booking,
      payment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings
 * Get user's bookings
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { status } = req.query;

    const statusFilter = status
      ? (status as string).split(',') as bookingService.BookingStatus[]
      : undefined;

    const bookings = await bookingService.getUserBookings(userId, statusFilter);

    res.json({
      bookings,
      count: bookings.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/upcoming
 * Get upcoming confirmed bookings
 */
router.get('/upcoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const bookings = await bookingService.getUpcomingBookings(userId);

    res.json({
      bookings,
      count: bookings.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/slots/:responderId
 * Get available slots for a responder
 */
router.get('/slots/:responderId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { responderId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new ApiError(400, 'startDate and endDate are required');
    }

    const slots = await bookingService.getAvailableSlots(
      responderId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      slots,
      count: slots.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
