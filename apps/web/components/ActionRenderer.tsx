'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Conversation, Session, Action, ProfileSummary, SamShowcaseProfile } from '../../../src/lib/db';
import { toPrefetchedStatus } from '../utils/profilePresence';
import styles from './ConversationView.module.css';
import ProfileCard from './ProfileCard';
import StatusBadge from './StatusBadge';
import { searchProfiles } from '../services/profileApi';

interface ActionRendererProps {
  action: Action;
  onOpenConversation?: (conversationId: string) => void;
  onCreateSession?: (conversation: Conversation, session: Session) => void;
  onSelectSlot?: (slotId: string) => void;
  onConnectNow?: (profile: ProfileSummary) => void;
  onBookTime?: (profile: ProfileSummary) => void;
  connectingProfileId?: string | null;
  directoryProfiles?: ProfileSummary[];
  currentUserId?: string;
  selfNameTokens?: string[];
}

const formatRate = (rate?: number) => (rate ? `$${rate.toFixed(2)}/min` : '');

const isLegacyProfile = (profile: ProfileSummary | SamShowcaseProfile): profile is ProfileSummary => {
  return (profile as ProfileSummary).userId !== undefined;
};

const isLegacySessionPayload = (
  payload: Extract<Action, { type: 'create_session' }>
): payload is Extract<Action, { type: 'create_session' }> & { conversation: Conversation; session: Session } => {
  return 'conversation' in payload && 'session' in payload;
};

const isSessionProposal = (
  payload: Extract<Action, { type: 'create_session' }>
): payload is Extract<Action, { type: 'create_session' }> & {
  host: string;
  guest: string;
  suggested_start: string;
  duration_minutes: number;
  notes: string;
} => {
  return 'host' in payload && 'guest' in payload;
};

interface ShowcaseProfileTileProps {
  profile: SamShowcaseProfile;
  directoryByName: Map<string, ProfileSummary>;
  disableLiveStatus: boolean;
  onConnectNow?: (profile: ProfileSummary) => void;
  onBookTime?: (profile: ProfileSummary) => void;
  connectingProfileId?: string | null;
}

