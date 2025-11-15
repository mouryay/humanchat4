import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authenticatedLimiter } from '../middleware/rateLimit.js';
import { success } from '../utils/apiResponse.js';
import { createPaymentIntent, capturePayment, refundPayment, verifyStripeSignature } from '../services/paymentService.js';
import { z } from 'zod';

const router = Router();

const intentSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().min(3).max(4),
  metadata: z.record(z.string(), z.string()).optional()
});

router.post('/intent', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = intentSchema.parse(req.body);
    const intent = await createPaymentIntent(payload.amount, payload.currency, payload.metadata);
    success(res, { intent }, 201);
  } catch (error) {
    next(error);
  }
});

router.post('/capture', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const schema = z.object({ paymentIntentId: z.string() });
    const { paymentIntentId } = schema.parse(req.body);
    const intent = await capturePayment(paymentIntentId);
    success(res, { intent });
  } catch (error) {
    next(error);
  }
});

router.post('/refund', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const schema = z.object({ paymentIntentId: z.string(), amount: z.number().int().positive().optional() });
    const { paymentIntentId, amount } = schema.parse(req.body);
    const refund = await refundPayment(paymentIntentId, amount);
    success(res, { refund });
  } catch (error) {
    next(error);
  }
});

export default router;
