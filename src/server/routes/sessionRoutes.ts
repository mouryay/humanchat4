import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authenticatedLimiter } from '../middleware/rateLimit.js';
import { success } from '../utils/apiResponse.js';
import {
  createSessionRecord,
  getSessionById,
  updateSessionStatus,
  markSessionStart,
  markSessionEnd
} from '../services/sessionService.js';

const router = Router();

const createSchema = z.object({
  host_user_id: z.string().uuid(),
  guest_user_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  type: z.enum(['instant', 'scheduled']),
  start_time: z.string().datetime(),
  duration_minutes: z.number().min(15),
  agreed_price: z.number().nonnegative(),
  payment_mode: z.enum(['free', 'paid', 'charity'])
});

router.post('/', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = createSchema.parse(req.body);
    const session = await createSessionRecord(payload);
    success(res, { session }, 201);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const session = await getSessionById(req.params.id);
    success(res, { session });
  } catch (error) {
    next(error);
  }
});

const statusSchema = z.object({ status: z.enum(['pending', 'in_progress', 'complete']) });

router.patch('/:id/status', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = statusSchema.parse(req.body);
    const session = await updateSessionStatus(req.params.id, payload.status);
    success(res, { session });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/start', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const session = await markSessionStart(req.params.id);
    success(res, { session });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/end', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const session = await markSessionEnd(req.params.id);
    success(res, { session });
  } catch (error) {
    next(error);
  }
});

export default router;
