import type { ProfileSummary } from '../../../src/lib/db';
import type { PresenceState } from '../services/sessionStatusManager';
import type { PrefetchedSessionStatus } from '../hooks/useSessionStatus';

const isPresenceState = (value: unknown): value is PresenceState => {
  return value === 'active' || value === 'idle' || value === 'offline';
};

export const deriveProfilePresence = (
  profile?: Pick<ProfileSummary, 'presenceState' | 'isOnline'> | null
): PresenceState => {
  if (profile && isPresenceState(profile.presenceState)) {
    return profile.presenceState;
  }
  return profile?.isOnline ? 'active' : 'offline';
};

export const toPrefetchedStatus = (profile?: ProfileSummary | null): PrefetchedSessionStatus | null => {
  if (!profile) {
    return null;
  }
  return {
    isOnline: Boolean(profile.isOnline),
    hasActiveSession: Boolean(profile.hasActiveSession),
    presenceState: deriveProfilePresence(profile)
  };
};
