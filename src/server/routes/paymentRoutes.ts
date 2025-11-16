import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authenticatedLimiter } from '../middleware/rateLimit.js';
import { success } from '../utils/apiResponse.js';
import {
  createPaymentIntent,
  capturePayment,
  refundPayment,
  transferToHost,
  processDonation,
  createStripeConnectLink,
  generateReceipt
} from '../services/stripeService.js';
import { z } from 'zod';

const router = Router();

const intentSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().min(3).max(4).default('usd'),
  sessionId: z.string().uuid().optional(),
  captureMethod: z.enum(['automatic', 'manual']).optional(),
  mode: z.enum(['instant', 'scheduled', 'charity', 'donation']).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  charityAccountId: z.string().optional(),
  waivePlatformFee: z.boolean().optional()
});

router.post('/intent', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = intentSchema.parse(req.body);
    const intent = await createPaymentIntent(payload.amount, payload.metadata, {
      sessionId: payload.sessionId,
      currency: payload.currency,
      captureMethod: payload.captureMethod,
      mode: payload.mode,
      charityAccountId: payload.charityAccountId,
      waiver: payload.waivePlatformFee
    });
    success(res, { intent }, 201);
  } catch (error) {
    next(error);
  }
});

router.post('/capture', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const schema = z.object({ paymentIntentId: z.string(), finalAmount: z.number().int().positive().optional() });
    const { paymentIntentId, finalAmount } = schema.parse(req.body);
    const intent = await capturePayment(paymentIntentId, finalAmount);
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

router.post('/transfer', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const schema = z.object({ sessionId: z.string().uuid(), amount: z.number().int().positive().optional() });
    const { sessionId, amount } = schema.parse(req.body);
    const transfer = await transferToHost(sessionId, amount);
    success(res, { transfer });
  } catch (error) {
    next(error);
  }
});

router.post('/donation', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const schema = z.object({ sessionId: z.string().uuid(), amount: z.number().int().positive(), currency: z.string().min(3).max(4).default('usd') });
    const { sessionId, amount, currency } = schema.parse(req.body);
    const result = await processDonation(sessionId, amount, currency);
    success(res, result);
  } catch (error) {
    next(error);
  }
});

router.post('/connect-link', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const schema = z.object({ returnPath: z.string().optional() });
    const { returnPath } = schema.parse(req.body ?? {});
    const link = await createStripeConnectLink(req.user!.id, returnPath);
    success(res, link);
  } catch (error) {
    next(error);
  }
});

router.get('/session/:sessionId/receipt', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const schema = z.object({ sessionId: z.string().uuid() });
    const { sessionId } = schema.parse(req.params);
    const receipt = await generateReceipt(sessionId);
    success(res, { receipt });
  } catch (error) {
    next(error);
  }
});

export default router;
