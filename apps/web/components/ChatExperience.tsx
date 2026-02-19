'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import ConversationSidebar from './ConversationSidebar';
import ConversationView from './ConversationView';
import ProfilePanel from './ProfilePanel';
import ProfileSidebar from './ProfileSidebar';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useConversationData } from '../hooks/useConversationData';
import { useChatRequests } from '../hooks/useChatRequests';
import { usePendingInvites } from '../hooks/usePendingInvites';
import { acceptInstantInvite, declineInstantInvite } from '../services/instantInviteApi';
import { fetchUserProfile, type UserProfile } from '../services/profileApi';
import { INSTANT_INVITE_TARGETED_EVENT, type InstantInviteTargetedDetail } from '../constants/events';
import { PENDING_INVITE_CONVERSATION_KEY } from '../constants/storageKeys';
import type { ProfileSummary } from '../../../src/lib/db';
import { connectNow as connectNowWithProfile } from '../services/conversationClient';
import { sessionStatusManager } from '../services/sessionStatusManager';
import { fetchWithAuthRefresh } from '../utils/fetchWithAuthRefresh';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
import BookingModal from './BookingModal';
import RequestForm from './RequestForm';

const ChatShell = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [shouldOpenSam, setShouldOpenSam] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState<'none' | 'conversations' | 'profile' | 'profiles'>('none');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { isMobile, isTablet } = useBreakpoint();
  const { conversations } = useConversationData();
  const {
    requests,
    loading: requestsLoading,
    error: requestsError,
    updateStatus,
    updatingId
  } = useChatRequests();
  const { invitesByConversation, refresh: refreshInvites } = usePendingInvites();
  const [inviteActionPendingId, setInviteActionPendingId] = useState<string | null>(null);
  const fetchedRequestersRef = useRef<Set<string>>(new Set());
  const [requesterProfiles, setRequesterProfiles] = useState<
    Record<string, Pick<UserProfile, 'name' | 'headline' | 'avatarUrl'>>
  >({});
  const [sidebarProfiles, setSidebarProfiles] = useState<ProfileSummary[]>([]);
  const [connectingProfileId, setConnectingProfileId] = useState<string | null>(null);
  const [bookingProfile, setBookingProfile] = useState<ProfileSummary | null>(null);
  const [requestProfile, setRequestProfile] = useState<ProfileSummary | null>(null);
  const pendingConversationParam = searchParams.get('conversationId');

  const samConversationId = useMemo(() => {
    return conversations.find((entry) => entry.conversation.type === 'sam')?.conversation.conversationId ?? 'sam-concierge';
  }, [conversations]);

  // Seed sidebar with 3 recently joined profiles on mount
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;

    const currentUserId = sessionStatusManager.getCurrentUserId();
    const seed = async () => {
      try {
        const res = await fetchWithAuthRefresh(
          `${API_BASE_URL}/api/users/search?sort=recent&limit=3`,
          { credentials: 'include' }
        );
        if (!res.ok) return;
        const payload = await res.json();
        const users = (payload?.data?.users ?? payload?.users ?? []) as Array<{
          id: string;
          name?: string | null;
          headline?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          conversation_type?: string;
          instant_rate_per_minute?: number | null;
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
        }>;

        const mapped: ProfileSummary[] = users
          .filter((u) => u.id && u.id !== currentUserId)
          .slice(0, 3)
          .map((u) => ({
            userId: u.id,
            name: u.name ?? 'Human',
            avatarUrl: u.avatar_url ?? undefined,
            headline: u.headline ?? undefined,
            bio: u.bio ?? undefined,
            conversationType: (u.conversation_type as ProfileSummary['conversationType']) ?? 'free',
            instantRatePerMinute: u.instant_rate_per_minute ?? undefined,
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

        if (mapped.length > 0) {
          setSidebarProfiles((prev) => (prev.length === 0 ? mapped : prev));
        }
      } catch {
        // Silent fail — Sam will populate later
      }
    };
    void seed();
  }, []);

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (focus === 'sam') {
      setShouldOpenSam(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!shouldOpenSam) return;
    setActiveConversationId(samConversationId);
    if (isMobile) {
      setMobileDrawer('none');
    }
  }, [shouldOpenSam, samConversationId, isMobile]);

  useEffect(() => {
    if (activeConversationId || shouldOpenSam) {
      return;
    }

    if (typeof window !== 'undefined') {
      const pendingStored = window.sessionStorage?.getItem(PENDING_INVITE_CONVERSATION_KEY);
      if (pendingStored) {
        return;
      }
    }

    const firstConversationId = conversations[0]?.conversation.conversationId;
    if (firstConversationId) {
      setActiveConversationId(firstConversationId);
    }
  }, [activeConversationId, conversations, shouldOpenSam]);

  const focusConversation = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId);
      if (isMobile) {
        setMobileDrawer('none');
      } else {
        setSidebarCollapsed(false);
      }
    },
    [isMobile]
  );

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    if (isMobile) {
      setMobileDrawer('none');
    }
  };

  const handleShowConversationDrawer = () => {
    setMobileDrawer('conversations');
  };

  const handleShowProfileDrawer = () => {
    setMobileDrawer('profile');
  };

  const handleCloseDrawers = () => {
    setMobileDrawer('none');
  };

  // Track mobileDrawer in a ref so callbacks don't capture stale closure values
  const mobileDrawerRef = useRef(mobileDrawer);
  mobileDrawerRef.current = mobileDrawer;

  // Track sidebarProfiles for swipe-open hint
  const sidebarProfilesRef = useRef(sidebarProfiles);
  sidebarProfilesRef.current = sidebarProfiles;

  // Right-edge swipe to open profiles drawer
  const rightSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const handleRightEdgeTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const screenWidth = window.innerWidth;
    // Only trigger from the right 20px edge
    if (touch.clientX >= screenWidth - 20 && sidebarProfilesRef.current.length > 0) {
      rightSwipeStart.current = { x: touch.clientX, y: touch.clientY };
    }
  }, []);

  const handleRightEdgeTouchMove = useCallback((e: React.TouchEvent) => {
    if (!rightSwipeStart.current) return;
    const touch = e.touches[0];
    const dx = rightSwipeStart.current.x - touch.clientX;
    const dy = Math.abs(touch.clientY - rightSwipeStart.current.y);
    // Swiped left at least 50px with mostly horizontal movement
    if (dx > 50 && dy < dx) {
      rightSwipeStart.current = null;
      if (mobileDrawerRef.current === 'none') {
        setMobileDrawer('profiles');
      }
    }
  }, []);

  const handleRightEdgeTouchEnd = useCallback(() => {
    rightSwipeStart.current = null;
  }, []);

  // Swipe right on the profiles drawer to close it
  const drawerSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const handleDrawerTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    drawerSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleDrawerTouchMove = useCallback((e: React.TouchEvent) => {
    if (!drawerSwipeStart.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - drawerSwipeStart.current.x;
    const dy = Math.abs(touch.clientY - drawerSwipeStart.current.y);
    if (dx > 60 && dy < dx) {
      drawerSwipeStart.current = null;
      setMobileDrawer('none');
    }
  }, []);

  const handleDrawerTouchEnd = useCallback(() => {
    drawerSwipeStart.current = null;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleInstantInvite = (event: Event) => {
      const detail = (event as CustomEvent<InstantInviteTargetedDetail>).detail;
      if (!detail?.conversationId) {
        return;
      }
      focusConversation(detail.conversationId);
    };

    window.addEventListener(INSTANT_INVITE_TARGETED_EVENT, handleInstantInvite as EventListener);
    return () => {
      window.removeEventListener(INSTANT_INVITE_TARGETED_EVENT, handleInstantInvite as EventListener);
    };
  }, [focusConversation]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedConversationId = window.sessionStorage?.getItem(PENDING_INVITE_CONVERSATION_KEY);
    if (!storedConversationId) {
      return;
    }
    window.sessionStorage.removeItem(PENDING_INVITE_CONVERSATION_KEY);
    focusConversation(storedConversationId);
  }, [focusConversation]);

  useEffect(() => {
    if (!pendingConversationParam) {
      return;
    }
    focusConversation(pendingConversationParam);
    router.replace('/');
  }, [pendingConversationParam, focusConversation, router]);

  useEffect(() => {
    const pendingIds = requests
      .filter((request) => request.status === 'pending')
      .map((request) => request.requesterId)
      .filter((requesterId) => !fetchedRequestersRef.current.has(requesterId));
    if (pendingIds.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const hydrate = async () => {
      const results = await Promise.all(
        pendingIds.map(async (requesterId) => {
          try {
            return await fetchUserProfile(requesterId);
          } catch (error) {
            console.warn('Failed to load requester profile', { requesterId, error });
            return null;
          }
        })
      );
      if (cancelled) {
        return;
      }
      setRequesterProfiles((prev) => {
        const next = { ...prev };
        results.forEach((profile) => {
          if (profile) {
            next[profile.id] = {
              name: profile.name,
              headline: profile.headline,
              avatarUrl: profile.avatarUrl
            };
            fetchedRequestersRef.current.add(profile.id);
          }
        });
        return next;
      });
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [requests]);

  const handleSidebarConnectNow = useCallback(
    async (profile: ProfileSummary) => {
      if (!profile.userId) return;
      const userId = sessionStatusManager.getCurrentUserId();
      if (!userId) return;
      setConnectingProfileId(profile.userId);
      try {
        const createdConversationId = await connectNowWithProfile(profile, userId);
        focusConversation(createdConversationId);
      } catch {
        // Error handled silently
      } finally {
        setConnectingProfileId((prev) => (prev === profile.userId ? null : prev));
      }
    },
    [focusConversation]
  );

  const handleSidebarBookTime = useCallback((profile: ProfileSummary) => {
    if (profile.managed && profile.confidentialRate) {
      setRequestProfile(profile);
    } else {
      setBookingProfile(profile);
    }
  }, []);

  const handleRequestAction = useCallback(
    async (requestId: string, status: 'pending' | 'approved' | 'declined') => {
      const result = await updateStatus(requestId, status);
      if (status === 'approved' && result.conversation) {
        setActiveConversationId(result.conversation.conversationId);
        if (isMobile) {
          setMobileDrawer('none');
        }
      }
      return result;
    },
    [isMobile, updateStatus]
  );

  const handleInviteAccept = useCallback(
    async (inviteId: string) => {
      setInviteActionPendingId(inviteId);
      try {
        const { conversationId } = await acceptInstantInvite(inviteId);
        await refreshInvites();
        focusConversation(conversationId);
      } catch (err) {
        console.error('[ChatExperience] Failed to accept invite', err);
      } finally {
        setInviteActionPendingId((prev) => (prev === inviteId ? null : prev));
      }
    },
    [focusConversation, refreshInvites]
  );

  const handleInviteDecline = useCallback(
    async (inviteId: string) => {
      setInviteActionPendingId(inviteId);
      try {
        await declineInstantInvite(inviteId);
        await refreshInvites();
      } catch (err) {
        console.error('[ChatExperience] Failed to decline invite', err);
      } finally {
        setInviteActionPendingId((prev) => (prev === inviteId ? null : prev));
      }
    },
    [refreshInvites]
  );

  return (
    <main className={clsx('flex flex-col bg-midnight text-white', isMobile ? 'h-[100dvh] max-h-[100dvh] overflow-hidden fixed inset-0' : 'h-screen overflow-hidden')}>
      {isTablet && (
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-white/10 bg-midnight px-4 py-3 text-xs uppercase tracking-[0.3em] text-white/60">
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-[11px] normal-case tracking-normal text-white"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
          >
            {sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </button>
        </header>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!isMobile && (
          <div className="flex h-full shrink-0 overflow-hidden">
            <ConversationSidebar
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              collapsed={isTablet && sidebarCollapsed}
              requests={requests}
              requestProfiles={requesterProfiles}
              requestLoading={requestsLoading}
              requestError={requestsError}
              onRequestAction={handleRequestAction}
              requestActionPendingId={updatingId}
              pendingInvites={invitesByConversation}
              onInviteAccept={handleInviteAccept}
              onInviteDecline={handleInviteDecline}
              inviteActionPendingId={inviteActionPendingId}
            />
          </div>
        )}

        {isMobile ? (
          <section
            className="relative flex min-h-0 flex-1 flex-col bg-midnight overflow-hidden max-h-full"
            onTouchStart={handleRightEdgeTouchStart}
            onTouchMove={handleRightEdgeTouchMove}
            onTouchEnd={handleRightEdgeTouchEnd}
          >
            <ConversationView
              key={`mobile-${activeConversationId ?? samConversationId}`}
              activeConversationId={activeConversationId ?? samConversationId}
              onSelectConversation={handleSelectConversation}
              isMobile
              onBack={handleShowConversationDrawer}
              onShowProfilePanel={handleShowProfileDrawer}
              onSidebarProfilesChange={(profiles) => {
                setSidebarProfiles((prev) => {
                  if (profiles.length === 0) return prev;
                  const ids = new Set(profiles.map((p) => p.userId));
                  const kept = prev.filter((p) => !ids.has(p.userId));
                  return [...profiles, ...kept];
                });
                if (profiles.length > 0 && mobileDrawerRef.current === 'none') {
                  setMobileDrawer('profiles');
                }
              }}
            />

            <div
              className={clsx('pointer-events-none absolute inset-0 z-30 flex', {
                'pointer-events-auto': mobileDrawer === 'conversations'
              })}
              aria-hidden={mobileDrawer !== 'conversations'}
            >
              {/* Backdrop - closes drawer when tapped */}
              <button
                type="button"
                className={clsx('absolute inset-0 bg-black/80 transition-opacity duration-200 z-40 border-none', {
                  'opacity-0 pointer-events-none': mobileDrawer !== 'conversations',
                  'opacity-100 pointer-events-auto': mobileDrawer === 'conversations'
                })}
                onClick={handleCloseDrawers}
                onTouchStart={(e) => e.stopPropagation()}
                aria-label="Close drawer"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              />
              <div
                className={clsx(
                  'relative h-full w-full max-w-[85%] border-r border-white/10 bg-midnight shadow-2xl transition-transform duration-200 ease-out z-50',
                  {
                    '-translate-x-full': mobileDrawer !== 'conversations',
                    'translate-x-0': mobileDrawer === 'conversations'
                  }
                )}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <div className="flex h-full flex-col">
                  <div className="flex-1 overflow-y-auto">
                    <ConversationSidebar
                      activeConversationId={activeConversationId}
                      onSelectConversation={handleSelectConversation}
                      requests={requests}
                      requestProfiles={requesterProfiles}
                      requestLoading={requestsLoading}
                      requestError={requestsError}
                      onRequestAction={handleRequestAction}
                      requestActionPendingId={updatingId}
                      pendingInvites={invitesByConversation}
                      onInviteAccept={handleInviteAccept}
                      onInviteDecline={handleInviteDecline}
                      inviteActionPendingId={inviteActionPendingId}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className={clsx('pointer-events-none absolute inset-0 z-30 flex justify-end', {
                'pointer-events-auto': mobileDrawer === 'profile'
              })}
              aria-hidden={mobileDrawer !== 'profile'}
            >
              <button
                type="button"
                className={clsx('absolute inset-0 bg-black/60 transition-opacity duration-200', {
                  'opacity-0': mobileDrawer !== 'profile',
                  'opacity-100': mobileDrawer === 'profile'
                })}
                onClick={handleCloseDrawers}
                aria-label="Close drawer"
              />
              <div
                className={clsx(
                  'relative h-full w-full max-w-[min(90%,360px)] border-l border-white/10 shadow-2xl transition-transform duration-200 ease-out',
                  {
                    'translate-x-full': mobileDrawer !== 'profile',
                    'translate-x-0': mobileDrawer === 'profile'
                  }
                )}
                style={{ backgroundColor: '#05060a' }}
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm text-white/70">
                    <span>Account</span>
                    <button
                      type="button"
                      className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-wide text-white/70"
                      onClick={handleCloseDrawers}
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <ProfilePanel />
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile profiles drawer (slides from right) */}
            <div
              className={clsx('pointer-events-none absolute inset-0 z-30 flex justify-end', {
                'pointer-events-auto': mobileDrawer === 'profiles'
              })}
              aria-hidden={mobileDrawer !== 'profiles'}
            >
              <button
                type="button"
                className={clsx('absolute inset-0 bg-black/60 transition-opacity duration-200', {
                  'opacity-0': mobileDrawer !== 'profiles',
                  'opacity-100': mobileDrawer === 'profiles'
                })}
                onClick={handleCloseDrawers}
                aria-label="Close profiles drawer"
              />
              <div
                className={clsx(
                  'relative h-full w-full max-w-[min(90%,360px)] border-l border-white/10 shadow-2xl transition-transform duration-200 ease-out',
                  {
                    'translate-x-full': mobileDrawer !== 'profiles',
                    'translate-x-0': mobileDrawer === 'profiles'
                  }
                )}
                style={{ backgroundColor: '#05060a' }}
                onTouchStart={handleDrawerTouchStart}
                onTouchMove={handleDrawerTouchMove}
                onTouchEnd={handleDrawerTouchEnd}
              >
                <div className="flex h-full flex-col">
                  <div className="border-b border-white/10 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/50">People</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <ProfileSidebar
                      profiles={sidebarProfiles}
                      onConnectNow={handleSidebarConnectNow}
                      onBookTime={handleSidebarBookTime}
                      connectingProfileId={connectingProfileId}
                      hideHeader
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="flex flex-1 flex-col overflow-hidden">
              <ConversationView
                key={`desktop-${activeConversationId}`}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onSidebarProfilesChange={(profiles) => {
                  setSidebarProfiles((prev) => {
                    if (profiles.length === 0) return prev;
                    const ids = new Set(profiles.map((p) => p.userId));
                    const kept = prev.filter((p) => !ids.has(p.userId));
                    return [...profiles, ...kept];
                  });
                }}
              />
            </section>
            <aside
              className="flex h-full shrink-0 flex-col border-l border-white/10"
              style={{ 
                width: 'var(--sidebar-width)', 
                minWidth: 'var(--sidebar-width)', 
                backgroundColor: '#05060a',
                boxShadow: '-2px 0 12px rgba(0, 0, 0, 0.15)'
              }}
            >
              <ProfileSidebar
                profiles={sidebarProfiles}
                onConnectNow={handleSidebarConnectNow}
                onBookTime={handleSidebarBookTime}
                connectingProfileId={connectingProfileId}
              />
            </aside>
          </>
        )}
      </div>
      <BookingModal open={Boolean(bookingProfile)} profile={bookingProfile} conversation={null} onClose={() => setBookingProfile(null)} />
      <RequestForm open={Boolean(requestProfile)} profile={requestProfile} conversation={null} onClose={() => setRequestProfile(null)} />
    </main>
  );
};

const ChatExperience = () => {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-midnight text-white/70">Loading chat...</div>}>
      <ChatShell />
    </Suspense>
  );
};

export default ChatExperience;
