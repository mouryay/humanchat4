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
  const canInstantConnect = Boolean(isOnline && !hasActiveSession && !managedConfidential);
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

  const renderActions = () => (
    <div className="flex gap-3">
      {!managedConfidential && (
        <div className="relative group">
          <button
            className="btn-premium btn-premium-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled={!canInstantConnect || Boolean(isConnecting)}
            onClick={() => canInstantConnect && !isConnecting && onConnectNow?.(profile)}
          >
            {isConnecting ? 'Connecting…' : 'Connect Now'}
          </button>
          {tooltip && (
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-background-elevated border border-border-medium rounded-lg text-xs text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-base pointer-events-none z-10">
              {tooltip}
            </span>
          )}
        </div>
      )}
      <button 
        className={`btn-premium ${managedConfidential ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30' : 'btn-premium-secondary'}`}
        type="button" 
        onClick={() => onBookTime?.(profile)}
      >
        {secondaryLabel}
      </button>
    </div>
  );

  return (
    <>
      {/* Premium Profile Card */}
      <article className="card-premium p-6 w-full max-w-sm">
        {/* Header with avatar and name */}
        <div className="flex items-center gap-4 mb-4">
          <img 
            src={avatarSrc} 
            alt={profile.name} 
            className="h-16 w-16 avatar-chamfered object-cover ring-2 ring-border-subtle" 
            loading="lazy" 
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-text-primary truncate">{profile.name}</h3>
            <p className="text-sm text-text-secondary truncate">{headlineCopy}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-4">
        <StatusBadge isOnline={isOnline} hasActiveSession={hasActiveSession} presenceState={presenceState} />
        </div>

        {/* Actions */}
        {renderActions()}

        {/* Contribution Blurb */}
        {contributionBlurb && (
          <p className="mt-4 text-sm text-text-secondary leading-relaxed">{contributionBlurb}</p>
        )}

        {/* See Full Profile Button */}
        <button 
          className="mt-4 w-full text-sm font-medium text-accent-primary hover:text-accent-hover transition-colors duration-base"
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
            className="card-premium p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-lg bg-background-tertiary hover:bg-background-hover text-text-secondary hover:text-text-primary transition-all duration-base"
              type="button" 
              aria-label="Close profile" 
              onClick={() => setShowDetails(false)}
            >
              ×
            </button>

            {/* Header */}
            <div className="flex items-center gap-6 mb-6">
              <img 
                src={avatarSrc} 
                alt={profile.name} 
                className="h-20 w-20 avatar-chamfered object-cover ring-2 ring-border-medium" 
              />
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-text-primary mb-1">{profile.name}</h2>
                <p className="text-base text-text-secondary">{headlineCopy}</p>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-6">
              <StatusBadge isOnline={isOnline} hasActiveSession={hasActiveSession} presenceState={presenceState} />
              
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
              
              {contributionBlurb && (
                <p className="text-sm text-text-secondary leading-relaxed">{contributionBlurb}</p>
              )}

              {socialLinks.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3">Find them online</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {socialLinks.map((link) => (
                      <a 
                        key={link.key} 
                        href={link.url} 
                        className="flex flex-col gap-1 p-3 rounded-lg border border-border-subtle bg-background-secondary/50 hover:bg-background-hover hover:border-border-medium transition-all duration-base"
                        rel="noreferrer"
                        target="_blank"
                      >
                        <span className="text-xs text-text-tertiary">{link.label}</span>
                        <span className="text-sm text-accent-primary font-medium truncate">{link.display}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {renderActions()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
