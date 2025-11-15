import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authenticatedLimiter } from '../middleware/rateLimit.js';
import { success } from '../utils/apiResponse.js';
import { connectCalendar, fetchCalendarAvailability, triggerCalendarSync } from '../services/calendarService.js';

const router = Router();

const connectSchema = z.object({
  provider: z.enum(['google', 'microsoft', 'apple']),
  accountEmail: z.string().email(),
  calendarId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string()
});

router.post('/connect', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = connectSchema.parse(req.body);
    await connectCalendar({ userId: req.user!.id, ...payload });
    success(res, { connected: true }, 201);
  } catch (error) {
    next(error);
  }
});

router.get('/availability', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const availability = await fetchCalendarAvailability(req.user!.id);
    success(res, availability);
  } catch (error) {
    next(error);
  }
});

router.post('/sync', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const response = await triggerCalendarSync(req.user!.id);
    success(res, response);
  } catch (error) {
    next(error);
  }
});

export default router;
