const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const handleResponse = async (response: Response, fallbackMessage: string) => {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || fallbackMessage);
  }
  return response.json().catch(() => ({}));
};

export const markSessionStart = async (sessionId: string) => {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/start`, {
    method: 'POST',
    credentials: 'include'
  });
  return handleResponse(response, 'Failed to mark session start');
};

export const markSessionComplete = async (sessionId: string) => {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/end`, {
    method: 'POST',
    credentials: 'include'
  });
  return handleResponse(response, 'Failed to mark session end');
};

export const updateSessionStatus = async (sessionId: string, status: 'pending' | 'in_progress' | 'complete') => {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return handleResponse(response, 'Failed to update session status');
};

export interface PaymentSummary {
  paymentIntentId?: string;
  amount: number;
  currency: string;
}

type PaymentMode = 'instant' | 'scheduled' | 'charity';

interface SessionPaymentOptions {
  currency?: string;
  captureMethod?: 'automatic' | 'manual';
  finalAmount?: number;
  mode?: PaymentMode;
}

export const processSessionPayment = async (
  amount: number,
  sessionId: string,
  { currency = 'usd', captureMethod = 'manual', finalAmount, mode = 'instant' }: SessionPaymentOptions = {}
): Promise<PaymentSummary> => {
  const cents = Math.max(0, Math.round(amount * 100));
  const finalCents = typeof finalAmount === 'number' ? Math.max(0, Math.round(finalAmount * 100)) : undefined;
  if (cents === 0) {
    return { amount, currency };
  }

  const intentResponse = await fetch(`${API_BASE_URL}/api/payments/intent`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: cents,
      currency,
      sessionId,
      mode,
      captureMethod,
      metadata: { sessionId, paymentMode: mode }
    })
  });
  const { intent } = await handleResponse(intentResponse, 'Failed to create payment intent');

  const captureResponse = await fetch(`${API_BASE_URL}/api/payments/capture`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentIntentId: intent?.id, finalAmount: finalCents ?? cents })
  });
  await handleResponse(captureResponse, 'Failed to capture payment');

  return { paymentIntentId: intent?.id, amount, currency };
};

export const initiateDonation = async (sessionId: string, amountCents: number, currency: string = 'usd'): Promise<{ checkoutUrl: string | null; amount: number }> => {
  const response = await fetch(`${API_BASE_URL}/api/payments/donation`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, amount: amountCents, currency })
  });
  return handleResponse(response, 'Failed to start donation');
};
