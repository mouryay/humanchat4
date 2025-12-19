/// <reference types="jest" />
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingModal from '../BookingModal';
import type { Conversation, ProfileSummary } from '../../../../src/lib/db';

const stubSlot = {
  id: 'slot-1',
  start: '2025-11-10T18:00:00Z',
  end: '2025-11-10T18:30:00Z',
  status: 'open'
} as const;

const availabilityMock = jest.fn().mockResolvedValue([stubSlot]);
const blockedDatesMock = jest.fn().mockResolvedValue([]);
const weeklyAvailabilityMock = jest.fn().mockResolvedValue([
  { dayOfWeek: 1 },
  { dayOfWeek: 2 },
  { dayOfWeek: 3 },
  { dayOfWeek: 4 },
  { dayOfWeek: 5 }
]);
const sendSamMessageMock = jest.fn().mockResolvedValue({ text: 'Booking logged' });
const reminderMock = jest.fn().mockResolvedValue(undefined);
const getCurrentUserIdMock = jest.fn(() => 'guest-user');
const pushMock = jest.fn();
const createBookingMock = jest.fn().mockResolvedValue({ bookingId: 'booking-123' });

jest.mock('../../services/bookingApi', () => ({
  getExpertAvailability: (...args: unknown[]) => availabilityMock(...args),
  getExpertBlockedDates: (...args: unknown[]) => blockedDatesMock(...args),
  getExpertWeeklyAvailability: (...args: unknown[]) => weeklyAvailabilityMock(...args),
  createBooking: (...args: unknown[]) => createBookingMock(...args)
}));

jest.mock('../../utils/samAPI', () => ({
  sendSamMessage: (...args: unknown[]) => sendSamMessageMock(...args)
}));

jest.mock('../../services/sessionStatusManager', () => ({
  sessionStatusManager: {
    getCurrentUserId: () => getCurrentUserIdMock()
  }
}));

jest.mock('../../utils/notifications', () => ({
  scheduleCallReminder: (...args: unknown[]) => reminderMock(...args)
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => pushMock(...args)
  })
}));

describe('BookingModal', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });
  beforeEach(() => {
    availabilityMock.mockClear();
    blockedDatesMock.mockClear();
    weeklyAvailabilityMock.mockClear();
    sendSamMessageMock.mockClear();
    reminderMock.mockClear();
    pushMock.mockClear();
    createBookingMock.mockClear();
  });

  it('walks through slot selection and confirmation', async () => {
    const profile: ProfileSummary = {
      userId: 'member-9',
      name: 'River Product',
      conversationType: 'paid',
      instantRatePerMinute: 12,
      scheduledRates: [{ durationMinutes: 30, price: 220 }],
      isOnline: true
    };
    const conversation: Conversation = {
      conversationId: 'conv-1',
      type: 'human',
      participants: ['guest-user', 'member-9'],
      lastActivity: Date.now(),
      unreadCount: 0
    };
    const onClose = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await act(async () => {
      render(<BookingModal open profile={profile} conversation={conversation} onClose={onClose} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    await screen.findByRole('button', { name: /select 15 min/i });
    await user.click(screen.getByRole('button', { name: /30 min/i }));
    const selectButton = screen.getByRole('button', { name: /select 30 min/i });
    await user.click(selectButton);

    expect(screen.getByRole('button', { name: /confirm booking/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /confirm booking/i }));

    await waitFor(() => {
      expect(createBookingMock).toHaveBeenCalledWith(
        'member-9',
        expect.objectContaining({
          startTime: '2025-11-10T18:00:00.000Z',
          endTime: '2025-11-10T18:30:00.000Z',
          durationMinutes: 30,
          timezone: expect.any(String)
        })
      );
    });

    expect(sendSamMessageMock).toHaveBeenCalled();
    expect(reminderMock).toHaveBeenCalledWith(expect.any(Number), 'River Product');
    expect(onClose).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith('/bookings/booking-123/confirmation');
  });
});
