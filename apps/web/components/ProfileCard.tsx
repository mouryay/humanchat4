'use client';

import { useMemo, useState } from 'react';
import type { ProfileSummary } from '../../../src/lib/db';
import StatusBadge from './StatusBadge';
import RateDisplay from './RateDisplay';
import { useSessionStatus, type PrefetchedSessionStatus } from '../hooks/useSessionStatus';

const HUMAN_FALLBACK = 'Human';

const ensureHumanCopy = (value?: string | null): string => {
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

interface ProfileCardProps {
  profile: ProfileSummary;
  onConnectNow?: (profile: ProfileSummary) => void;
  onBookTime?: (profile: ProfileSummary) => void;
  isConnecting?: boolean;
  disableLiveStatus?: boolean;
  prefetchedStatus?: PrefetchedSessionStatus | null;
}

export default function ProfileCard({
  profile,
  onConnectNow,
  onBookTime,
  isConnecting,
  disableLiveStatus,
  prefetchedStatus
}: ProfileCardProps) {
  const [showDetails, setShowDetails] = useState(false);
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
  const tooltip = (() => {
    if (managedConfidential) {
      return 'This profile handles chats via private requests. Use Schedule.';
    }
    if (hasActiveSession) {
      return 'Currently in a call';
    }
    if (!isOnline) {
      return 'Offline right now';
    }
    return undefined;
  })();
  const headlineCopy = ensureHumanCopy(profile.headline);
  const avatarSrc =
    profile.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name ?? 'Human')}&background=3B82F6&color=fff&size=128`;
  const contributionBlurb = useMemo(() => {
    if (managedConfidential) {
      return `${profile.name ?? 'This talent'} keeps these chats private. Send a request and their team will coordinate the details.`;
    }
    if (profile.conversationType === 'charity' && profile.instantRatePerMinute) {
      return `${profile.name} charges $${profile.instantRatePerMinute.toFixed(2)}/min — all proceeds go to ${profile.charityName ?? 'their charity partner'}.`;
    }
    if (profile.conversationType === 'free' && profile.donationPreference === 'on') {
      return `${profile.name} talks for free and accepts tips.`;
    }
    if (profile.conversationType === 'paid' && profile.donationPreference === 'on') {
      return `${profile.name} offers paid sessions with optional donations.`;
    }
    return null;
  }, [managedConfidential, profile.conversationType, profile.donationPreference, profile.instantRatePerMinute, profile.name, profile.charityName]);

  const secondaryLabel = managedConfidential ? 'Send Request' : 'Schedule';
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

  const renderActions = (compact = false) => (
    <div className="flex gap-2 w-full">
      {!managedConfidential && (
        <div className="relative group flex-1 min-w-0">
          <button
            className={`w-full font-semibold rounded-xl transition-all duration-base ease-out bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'px-3 py-2.5 text-sm' : 'px-5 py-3'}`}
            type="button"
            disabled={Boolean(isConnecting)}
            onClick={() => !isConnecting && onConnectNow?.(profile)}
          >
            {isConnecting ? 'Connecting…' : 'Connect'}
          </button>
          {tooltip && (
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-background-elevated border border-border-medium rounded-lg text-xs text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-base pointer-events-none z-10">
              {tooltip}
            </span>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <button 
          className={`w-full font-semibold rounded-xl transition-all duration-base ease-out disabled:opacity-50 disabled:cursor-not-allowed ${managedConfidential ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30' : 'bg-background-tertiary text-text-primary border border-border-medium hover:bg-background-hover hover:border-border-strong'} ${compact ? 'px-3 py-2.5 text-sm' : 'px-5 py-3'}`}
          type="button" 
          onClick={() => onBookTime?.(profile)}
        >
          {secondaryLabel}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Premium Profile Card */}
      <article className="card-premium p-4 w-full">
        {/* Header with avatar and name */}
        <div className="flex items-center gap-3 mb-3">
          <img 
            src={avatarSrc} 
            alt={profile.name} 
            className="h-12 w-12 avatar-chamfered object-cover ring-2 ring-border-subtle flex-shrink-0" 
            loading="lazy" 
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-text-primary truncate">{profile.name}</h3>
            <p className="text-xs text-text-secondary truncate">{headlineCopy}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-3">
          <StatusBadge isOnline={isOnline} hasActiveSession={hasActiveSession} presenceState={presenceState} />
        </div>

        {/* Rate display (compact) */}
        <div className="mb-3">
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

        {/* Actions */}
        {renderActions(true)}

        {/* See Full Profile Button */}
        <button 
          className="mt-3 w-full text-xs font-medium text-accent-primary hover:text-accent-hover transition-colors duration-base"
          type="button" 
          onClick={() => setShowDetails(true)}
        >
          See full profile →
        </button>
      </article>

      {/* Premium Full Profile Modal */}
      {showDetails && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          role="dialog" 
          aria-modal="true" 
          onClick={() => setShowDetails(false)}
        >
          <div 
            className="relative card-premium p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all duration-base z-10"
              type="button" 
              aria-label="Close profile" 
              onClick={() => setShowDetails(false)}
            >
              ×
            </button>

            {/* Header */}
            <div className="flex items-center gap-5 mb-5">
              <img 
                src={avatarSrc} 
                alt={profile.name} 
                className="h-16 w-16 sm:h-20 sm:w-20 avatar-chamfered object-cover ring-2 ring-border-medium flex-shrink-0" 
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-semibold text-text-primary mb-1 truncate">{profile.name}</h2>
                <p className="text-sm text-text-secondary">{headlineCopy}</p>
                <div className="mt-2">
                  <StatusBadge isOnline={isOnline} hasActiveSession={hasActiveSession} presenceState={presenceState} />
                </div>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="mb-5">
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{profile.bio}</p>
              </div>
            )}

            {/* Rate & Pricing */}
            <div className="mb-5">
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

            {contributionBlurb && (
              <p className="mb-5 text-sm text-text-tertiary leading-relaxed">{contributionBlurb}</p>
            )}

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="mb-5">
                <h4 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Links</h4>
                <div className="flex flex-wrap gap-2">
                  {socialLinks.map((link) => (
                    <a 
                      key={link.key} 
                      href={link.url} 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-sm text-accent-primary hover:text-accent-hover transition-all duration-base"
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span className="text-white/40 text-xs">{link.label}</span>
                      <span className="font-medium truncate max-w-[140px]">{link.display}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {renderActions()}
          </div>
        </div>
      )}
    </>
  );
}
