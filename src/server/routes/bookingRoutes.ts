/**
 * Booking Routes
 * API endpoints for booking management and availability
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { ApiError } from '../errors/ApiError.js';
import * as bookingService from '../services/bookingService.js';
import * as googleCalendarService from '../services/googleCalendarService.js';
import * as expertAvailabilityService from '../services/expertAvailabilityService.js';
import * as bookingPaymentService from '../services/bookingPaymentService.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const getAvailabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  timezone: z.string().min(1)
});

const createBookingSchema = z.object({
  expertId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240),
  timezone: z.string().min(1),
  meetingNotes: z.string().optional(),
  idempotencyKey: z.string().optional()
});

const cancelBookingSchema = z.object({
  reason: z.string().optional()
});

const rescheduleBookingSchema = z.object({
  newStartTime: z.string().datetime(),
  newEndTime: z.string().datetime()
});

// ============================================================================
// EXPERT "ME" ROUTES - Must come BEFORE :expertId routes to avoid conflicts
// ============================================================================

/**
 * GET /api/experts/me/bookings
 * Get expert's bookings
 */
router.get(
  '/experts/me/bookings',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expertId = req.user!.id;
      const status = req.query.status as 'upcoming' | 'past' | 'canceled' | undefined;

      const bookings = await bookingService.getExpertBookings(expertId, status);

      res.json({
        success: true,
        data: bookings
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/experts/me/availability
 * Get expert's weekly availability schedule
 */
router.get(
  '/experts/me/availability',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expertId = req.user!.id;

      const rules = await expertAvailabilityService.getWeeklyAvailability(expertId);
      const summary = await expertAvailabilityService.getAvailabilitySummary(expertId);

      res.json({
        success: true,
        data: {
          rules,
          summary
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/experts/me/availability
 * Set expert's weekly availability (replaces all rules)
 */
router.post(
  '/experts/me/availability',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expertId = req.user!.id;
      const { rules } = req.body;

      if (!Array.isArray(rules)) {
        throw new ApiError(400, 'INVALID_REQUEST', 'Rules must be an array');
      }

      // Validate each rule
      for (const rule of rules) {
        if (typeof rule.dayOfWeek !== 'number' || rule.dayOfWeek < 0 || rule.dayOfWeek > 6) {
          throw new ApiError(400, 'INVALID_REQUEST', `Invalid dayOfWeek: ${rule.dayOfWeek}`);
        }
        if (!rule.startTime || !rule.endTime) {
          throw new ApiError(400, 'INVALID_REQUEST', 'startTime and endTime are required');
        }
        if (!rule.timezone) {
          throw new ApiError(400, 'INVALID_REQUEST', 'timezone is required');
        }
      }

      const updatedRules = await expertAvailabilityService.setWeeklyAvailability(
        expertId,
        rules
      );

      res.json({
        success: true,
        data: updatedRules
      });
    } catch (error) {
      console.error('Error saving availability:', error);
      next(error);
    }
  }
);

/**
 * GET /api/experts/me/availability/overrides
 * Get expert's availability overrides
 */
router.get(
  '/experts/me/availability/overrides',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expertId = req.user!.id;
      const { startDate, endDate } = req.query as { startDate: string; endDate: string };

      if (!startDate || !endDate) {
        throw new ApiError(400, 'INVALID_REQUEST', 'startDate and endDate are required');
      }

      const overrides = await expertAvailabilityService.getAvailabilityOverrides(
        expertId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: overrides
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/experts/me/availability/overrides
 * Create availability override
 */
router.post(
  '/experts/me/availability/overrides',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expertId = req.user!.id;

      const override = await expertAvailabilityService.createAvailabilityOverride({
        expertId,
        ...req.body
      });

      res.status(201).json({
        success: true,
        data: override
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/experts/me/availability/overrides/:overrideId
 * Delete availability override
 */
router.delete(
  '/experts/me/availability/overrides/:overrideId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expertId = req.user!.id;
      const { overrideId } = req.params;

      await expertAvailabilityService.deleteAvailabilityOverride(overrideId, expertId);

      res.json({
        success: true,
        message: 'Override deleted'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/experts/me/availability/block-dates
 * Block a date range (vacation mode)
 */
router.post(
  '/experts/me/availability/block-dates',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expertId = req.user!.id;
      const { startDate, endDate, timezone, reason } = req.body;

      if (!startDate || !endDate || !timezone) {
        throw new ApiError(400, 'INVALID_REQUEST', 'startDate, endDate, and timezone are required');
      }

      const overrides = await expertAvailabilityService.blockDateRange(
        expertId,
        startDate,
        endDate,
        timezone,
        reason
      );

      res.status(201).json({
        success: true,
        data: overrides
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/experts/me/calendar/auth-url
 * Get Google Calendar OAuth URL
 */
router.get(
  '/experts/me/calendar/auth-url',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expertId = req.user!.id;
      const authUrl = googleCalendarService.getGoogleAuthUrl(expertId);

      res.json({
        success: true,
        data: { authUrl }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/experts/me/calendar
 * Disconnect Google Calendar
 */
router.delete(
  '/experts/me/calendar',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expertId = req.user!.id;

      await googleCalendarService.disconnectCalendar(expertId);

      res.json({
        success: true,
        message: 'Calendar disconnected'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// PUBLIC EXPERT ROUTES - With :expertId parameter
// ============================================================================

/**
 * GET /api/experts/:expertId/availability
 * Get available time slots for an expert on a specific date
 */
router.get(
  '/experts/:expertId/availability',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { expertId } = req.params;
      const validation = getAvailabilitySchema.safeParse(req.query);

      if (!validation.success) {
        throw new ApiError(400, 'INVALID_REQUEST', validation.error.message);
      }

      const { date, timezone } = validation.data;

      // Parse the date string without letting timezone offsets shift the day.
      // Using noon UTC ensures the calendar day stays consistent worldwide.
      const parsedDate = new Date(`${date}T12:00:00Z`);

      const slots = await bookingService.getAvailableSlots(
        expertId,
        parsedDate,
        timezone
      );

      res.json({
        success: true,
        data: {
          date,
          timezone,
          slots: slots.map((slot) => ({
            start: slot.start.toISOString(),
            end: slot.end.toISOString(),
            isAvailable: slot.isAvailable
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/experts/:expertId/weekly-availability
 * Public read-only view of weekly schedule (days + windows)
 */
router.get(
  '/experts/:expertId/weekly-availability',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { expertId } = req.params;
      const rules = await expertAvailabilityService.getWeeklyAvailability(expertId);

      const transformed = rules.map((rule) => ({
        id: rule.id,
        dayOfWeek: rule.day_of_week ?? rule.dayOfWeek,
        startTime: rule.start_time ?? rule.startTime,
        endTime: rule.end_time ?? rule.endTime,
        slotDurationMinutes: rule.slot_duration_minutes ?? rule.slotDurationMinutes ?? 30,
        timezone: rule.timezone
      }));

      res.json({
        success: true,
        data: transformed
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/experts/:expertId/blocked-dates
 * Get blocked dates for an expert in a date range
 */
router.get(
  '/experts/:expertId/blocked-dates',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { expertId } = req.params;
      const { startDate, endDate } = req.query as { startDate: string; endDate: string };

      if (!startDate || !endDate) {
        throw new ApiError(400, 'INVALID_REQUEST', 'startDate and endDate are required');
      }

      const overrides = await expertAvailabilityService.getAvailabilityOverrides(
        expertId,
        startDate,
        endDate
      );

      // Filter for all-day blocked dates only
      const blockedDates = overrides
        .filter((o) => {
          const overrideType = o.overrideType ?? o.override_type;
          const startTime = o.startTime ?? o.start_time;
          const endTime = o.endTime ?? o.end_time;
          return overrideType === 'blocked' && !startTime && !endTime;
        })
        .map((o) => {
          const value = o.overrideDate ?? o.override_date;
          if (!value) {
            return null;
          }
          if (value instanceof Date) {
            return value.toISOString().split('T')[0];
          }
          return value;
        })
        .filter((date): date is string => typeof date === 'string' && date.length > 0);

      res.json({
        success: true,
        data: Array.from(new Set(blockedDates)) // Remove duplicates
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/experts/:expertId/bookings
 * Create a new booking (with payment if required)
 */
router.post(
  '/experts/:expertId/bookings',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { expertId } = req.params;
      const validation = createBookingSchema.safeParse({ ...req.body, expertId });

      if (!validation.success) {
        throw new ApiError(400, 'INVALID_REQUEST', validation.error.message);
      }

      const userId = req.user!.id;

      // Prevent self-booking
      if (expertId === userId) {
        throw new ApiError(400, 'INVALID_REQUEST', 'Cannot book yourself');
      }

      const booking = await bookingService.createBooking({
        expertId: validation.data.expertId,
        userId,
        startTime: new Date(validation.data.startTime),
        endTime: new Date(validation.data.endTime),
        durationMinutes: validation.data.durationMinutes,
        timezone: validation.data.timezone,
        meetingNotes: validation.data.meetingNotes,
        idempotencyKey: validation.data.idempotencyKey
      });

      // If booking requires payment, create Stripe Payment Intent
      if (booking.priceCents && booking.priceCents > 0 && booking.status === 'awaiting_payment') {
        // Create Payment Intent for in-app payment
        const paymentIntent = await bookingPaymentService.createBookingPaymentIntent({
          bookingId: booking.bookingId,
          amountCents: booking.priceCents,
          currency: 'usd',
          requesterEmail: booking.requesterEmail || 'user@example.com',
          metadata: {
            bookingId: booking.bookingId,
            expertId: booking.expertId,
            userId: booking.userId
          }
        });
        
        // Store payment intent in database for refund tracking
        await bookingService.createPaymentRecord({
          bookingId: booking.bookingId,
          stripePaymentIntentId: paymentIntent.id,
          amountCents: booking.priceCents,
          currency: 'usd',
          platformFeeCents: booking.platformFeeCents || 0,
          responderPayoutCents: booking.responderPayoutCents || 0
        });
        
        res.status(201).json({
          success: true,
          data: {
            ...booking,
            requiresPayment: true,
            paymentIntentClientSecret: paymentIntent.client_secret
          }
        });
      } else {
        // Free booking - confirmed immediately
        res.status(201).json({
          success: true,
          data: {
            ...booking,
            requiresPayment: false
          }
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/me/bookings
 * Get current user's bookings
 */
router.get(
  '/users/me/bookings',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const status = req.query.status as 'upcoming' | 'past' | 'canceled' | undefined;

      const bookings = await bookingService.getUserBookings(userId, status);

      res.json({
        success: true,
        data: bookings
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
router.get(
  '/bookings/:bookingId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookingId } = req.params;
      const userId = req.user!.id;

      const booking = await bookingService.getBookingById(bookingId);

      // Check authorization
      if (booking.userId !== userId && booking.expertId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'Not authorized to view this booking');
      }

      res.json({
        success: true,
        data: booking
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/bookings/:bookingId/cancel
 * Cancel a booking
 */
router.post(
  '/bookings/:bookingId/cancel',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookingId } = req.params;
      const userId = req.user!.id;
      const validation = cancelBookingSchema.safeParse(req.body);

      if (!validation.success) {
        throw new ApiError(400, 'INVALID_REQUEST', validation.error.message);
      }

      const booking = await bookingService.getBookingById(bookingId);

      // Check authorization
      if (booking.userId !== userId && booking.expertId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'Not authorized to cancel this booking');
      }

      const cancelledBooking = await bookingService.cancelBooking(
        bookingId,
        userId,
        validation.data.reason
      );

      res.json({
        success: true,
        data: cancelledBooking
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/bookings/:bookingId/reschedule
 * Reschedule a booking
 */
router.post(
  '/bookings/:bookingId/reschedule',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookingId } = req.params;
      const userId = req.user!.id;
      const validation = rescheduleBookingSchema.safeParse(req.body);

      if (!validation.success) {
        throw new ApiError(400, 'INVALID_REQUEST', validation.error.message);
      }

      const booking = await bookingService.getBookingById(bookingId);

      // Only users can reschedule (experts must cancel)
      if (booking.userId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'Only booking creator can reschedule');
      }

      const rescheduledBooking = await bookingService.rescheduleBooking(
        bookingId,
        new Date(validation.data.newStartTime),
        new Date(validation.data.newEndTime),
        userId
      );

      res.json({
        success: true,
        data: rescheduledBooking
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/experts/calendar/callback
 * Google Calendar OAuth callback (public endpoint)
 */
router.get(
  '/experts/calendar/callback',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state } = req.query as { code: string; state: string };

      if (!code || !state) {
        throw new ApiError(400, 'INVALID_REQUEST', 'Missing code or state parameter');
      }

      // state contains expertId
      const expertId = state;

      await googleCalendarService.handleGoogleCallback(code, expertId);

      // Redirect to success page
      res.redirect(`${process.env.APP_URL}/expert/availability?calendar=connected`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/bookings/:bookingId/confirm-payment
 * Confirm payment and update booking status from awaiting_payment to scheduled
 */
router.post(
  '/bookings/:bookingId/confirm-payment',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookingId } = req.params;
      const userId = req.user!.id;

      // Get booking to verify ownership
      const booking = await bookingService.getBookingById(bookingId);
      
      if (booking.userId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'You can only confirm payment for your own bookings');
      }

      if (booking.status !== 'awaiting_payment') {
        throw new ApiError(400, 'INVALID_STATUS', `Booking status is ${booking.status}, expected awaiting_payment`);
      }

      // Update booking status to scheduled
      await bookingService.updateBookingStatus(bookingId, 'scheduled', userId);

      // Update payment status to succeeded
      await bookingService.updatePaymentStatus(bookingId, 'succeeded');

      res.json({
        success: true,
        message: 'Payment confirmed, booking is now scheduled'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
