import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authenticatedLimiter } from '../middleware/rateLimit.js';
import { success } from '../utils/apiResponse.js';
import {
  listRequestedPeople,
  logRequestedPersonInterest,
  updateRequestedPersonStatus
} from '../services/requestedPeopleService.js';

const router = Router();

const logSchema = z.object({
  requestedName: z.string().min(2),
  searchQuery: z.string().min(1)
});

router.post('/log', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = logSchema.parse(req.body);
    const person = await logRequestedPersonInterest({
      requestedName: payload.requestedName,
      searchQuery: payload.searchQuery,
      userId: req.user!.id
    });
    success(res, { person }, 201);
  } catch (error) {
    next(error);
  }
});

const STATUS_VALUES = ['pending', 'contacted', 'declined', 'onboarded'] as const;

router.get('/', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status = STATUS_VALUES.find((value) => value === statusParam);
    const people = await listRequestedPeople(status);
    success(res, { people });
  } catch (error) {
    next(error);
  }
});

const updateSchema = z.object({
  status: z.enum(STATUS_VALUES)
});

router.patch('/:normalizedName/status', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = updateSchema.parse(req.body);
    const person = await updateRequestedPersonStatus(req.params.normalizedName, payload.status);
    success(res, { person });
  } catch (error) {
    next(error);
  }
});

export default router;
