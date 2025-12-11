import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionRenderer from '../ActionRenderer';
import type { Action, ProfileSummary } from '../../../../src/lib/db';
import { searchProfiles } from '../../services/profileApi';

jest.mock('../../services/profileApi', () => ({
  searchProfiles: jest.fn()
}));

const searchProfilesMock = searchProfiles as jest.MockedFunction<typeof searchProfiles>;

describe('ActionRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchProfilesMock.mockResolvedValue([]);
  });

  it('omits profiles that match the current user id', () => {
    const selfProfile: ProfileSummary = {
      userId: 'user-123',
      name: 'Self Person',
      conversationType: 'paid',
      instantRatePerMinute: 5,
      scheduledRates: [],
      isOnline: true,
      hasActiveSession: false
    };

    const otherProfile: ProfileSummary = {
      userId: 'member-456',
      name: 'River Product',
      conversationType: 'paid',
      instantRatePerMinute: 15,
      scheduledRates: [],
      isOnline: true,
      hasActiveSession: false
    };

    const action = {
      type: 'show_profiles',
      profiles: [selfProfile, otherProfile]
    } as Action;

    render(<ActionRenderer action={action} currentUserId="user-123" />);

    expect(screen.queryByText('Self Person')).not.toBeInTheDocument();
    expect(screen.getByText('River Product')).toBeInTheDocument();
  });

  it('only renders profiles confirmed online when directory data is present', () => {
    const offlineProfile: ProfileSummary = {
      userId: 'member-offline',
      name: 'Offline Mentor',
      conversationType: 'paid',
      instantRatePerMinute: 20,
      scheduledRates: [],
      isOnline: false,
      hasActiveSession: false
    };

    const onlineProfile: ProfileSummary = {
      userId: 'member-online',
      name: 'Online Mentor',
      conversationType: 'paid',
      instantRatePerMinute: 12,
      scheduledRates: [],
      isOnline: true,
      hasActiveSession: false
    };

    const action = {
      type: 'show_profiles',
      profiles: [offlineProfile, onlineProfile]
    } as Action;

    render(
      <ActionRenderer
        action={action}
        currentUserId="viewer"
        directoryProfiles={[onlineProfile]}
      />
    );

    expect(screen.getByText('Online Mentor')).toBeInTheDocument();
    expect(screen.queryByText('Offline Mentor')).not.toBeInTheDocument();
  });

  it('shows connect controls for showcase-only profiles and hydrates on demand', async () => {
    const action = {
      type: 'show_profiles',
      profiles: [
        {
          name: 'Coach Sunny',
          headline: 'Leadership coach',
          status: 'available',
          expertise: ['Leadership'],
          rate_per_minute: 12
        }
      ]
    } as Action;

    const hydratedProfile: ProfileSummary = {
      userId: 'coach-1',
      name: 'Coach Sunny',
      conversationType: 'free',
      scheduledRates: [],
      isOnline: true,
      hasActiveSession: false
    };

    searchProfilesMock.mockResolvedValueOnce([hydratedProfile]);

    const onConnectNow = jest.fn();
    render(<ActionRenderer action={action} onConnectNow={onConnectNow} />);

    const user = userEvent.setup();
    const connectButton = await screen.findByRole('button', { name: /connect now/i });
    await user.click(connectButton);

    await waitFor(() => expect(onConnectNow).toHaveBeenCalledWith(hydratedProfile));
  });
});
