export interface CalendarSlot {
  id: string;
  start: string;
  end: string;
  status: 'open' | 'blocked';
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const FALLBACK_SLOTS: CalendarSlot[] = [
  {
    id: 'fallback-1',
    start: '2025-11-07T18:00:00Z',
    end: '2025-11-07T18:30:00Z',
    status: 'open'
  },
  {
    id: 'fallback-2',
    start: '2025-11-07T19:00:00Z',
    end: '2025-11-07T19:45:00Z',
    status: 'open'
  }
];

const normalizeSlots = (slots: Array<{ id?: string; start: string; end: string; status?: string }>): CalendarSlot[] => {
  return slots
    .map((slot, index) => {
      const status: CalendarSlot['status'] = slot.status === 'blocked' ? 'blocked' : 'open';
      return {
        id: slot.id ?? `slot-${index}`,
        start: slot.start,
        end: slot.end,
        status
      };
    })
    .filter((slot) => slot.start && slot.end);
};

export const fetchAvailableSlots = async (): Promise<CalendarSlot[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/calendar/availability`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(detail || 'Failed to fetch calendar availability');
    }

    const payload = await response.json();
    const slots = Array.isArray(payload?.slots) ? normalizeSlots(payload.slots) : [];
    return slots.length > 0 ? slots : FALLBACK_SLOTS;
  } catch (error) {
    console.warn('Falling back to sample slots', error);
    return FALLBACK_SLOTS;
  }
};

interface CreateSessionInput {
  hostUserId: string;
  guestUserId: string;
  conversationId: string;
  startTime: string;
  durationMinutes: number;
  price: number;
}

export const createPendingSession = async (input: CreateSessionInput) => {
  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({
      host_user_id: input.hostUserId,
      guest_user_id: input.guestUserId,
      conversation_id: input.conversationId,
      type: 'scheduled',
      start_time: input.startTime,
      duration_minutes: input.durationMinutes,
      agreed_price: input.price,
      payment_mode: input.price > 0 ? 'paid' : 'free'
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Unable to create session');
  }

  const payload = await response.json();
  return payload.session;
};
