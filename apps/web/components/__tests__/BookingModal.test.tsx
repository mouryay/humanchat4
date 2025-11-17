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

const fetchSlotsMock = jest.fn().mockResolvedValue([stubSlot]);
const createSessionMock = jest.fn().mockResolvedValue({ sessionId: 'session-123' });
const sendSamMessageMock = jest.fn().mockResolvedValue({ text: 'Booking logged' });
const reminderMock = jest.fn().mockResolvedValue(undefined);
const getCurrentUserIdMock = jest.fn(() => 'guest-user');

jest.mock('../../services/bookingService', () => ({
  fetchAvailableSlots: () => fetchSlotsMock(),
  createPendingSession: (...args: unknown[]) => createSessionMock(...args)
}));

jest.mock('../CalendarSlotPicker', () => ({
  __esModule: true,
  default: ({ onSelect }: { onSelect: (slot: typeof stubSlot, duration: number, price: number) => void }) => (
    <button type="button" onClick={() => onSelect(stubSlot, 30, 220)}>
      Select
    </button>
  )
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

describe('BookingModal', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });
  beforeEach(() => {
    fetchSlotsMock.mockClear();
    createSessionMock.mockClear();
    sendSamMessageMock.mockClear();
    reminderMock.mockClear();
  });

  it('walks through slot selection and confirmation', async () => {
    const profile: ProfileSummary = {
      userId: 'mentor-9',
      name: 'River Product',
      conversationType: 'paid',
      instantRatePerMinute: 12,
      scheduledRates: [{ durationMinutes: 30, price: 220 }],
      isOnline: true
    };
    const conversation: Conversation = {
      conversationId: 'conv-1',
      type: 'human',
      participants: ['guest-user', 'mentor-9'],
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

    await screen.findAllByText(/select/i);
    const selectButton = screen.getByRole('button', { name: /^select$/i });
    await user.click(selectButton);

    expect(screen.getByRole('button', { name: /confirm booking/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /confirm booking/i }));

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith({
        hostUserId: 'mentor-9',
        guestUserId: 'guest-user',
        conversationId: 'conv-1',
        startTime: '2025-11-10T18:00:00Z',
        durationMinutes: 30,
        price: 220
      });
    });

    expect(sendSamMessageMock).toHaveBeenCalled();
    expect(reminderMock).toHaveBeenCalledWith(expect.any(Number), 'River Product');
    expect(await screen.findByText(/booked! you'll get a reminder/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(onClose).toHaveBeenCalled();
  });
});
