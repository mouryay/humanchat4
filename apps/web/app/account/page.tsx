"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import ProfileDetailsSummary from '../../components/ProfileDetailsSummary';
import { useAuthIdentity } from '../../hooks/useAuthIdentity';
import { useConversationData } from '../../hooks/useConversationData';
import { useProfileDetails } from '../../hooks/useProfileDetails';
import { getExpertBookings, getUserBookings } from '../../services/bookingApi';
import type { Booking } from '../../../../src/lib/db';

const accountQuickActions = [
  {
    label: 'Open Sam Concierge',
    href: '/?focus=sam',
    description: 'Continue your AI-powered conversation instantly.'
  },
  {
    label: 'Browse Workspace',
    href: '/',
    description: 'Jump into recent human chats from the workspace.'
  },
  {
    label: 'My Account',
    href: '/account',
    description: 'Review sessions, settings, and profile details.'
  }
];

const formatSessionDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

const formatSessionTime = (start: number, end: number) => {
  const startText = new Date(start).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  const endText = new Date(end).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  return `${startText} – ${endText}`;
};

export default function AccountPage() {
  const profileState = useProfileDetails();
  const { identity } = useAuthIdentity();
  const { conversations, unreadTotal } = useConversationData();
  const [sessions, setSessions] = useState<Booking[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrateSessions = async () => {
      setSessionsLoading(true);
      setSessionsError(null);
      try {
        const [clientBookings, expertBookings] = await Promise.all([
          getUserBookings('upcoming'),
          getExpertBookings('upcoming')
        ]);
        if (cancelled) {
          return;
        }
        const merged = [...clientBookings, ...expertBookings]
          .sort((a, b) => a.startTime - b.startTime)
          .slice(0, 3);
        setSessions(merged);
      } catch (err) {
        if (!cancelled) {
          setSessionsError('Unable to load upcoming sessions.');
        }
      } finally {
        if (!cancelled) {
          setSessionsLoading(false);
        }
      }
    };

    void hydrateSessions();
    return () => {
      cancelled = true;
    };
  }, []);

  const { samConversation, recentHumanConversations } = useMemo(() => {
    const samEntry = conversations.find((entry) => entry.conversation.type === 'sam');
    const humans = conversations
      .filter((entry) => entry.conversation.type !== 'sam')
      .sort((a, b) => b.conversation.lastActivity - a.conversation.lastActivity)
      .slice(0, 4);
    return { samConversation: samEntry, recentHumanConversations: humans };
  }, [conversations]);

  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="border-b border-white/10 px-6 py-6">
        <p className="text-xs uppercase tracking-[0.35em] text-white/50">Account</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">One home for everything HumanChat</h1>
        <p className="text-sm text-white/60">
          {identity?.name ? `Signed in as ${identity.name}` : 'Sign in to manage your account.'}
        </p>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
        <section aria-labelledby="profile-heading">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Your profile</p>
              <h2 id="profile-heading" className="text-2xl font-semibold text-white">
                Keep your public card sharp
              </h2>
            </div>
            <Link
              href="/settings"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/50"
            >
              Edit profile
            </Link>
          </div>
          <ProfileDetailsSummary profileState={profileState} />
        </section>

        <section aria-labelledby="sessions-heading" className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Upcoming sessions</p>
              <h2 id="sessions-heading" className="text-xl font-semibold text-white">
                Your next calls
              </h2>
            </div>
            <Link href="/bookings" className="text-sm font-semibold text-white/70 underline-offset-4 hover:underline">
              View all bookings
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {sessionsLoading && <p className="text-sm text-white/60">Loading sessions…</p>}
            {!sessionsLoading && sessionsError && (
              <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{sessionsError}</p>
            )}
            {!sessionsLoading && !sessionsError && sessions.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-sm text-white/60">
                No sessions on the calendar. Share your link or accept an invite to get started.
              </p>
            )}
            {sessions.map((session) => (
              <div key={session.bookingId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">{session.expertName ?? 'Pending match'}</p>
                    {session.expertHeadline && <p className="text-sm text-white/60">{session.expertHeadline}</p>}
                  </div>
                  <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                    {session.status === 'scheduled' ? 'Scheduled' : session.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/70">
                  <span>{formatSessionDate(session.startTime)}</span>
                  <span>{formatSessionTime(session.startTime, session.endTime)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="activity-heading" className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Activity</p>
              <h2 id="activity-heading" className="text-xl font-semibold text-white">
                Stay close to the action
              </h2>
            </div>
            <p className="text-sm text-white/60">{unreadTotal > 0 ? `${unreadTotal} unread conversations` : 'All caught up'}</p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {samConversation ? (
              <div className="rounded-2xl border border-indigoGlow/30 bg-indigoGlow/10 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-indigoGlow">Sam concierge</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Resume with Sam</h3>
                <p className="text-sm text-white/70" suppressHydrationWarning>
                  Last activity · {new Date(samConversation.conversation.lastActivity).toLocaleString()}
                </p>
                <Link
                  href="/?focus=sam"
                  className="mt-4 inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-white/50"
                >
                  Open Sam
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-white/60">
                Sam concierge history will appear here once you start a thread.
              </div>
            )}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">Recent humans</p>
                  <h3 className="text-lg font-semibold text-white">Jump back in</h3>
                </div>
                <Link href="/" className="text-xs font-semibold text-white/60 underline-offset-4 hover:underline">
                  Open workspace
                </Link>
              </div>
              <div className="mt-3 space-y-3">
                {recentHumanConversations.length === 0 && (
                  <p className="text-sm text-white/60">No human conversations yet. Start one from the workspace.</p>
                )}
                {recentHumanConversations.map((entry) => (
                  <div key={entry.conversation.conversationId} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-sm font-semibold text-white">{entry.meta.displayName}</p>
                    <p className="text-xs text-white/60" suppressHydrationWarning>
                      {new Date(entry.conversation.lastActivity).toLocaleString()}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-white/60">{entry.meta.lastMessage}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="settings-heading" className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Settings</p>
              <h2 id="settings-heading" className="text-xl font-semibold text-white">
                Tune how you show up
              </h2>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Link href="/settings?tab=profile" className="rounded-2xl border border-white/15 bg-white/5 p-4 transition hover:border-white/40">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Profile</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Account preferences</h3>
              <p className="mt-1 text-sm text-white/60">Update your bio, expertise, and public narrative.</p>
            </Link>
            <Link href="/expert/availability" className="rounded-2xl border border-white/15 bg-white/5 p-4 transition hover:border-white/40">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Availability</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Manage availability</h3>
              <p className="mt-1 text-sm text-white/60">Control when Sam can auto-book you.</p>
            </Link>
            <Link href="/bookings" className="rounded-2xl border border-white/15 bg-white/5 p-4 transition hover:border-white/40">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Sessions</p>
              <h3 className="mt-2 text-lg font-semibold text-white">My bookings</h3>
              <p className="mt-1 text-sm text-white/60">Review upcoming, past, and canceled calls.</p>
            </Link>
          </div>
        </section>

        <section aria-labelledby="actions-heading" className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Account actions</p>
              <h2 id="actions-heading" className="text-xl font-semibold text-white">
                Quick jumps
              </h2>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {accountQuickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="rounded-3xl border border-white/15 bg-white/5 p-5 transition hover:border-white/40"
              >
                <p className="text-sm uppercase tracking-[0.25em] text-white/50">Quick action</p>
                <h3 className="mt-3 text-lg font-semibold text-white">{action.label}</h3>
                <p className="mt-1 text-sm text-white/70">{action.description}</p>
                {action.label === 'Browse Workspace' && recentHumanConversations.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-white/60">
                    {recentHumanConversations.slice(0, 3).map((entry) => (
                      <li key={`${action.label}-${entry.conversation.conversationId}`}>{entry.meta.displayName}</li>
                    ))}
                  </ul>
                )}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
