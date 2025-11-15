import Stripe from 'stripe';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { query } from '../db/postgres.js';

const stripe = new Stripe(env.stripeSecretKey);

export const createPaymentIntent = async (amount: number, currency: string, metadata?: Record<string, string>) => {
  if (amount <= 0) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Amount must be greater than zero');
  }
  const intent = await stripe.paymentIntents.create({
    amount,
    currency,
    metadata
  });
  return intent;
};

export const capturePayment = async (paymentIntentId: string) => {
  try {
    return await stripe.paymentIntents.capture(paymentIntentId);
  } catch (error) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Failed to capture payment', error);
  }
};

export const refundPayment = async (paymentIntentId: string, amount?: number) => {
  try {
    return await stripe.refunds.create({ payment_intent: paymentIntentId, amount });
  } catch (error) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Failed to refund payment', error);
  }
};

export const verifyStripeSignature = (payload: Buffer, signature: string, secret: string) => {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Invalid webhook signature', error);
  }
};

export const createStripeConnectLink = async (userId: string, returnPath?: string): Promise<{ url: string }> => {
  const userResult = await query<{ email: string; stripe_account_id: string | null }>(
    'SELECT email, stripe_account_id FROM users WHERE id = $1',
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }

  let accountId = user.stripe_account_id ?? null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email
    });
    accountId = account.id;
    await query('UPDATE users SET stripe_account_id = $2 WHERE id = $1', [userId, accountId]);
  }

  const refreshUrl = `${env.appUrl}${returnPath ?? '/settings/payments'}?status=refresh`;
  const returnUrl = `${env.appUrl}${returnPath ?? '/settings/payments'}?status=success`;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding'
  });

  return { url: link.url };
};