const ShowcaseProfileTile = ({
  profile,
  directoryByName,
  disableLiveStatus,
  onConnectNow,
  onBookTime,
  connectingProfileId
}: ShowcaseProfileTileProps) => {
  const normalizedName = profile.name?.trim().toLowerCase() ?? '';
  const [resolvedProfile, setResolvedProfile] = useState<ProfileSummary | null>(() => {
    return normalizedName ? directoryByName.get(normalizedName) ?? null : null;
  });
  const [pendingAction, setPendingAction] = useState<'connect' | 'schedule' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resolvedProfile || !normalizedName) {
      return;
    }
    const cached = directoryByName.get(normalizedName);
    if (cached) {
      setResolvedProfile(cached);
    }
  }, [directoryByName, normalizedName, resolvedProfile]);

  const resolveProfile = useCallback(async (): Promise<ProfileSummary> => {
    if (resolvedProfile) {
      return resolvedProfile;
    }
    const trimmedName = profile.name?.trim();
    if (!trimmedName) {
      throw new Error('Unable to identify that member.');
    }

    const [onlineMatch] = await searchProfiles(trimmedName, { onlineOnly: true });
    if (onlineMatch) {
      setResolvedProfile(onlineMatch);
      return onlineMatch;
    }

    const [anyMatch] = await searchProfiles(trimmedName);
    if (anyMatch) {
      setResolvedProfile(anyMatch);
      return anyMatch;
    }

    throw new Error('This member is unavailable right now.');
  }, [profile.name, resolvedProfile]);

  const handleAction = useCallback(
    async (mode: 'connect' | 'schedule') => {
      if (pendingAction) {
        return;
      }
      if (mode === 'connect' && !onConnectNow) {
        return;
      }
      if (mode === 'schedule' && !onBookTime) {
        return;
      }
      setPendingAction(mode);
      setError(null);
      try {
        const hydrated = await resolveProfile();
        if (mode === 'connect') {
          onConnectNow?.(hydrated);
        } else {
          onBookTime?.(hydrated);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to reach that member right now.');
      } finally {
        setPendingAction(null);
      }
    },
    [onBookTime, onConnectNow, pendingAction, resolveProfile]
  );

  if (resolvedProfile) {
    return (
      <ProfileCard
        profile={resolvedProfile}
        onConnectNow={onConnectNow}
        onBookTime={onBookTime}
        isConnecting={connectingProfileId === resolvedProfile.userId}
        disableLiveStatus={disableLiveStatus}
        prefetchedStatus={disableLiveStatus ? toPrefetchedStatus(resolvedProfile) ?? undefined : undefined}
      />
    );
  }

  const presenceState = profile.status === 'away' ? 'idle' : 'active';

  return (
    <div className={styles.profileCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <strong>{profile.name}</strong>
          {profile.headline && <p className={styles.profileHeadline}>{profile.headline}</p>}
        </div>
        {typeof profile.rate_per_minute === 'number' && profile.rate_per_minute > 0 && (
          <span className={styles.profileHeadline}>{formatRate(profile.rate_per_minute)}</span>
        )}
      </div>
      {profile.expertise && profile.expertise.length > 0 && (
        <p className={styles.profileHeadline}>Focus: {profile.expertise.join(' • ')}</p>
      )}
      <StatusBadge
        isOnline={profile.status === 'available'}
        hasActiveSession={profile.status === 'booked'}
        presenceState={presenceState}
      />
      {(onConnectNow || onBookTime) && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          {onConnectNow && (
            <button
              className={styles.primaryButton}
              type="button"
              disabled={pendingAction === 'connect'}
              onClick={() => handleAction('connect')}
            >
              {pendingAction === 'connect' ? 'Loading…' : 'Connect'}
            </button>
          )}
          {onBookTime && (
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={pendingAction === 'schedule'}
              onClick={() => handleAction('schedule')}
            >
              {pendingAction === 'schedule' ? 'Loading…' : 'Schedule'}
            </button>
          )}
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

const OfferConnection = ({
  action,
  onOpenConversation
}: {
  action: Extract<Action, { type: 'offer_connection' }>;
  onOpenConversation?: (conversationId: string) => void;
}) => (
  <div className={styles.actionStack}>
    <strong>Connection options</strong>
    {action.connectionOptions?.map((option, index) => (
      <div key={option.mode + index} className={styles.profileCard}>
        <div>{option.mode.toUpperCase()}</div>
        <p className={styles.profileHeadline}>{formatRate(option.ratePerMinute)}</p>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => onOpenConversation?.(action.targetUserId)}
        >
          Connect
        </button>
      </div>
    ))}
  </div>
);

export default function ActionRenderer({
  action,
  onOpenConversation,
  onCreateSession,
  onSelectSlot,
  onConnectNow,
  onBookTime,
  connectingProfileId,
  directoryProfiles,
  currentUserId,
  selfNameTokens
}: ActionRendererProps) {
  if (!action) return null;

  const selfNameLookup = useMemo(() => {
    return new Set(
      (selfNameTokens ?? [])
        .map((token) => token?.trim().toLowerCase())
        .filter((token): token is string => Boolean(token))
    );
  }, [selfNameTokens]);

  const matchesSelfName = (name?: string | null) => {
    if (!name || selfNameLookup.size === 0) {
      return false;
    }
    return selfNameLookup.has(name.trim().toLowerCase());
  };

  const directoryById = useMemo(() => {
    const map = new Map<string, ProfileSummary>();
    (directoryProfiles ?? []).forEach((profile) => {
      if (!profile?.userId) {
        return;
      }
      if (currentUserId && profile.userId === currentUserId) {
        return;
      }
      if (matchesSelfName(profile.name)) {
        return;
      }
      map.set(profile.userId, profile);
    });
    return map;
  }, [directoryProfiles, currentUserId, selfNameLookup]);

  const profileDirectory = useMemo(() => {
    const map = new Map<string, ProfileSummary>();
    (directoryProfiles ?? []).forEach((profile) => {
      if (!profile?.name) {
        return;
      }
      if (currentUserId && profile.userId === currentUserId) {
        return;
      }
      if (matchesSelfName(profile.name)) {
        return;
      }
      map.set(profile.name.trim().toLowerCase(), profile);
    });
    return map;
  }, [directoryProfiles, currentUserId, selfNameLookup]);

  switch (action.type || action.actionType) {
    case 'show_profiles': {
      // Profile cards now render in the right sidebar panel instead of inline
      const profiles = (action as Extract<Action, { type: 'show_profiles' }>).profiles ?? [];
      const count = profiles.filter((profile) => {
        if (isLegacyProfile(profile)) {
          if (currentUserId && profile.userId === currentUserId) return false;
          if (matchesSelfName(profile.name)) return false;
          return true;
        }
        if (matchesSelfName(profile.name)) return false;
        return true;
      }).length;
      if (count === 0) return null;
      return (
        <div className={styles.noticeBanner}>
          👥 {count === 1 ? '1 person' : `${count} people`} recommended — check the People panel.
        </div>
      );
    }
    case 'offer_connection':
      return <OfferConnection action={action as Extract<Action, { type: 'offer_connection' }>} onOpenConversation={onOpenConversation} />;
    case 'show_slots': {
      const slots = (action as Extract<Action, { type: 'show_slots' }>).slots ?? [];
      return (
        <div className={styles.calendarGrid}>
          {slots.map((slot) => (
            <button key={slot.id} className={styles.slotButton} type="button" onClick={() => onSelectSlot?.(slot.id)}>
              {slot.label}
            </button>
          ))}
        </div>
      );
    }
    case 'confirm_booking': {
      const confirm = action as Extract<Action, { type: 'confirm_booking' }>;
      return (
        <div className={styles.confirmationCard}>
          <strong>Booking confirmed</strong>
          <p>{confirm.summary}</p>
        </div>
      );
    }
    case 'system_notice': {
      const notice = action as Extract<Action, { type: 'system_notice' }>;
      return <div className={`${styles.noticeBanner} ${styles.systemNoticeBanner}`}>{notice.notice || notice.label}</div>;
    }
    case 'create_session': {
      const payload = action as Extract<Action, { type: 'create_session' }>;

      if (isLegacySessionPayload(payload)) {
        return (
          <div className={styles.confirmationCard}>
            <strong>Session Ready</strong>
            <p>{payload.label ?? 'Sam prepped a new session for you.'}</p>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => onCreateSession?.(payload.conversation, payload.session)}
            >
              Join Session
            </button>
          </div>
        );
      }

      if (isSessionProposal(payload)) {
        return (
          <div className={styles.confirmationCard}>
            <strong>Session proposed</strong>
            <p>
              {payload.host} ↔ {payload.guest}
            </p>
            <p>Start: {payload.suggested_start}</p>
            <p>Duration: {payload.duration_minutes} min</p>
            <p>{payload.notes}</p>
          </div>
        );
      }

      return null;
    }
    case 'open_conversation': {
      const payload = action as Extract<Action, { type: 'open_conversation' }>;
      return (
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => onOpenConversation?.(payload.conversationId)}
        >
          Jump into chat
        </button>
      );
    }
    case 'offer_call': {
      const offer = action as Extract<Action, { type: 'offer_call' }>;
      return (
        <div className={styles.noticeBanner}>
          <strong>{offer.participant} is ready for a call.</strong>
          <p>{offer.availability_window}</p>
          <p>{offer.purpose}</p>
        </div>
      );
    }
    case 'follow_up_prompt':
      return null;
    case 'update_profile':
      // Profile updates are handled server-side; no UI rendering needed
      return null;
    default:
      return action.label ? <div className={styles.noticeBanner}>{action.label}</div> : null;
  }
}
