'use client';

import type { ProfileSummary } from '../../../src/lib/db';
import StatusBadge from './StatusBadge';
import RateDisplay from './RateDisplay';
import { useSessionStatus, type PrefetchedSessionStatus } from '../hooks/useSessionStatus';

const HUMAN_FALLBACK = 'Human';

const ensureCopy = (value?: string | null): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : HUMAN_FALLBACK;
};

interface ProfileListRowProps {
  profile: ProfileSummary;
  onConnectNow?: (profile: ProfileSummary) => void;
  onBookTime?: (profile: ProfileSummary) => void;
  isConnecting?: boolean;
  disableLiveStatus?: boolean;
  prefetchedStatus?: PrefetchedSessionStatus | null;
}

export default function ProfileListRow({
  profile,
  onConnectNow,
  onBookTime,
  isConnecting,
  disableLiveStatus,
  prefetchedStatus
}: ProfileListRowProps) {
  const {
    isOnline: liveOnline,
    hasActiveSession: liveActiveSession,
    presenceState: livePresence,
    isLoading: statusLoading
  } = useSessionStatus(profile.userId, {
    disabled: disableLiveStatus,
    prefetchedStatus
  });

  const allowLiveStatus = Boolean(profile.userId) && !disableLiveStatus;
  const hasLiveStatus = allowLiveStatus && !statusLoading;
  const fallbackPresence = profile.presenceState ?? (profile.isOnline ? 'active' : 'offline');
  const isOnline = hasLiveStatus ? liveOnline : Boolean(profile.isOnline);
  const hasActiveSession = hasLiveStatus ? liveActiveSession : Boolean(profile.hasActiveSession);
  const presenceState = hasLiveStatus ? livePresence : fallbackPresence;

  const managedConfidential = Boolean(profile.managed && profile.confidentialRate);
  const canInstantConnect = !managedConfidential;
  const headlineCopy = ensureCopy(profile.headline);
  const bioPreview = (profile.bio ?? '').trim().length > 0 ? profile.bio?.trim() : headlineCopy;
  const avatarSrc =
    profile.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name ?? 'Human')}&background=3B82F6&color=fff&size=96`;

  return (
    <article className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.05]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={avatarSrc}
              alt={profile.name ?? 'Human'}
              className="h-11 w-11 flex-shrink-0 rounded-xl object-cover ring-1 ring-white/20"
              loading="lazy"
            />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-white">{profile.name ?? 'Human'}</h3>
              <p className="truncate text-xs text-white/65">{headlineCopy}</p>
            </div>
            <div className="ml-auto flex-shrink-0">
              <StatusBadge isOnline={isOnline} hasActiveSession={hasActiveSession} presenceState={presenceState} />
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/70">
            {bioPreview}
          </p>
        </div>

        <div className="xl:w-[280px] xl:flex-shrink-0">
          <RateDisplay
            conversationType={profile.conversationType}
            confidentialRate={profile.confidentialRate}
            displayMode={profile.displayMode}
            instantRatePerMinute={profile.instantRatePerMinute}
            scheduledRates={profile.scheduledRates}
            isOnline={isOnline}
            charityName={profile.charityName}
            donationPreference={profile.donationPreference}
          />
        </div>

        <div className="flex w-full gap-2 xl:w-[230px] xl:flex-shrink-0">
          {canInstantConnect && (
            <button
              type="button"
              className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:shadow-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(isConnecting)}
              onClick={() => !isConnecting && onConnectNow?.(profile)}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          )}
          <button
            type="button"
            className="flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/[0.08]"
            onClick={() => onBookTime?.(profile)}
          >
            {managedConfidential ? 'Request' : 'Schedule'}
          </button>
        </div>
      </div>
    </article>
  );
}
