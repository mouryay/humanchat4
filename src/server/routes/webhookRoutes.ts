import express, { Router } from 'express';
import { success } from '../utils/apiResponse.js';
import { verifyStripeSignature, handleStripeEvent } from '../services/stripeService.js';
import { env } from '../config/env.js';

const router = Router();

router.post('/stripe', express.raw({ type: 'application/json' }), (req, res, next) => {
  try {
    const signatureHeader = req.headers['stripe-signature'];
    if (!signatureHeader || Array.isArray(signatureHeader)) {
      throw new Error('Missing Stripe signature header');
    }
    const event = verifyStripeSignature(req.body as Buffer, signatureHeader, env.stripeWebhookSecret);
    void handleStripeEvent(event);
    success(res, { received: event.id });
  } catch (error) {
    next(error);
  }
});

export default router;
