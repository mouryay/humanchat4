'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProfileSummary } from '../../../src/lib/db';
import ProfileListRow from './ProfileListRow';
import { fetchWithAuthRefresh } from '../utils/fetchWithAuthRefresh';
import { sessionStatusManager } from '../services/sessionStatusManager';
import type { PeopleSearchFilters } from './peopleSearchTypes';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface PeopleSearchViewProps {
  isMobile?: boolean;
  onOpenConversations?: () => void;
  onOpenFilters?: () => void;
  onConnectNow?: (profile: ProfileSummary) => void;
  onBookTime?: (profile: ProfileSummary) => void;
  connectingProfileId?: string | null;
  filters: PeopleSearchFilters;
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
  onOpenFilters,
  onConnectNow,
  onBookTime,
  connectingProfileId,
  filters
}: PeopleSearchViewProps) {
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
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
          if (filters.conversationType !== 'all') params.set('conversation_type', filters.conversationType);
          params.set('sort', filters.sort);
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
        if (filters.onlineOnly) {
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
  }, [debouncedKeyword, filters.onlineOnly, filters.conversationType, filters.sort, currentUserId]);

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (filters.onlineOnly) chips.push('Online only');
    if (filters.conversationType !== 'all') chips.push(`Type: ${filters.conversationType}`);
    if (filters.sort === 'default') chips.push('Sort: Online first');
    if (filters.sort === 'active') chips.push('Sort: Most active');
    if (filters.sort === 'recent') chips.push('Sort: Recently joined');
    return chips;
  }, [filters.onlineOnly, filters.conversationType, filters.sort]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden px-3 pb-4 pt-3 md:px-6 md:pt-5">
      <div className="mb-4 rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white md:text-xl">Search people</h2>
            <p className="text-sm text-white/60">Find the right human by topic, availability, and conversation mode.</p>
          </div>
          {isMobile && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80"
                onClick={onOpenConversations}
              >
                Chats
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80"
                onClick={onOpenFilters}
              >
                Filters
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Search by name or keyword"
            className="h-11 rounded-xl border border-white/15 bg-white/5 px-3.5 text-sm text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {activeFilterChips.length > 0 ? (
              activeFilterChips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/80"
                >
                  {chip}
                </span>
              ))
            ) : (
              <span className="text-xs text-white/45">No active filters</span>
            )}
          </div>
        </div>
      </div>

      {usedFallback && (
        <p className="mb-2 text-xs text-white/50">
          No one is online right now. Showing all members instead.
        </p>
      )}
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
      {loading && <p className="mb-2 text-xs text-white/60">Loading people...</p>}

      {!loading && profiles.length > 0 && (
        <p className="mb-2 px-1 text-xs text-white/50">
          {profiles.length} people found
        </p>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {profiles.length === 0 && !loading ? (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/55">
            No matching people found.
          </div>
        ) : (
          <div className="space-y-3 pb-3">
            {profiles.map((profile) => (
              <ProfileListRow
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
