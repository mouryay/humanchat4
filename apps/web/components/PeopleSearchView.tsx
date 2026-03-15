'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProfileSummary } from '../../../src/lib/db';
import ProfileCard from './ProfileCard';
import { fetchWithAuthRefresh } from '../utils/fetchWithAuthRefresh';
import { sessionStatusManager } from '../services/sessionStatusManager';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type SortMode = 'default' | 'active' | 'recent';
type ConversationTypeFilter = 'all' | 'free' | 'paid' | 'charity';

interface PeopleSearchViewProps {
  isMobile?: boolean;
  onOpenConversations?: () => void;
  onConnectNow?: (profile: ProfileSummary) => void;
  onBookTime?: (profile: ProfileSummary) => void;
  connectingProfileId?: string | null;
}

type DirectoryUserRecord = {
  id: string;
  name?: string | null;
  headline?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  conversation_type?: string;
  instant_rate_per_minute?: number | null;
  min_price_per_15_min?: number | null;
  scheduled_rates?: Record<string, number> | null;
  is_online?: boolean;
  has_active_session?: boolean;
  presence_state?: string | null;
  last_seen_at?: string | null;
  donation_preference?: string | null;
  charity_name?: string | null;
  charity_id?: string | null;
  managed?: boolean;
  manager_id?: string | null;
  manager_display_name?: string | null;
  display_mode?: string | null;
  confidential_rate?: boolean | null;
};

const mapDirectoryUsers = (users: DirectoryUserRecord[], currentUserId: string | null): ProfileSummary[] => {
  return users
    .filter((u) => u.id && u.id !== currentUserId)
    .map((u) => ({
      userId: u.id,
      name: u.name ?? 'Human',
      avatarUrl: u.avatar_url ?? undefined,
      headline: u.headline ?? undefined,
      bio: u.bio ?? undefined,
      conversationType: (u.conversation_type as ProfileSummary['conversationType']) ?? 'free',
      instantRatePerMinute: u.instant_rate_per_minute ?? undefined,
      minPricePer15Min: u.min_price_per_15_min ?? undefined,
      scheduledRates: u.scheduled_rates
        ? Object.entries(u.scheduled_rates)
            .map(([d, p]) => ({ durationMinutes: Number(d), price: p }))
            .filter((e) => e.durationMinutes > 0 && e.price > 0)
        : [],
      isOnline: Boolean(u.is_online),
      hasActiveSession: Boolean(u.has_active_session),
      presenceState: u.presence_state ?? (u.is_online ? 'active' : 'offline'),
      lastSeenAt: u.last_seen_at ? Date.parse(u.last_seen_at) : undefined,
      donationPreference: u.donation_preference ?? undefined,
      charityName: u.charity_name ?? undefined,
      charityId: u.charity_id ?? undefined,
      managed: Boolean(u.managed),
      managerId: u.manager_id ?? undefined,
      managerName: u.manager_display_name ?? undefined,
      displayMode: u.display_mode ?? undefined,
      confidentialRate: u.confidential_rate ?? undefined
    } as ProfileSummary));
};

export default function PeopleSearchView({
  isMobile,
  onOpenConversations,
  onConnectNow,
  onBookTime,
  connectingProfileId
}: PeopleSearchViewProps) {
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(true);
  const [conversationType, setConversationType] = useState<ConversationTypeFilter>('all');
  const [sort, setSort] = useState<SortMode>('active');
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const currentUserId = useMemo(() => sessionStatusManager.getCurrentUserId(), []);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    let mounted = true;
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      setUsedFallback(false);
      try {
        const buildParams = (onlineFlag?: boolean) => {
          const params = new URLSearchParams();
          if (debouncedKeyword) params.set('q', debouncedKeyword);
          if (typeof onlineFlag === 'boolean') params.set('online', String(onlineFlag));
          if (conversationType !== 'all') params.set('conversation_type', conversationType);
          params.set('sort', sort);
          params.set('limit', '50');
          return params.toString();
        };

        const runQuery = async (queryString: string) => {
          const res = await fetchWithAuthRefresh(`${API_BASE_URL}/api/users/search?${queryString}`, {
            credentials: 'include'
          });
          if (!res.ok) {
            throw new Error('Failed to load people');
          }
          const payload = await res.json();
          const users = (payload?.data?.users ?? payload?.users ?? []) as DirectoryUserRecord[];
          return mapDirectoryUsers(users, currentUserId);
        };

        let nextProfiles: ProfileSummary[] = [];
        if (onlineOnly) {
          nextProfiles = await runQuery(buildParams(true));
          const shouldFallbackToAll = nextProfiles.length === 0 && initialLoadRef.current && !debouncedKeyword;
          if (shouldFallbackToAll) {
            nextProfiles = await runQuery(buildParams(undefined));
            if (mounted) setUsedFallback(true);
          }
        } else {
          nextProfiles = await runQuery(buildParams(undefined));
        }

        if (mounted) {
          setProfiles(nextProfiles);
          initialLoadRef.current = false;
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load people');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchUsers();
    return () => {
      mounted = false;
    };
  }, [debouncedKeyword, onlineOnly, conversationType, sort, currentUserId]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden px-3 pb-3 pt-2 md:px-6 md:pt-5">
      <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 md:mb-4 md:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white md:text-lg">Search people</h2>
            <p className="text-xs text-white/55 md:text-sm">Find the right human by topic, availability, and conversation mode.</p>
          </div>
          {isMobile && (
            <button
              type="button"
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80"
              onClick={onOpenConversations}
            >
              Chats
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Search by name or keyword"
            className="h-10 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/35 focus:border-blue-400 focus:outline-none"
          />
          <select
            value={conversationType}
            onChange={(event) => setConversationType(event.target.value as ConversationTypeFilter)}
            className="h-10 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white focus:border-blue-400 focus:outline-none"
          >
            <option value="all">All types</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="charity">Charity</option>
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            className="h-10 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white focus:border-blue-400 focus:outline-none"
          >
            <option value="active">Most active</option>
            <option value="default">Online first</option>
            <option value="recent">Recently joined</option>
          </select>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white/90">
            <input
              type="checkbox"
              checked={onlineOnly}
              onChange={(event) => setOnlineOnly(event.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-transparent"
            />
            Online only
          </label>
        </div>
      </div>

      {usedFallback && (
        <p className="mb-2 text-xs text-white/50">
          No one is online right now. Showing all members instead.
        </p>
      )}
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
      {loading && <p className="mb-2 text-xs text-white/60">Loading people...</p>}

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {profiles.length === 0 && !loading ? (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/55">
            No matching people found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-3 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.userId}
                profile={profile}
                onConnectNow={onConnectNow}
                onBookTime={onBookTime}
                isConnecting={connectingProfileId === profile.userId}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
