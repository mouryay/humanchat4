'use client';

import { useMemo, useState } from 'react';
import type { ProfileSummary } from '../../../src/lib/db';
import StatusBadge from './StatusBadge';
import RateDisplay from './RateDisplay';
import { useSessionStatus, type PrefetchedSessionStatus } from '../hooks/useSessionStatus';

const HUMAN_FALLBACK = 'Human';

const ensureCopy = (value?: string | null): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : HUMAN_FALLBACK;
};

const SOCIAL_LINK_FIELDS = [
  { key: 'linkedinUrl', label: 'LinkedIn' },
  { key: 'facebookUrl', label: 'Facebook' },
  { key: 'instagramUrl', label: 'Instagram' },
  { key: 'quoraUrl', label: 'Quora' },
  { key: 'mediumUrl', label: 'Medium' },
  { key: 'youtubeUrl', label: 'YouTube' },
  { key: 'otherSocialUrl', label: 'Website' }
] as const;

type SocialLinkKey = (typeof SOCIAL_LINK_FIELDS)[number]['key'];

interface SocialLinkEntry {
  key: SocialLinkKey;
  label: string;
  url: string;
  display: string;
}

const deriveDisplayUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return value;
  }
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
  const [showDetails, setShowDetails] = useState(false);
  const headlineCopy = ensureCopy(profile.headline);
  const bioPreview = (profile.bio ?? '').trim().length > 0 ? profile.bio?.trim() : headlineCopy;
  const avatarSrc =
    profile.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name ?? 'Human')}&background=3B82F6&color=fff&size=96`;
  const socialLinks = useMemo<SocialLinkEntry[]>(() => {
    return SOCIAL_LINK_FIELDS.reduce<SocialLinkEntry[]>((acc, field) => {
      const value = profile[field.key];
      if (!value) {
        return acc;
      }
      acc.push({
        key: field.key,
        label: field.label,
        url: value,
        display: deriveDisplayUrl(value)
      });
      return acc;
    }, []);
  }, [profile]);

  return (
    <>
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
            <button
              type="button"
              className="mt-2 text-xs font-medium text-blue-300 transition hover:text-blue-200"
              onClick={() => setShowDetails(true)}
            >
              View full profile
            </button>
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

      {showDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowDetails(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#0c0f17] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-4 top-4 h-8 w-8 rounded-lg bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
              onClick={() => setShowDetails(false)}
              aria-label="Close profile"
            >
              ×
            </button>
            <div className="mb-4 flex items-center gap-4">
              <img src={avatarSrc} alt={profile.name ?? 'Human'} className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/20" />
              <div className="min-w-0">
                <h3 className="truncate text-xl font-semibold text-white">{profile.name ?? 'Human'}</h3>
                <p className="text-sm text-white/65">{headlineCopy}</p>
                <div className="mt-2">
                  <StatusBadge isOnline={isOnline} hasActiveSession={hasActiveSession} presenceState={presenceState} />
                </div>
              </div>
            </div>
            <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-white/80">
              {(profile.bio ?? '').trim() || headlineCopy}
            </p>
            <div className="mb-4">
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
            {socialLinks.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/45">Links</p>
                <div className="flex flex-wrap gap-2">
                  {socialLinks.map((link) => (
                    <a
                      key={link.key}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-blue-200 transition hover:bg-white/[0.08]"
                    >
                      <span className="text-white/50">{link.label}</span>
                      <span>{link.display}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
