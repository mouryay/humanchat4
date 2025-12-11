import { http, HttpResponse } from 'msw';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const sampleSlots = [
  {
    id: 'slot-1',
    start: '2025-11-10T18:00:00Z',
    end: '2025-11-10T18:30:00Z',
    status: 'open'
  },
  {
    id: 'slot-2',
    start: '2025-11-10T19:00:00Z',
    end: '2025-11-10T19:45:00Z',
    status: 'open'
  }
];

const sampleSession = {
  sessionId: 'session-msw-1',
  conversationId: 'sam-concierge',
  hostUserId: 'member-1',
  guestUserId: 'demo-user',
  type: 'scheduled',
  status: 'pending',
  startTime: Date.now() + 60 * 60 * 1000,
  durationMinutes: 30,
  agreedPrice: 150,
  paymentMode: 'paid'
};

export const handlers = [
  http.get(`${API_BASE_URL}/api/calendar/availability`, () => {
    return HttpResponse.json({ slots: sampleSlots });
  }),
  http.post(`${API_BASE_URL}/api/sessions`, async ({ request }) => {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return HttpResponse.json({ session: { ...sampleSession, ...payload } }, { status: 201 });
  }),
  http.post(`${API_BASE_URL}/api/sam/chat`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { message?: string };
    return HttpResponse.json({
      text: `Sam received: ${body.message ?? 'test message'}`,
      actions: [
        {
          type: 'show_profiles',
          profiles: [
            {
              userId: 'member-1',
              name: 'Jordan Rivera',
              headline: 'Product strategist',
              conversationType: 'paid',
              instantRatePerMinute: 12,
              isOnline: true,
              hasActiveSession: false
            }
          ]
        }
      ]
    });
  }),
  http.post(`${API_BASE_URL}/api/payments/intent`, async ({ request }) => {
    const payload = (await request.json().catch(() => ({}))) as { amount?: number };
    return HttpResponse.json({ intent: { id: 'pi_test_123', amount: payload?.amount ?? 0 } });
  }),
  http.post(`${API_BASE_URL}/api/payments/capture`, () => {
    return HttpResponse.json({ success: true });
  }),
  http.post(`${API_BASE_URL}/api/sessions/:id/start`, ({ params }) => {
    return HttpResponse.json({ session: { ...sampleSession, sessionId: params.id, status: 'in_progress' } });
  }),
  http.post(`${API_BASE_URL}/api/sessions/:id/end`, ({ params }) => {
    return HttpResponse.json({ session: { ...sampleSession, sessionId: params.id, status: 'complete' } });
  }),
  http.patch(`${API_BASE_URL}/api/sessions/:id/status`, ({ params }) => {
    return HttpResponse.json({ session: { ...sampleSession, sessionId: params.id, status: 'in_progress' } });
  })
];
