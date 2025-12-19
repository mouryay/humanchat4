"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import AccountProfilePanel from '../../components/AccountProfilePanel';
import { useAuthIdentity } from '../../hooks/useAuthIdentity';
import { useConversationData } from '../../hooks/useConversationData';
import { useProfileDetails } from '../../hooks/useProfileDetails';
import { getExpertBookings, getUserBookings } from '../../services/bookingApi';
import type { Booking } from '../../../../src/lib/db';

const commandLinks = [
  {
    label: 'Workspace',
    href: '/',
    description: 'Jump back into human chats.'
  },
  {
    label: 'Bookings',
    href: '/bookings',
    description: 'Open your full calendar.'
  },
  {
    label: 'Availability',
    href: '/expert/availability',
    description: 'Tune when Sam can auto-book you.'
  },
  {
    label: 'Sam concierge',
    href: '/?focus=sam',
    description: 'Resume the AI planning thread.'
  },
  {
    label: 'Settings',
    href: '/settings',
    description: 'Deep configuration when needed.'
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
      <header className="border-b border-white/10 px-6 py-8">
        <p className="text-xs uppercase tracking-[0.35em] text-white/50">Account</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Your operating console</h1>
        <p className="text-sm text-white/60">
          {identity?.name ? `Signed in as ${identity.name}` : 'Sign in to manage your account.'}
        </p>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 pb-12">
        <div className="flex flex-col gap-8 py-10">
          <AccountProfilePanel profileState={profileState} />

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section aria-labelledby="sessions-heading" className="rounded-3xl border border-white/12 bg-white/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">Upcoming sessions</p>
                  <h2 id="sessions-heading" className="text-xl font-semibold text-white">
                    What&apos;s next on your calendar
                  </h2>
                </div>
                <Link
                  href="/bookings"
                  className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40"
                >
                  Full calendar
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {sessionsLoading && <p className="text-sm text-white/60">Loading sessions…</p>}
                {!sessionsLoading && sessionsError && (
                  <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{sessionsError}</p>
                )}
                {!sessionsLoading && !sessionsError && sessions.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-white/20 px-4 py-6 text-sm text-white/60">
                    No sessions scheduled. Share your link or accept an invite to fill the week.
                  </p>
                )}
                {sessions.map((session) => (
                  <div key={session.bookingId} className="rounded-2xl border border-white/12 bg-black/30 p-4">
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

            <section aria-labelledby="activity-heading" className="rounded-3xl border border-white/12 bg-white/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">Activity</p>
                  <h2 id="activity-heading" className="text-xl font-semibold text-white">
                    Conversations at a glance
                  </h2>
                </div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  {unreadTotal > 0 ? `${unreadTotal} unread` : 'All caught up'}
                </p>
              </div>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/12 bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Sam concierge</p>
                      <h3 className="text-lg font-semibold text-white">{samConversation ? 'Resume planning' : 'Start a thread'}</h3>
                    </div>
                    <Link href="/?focus=sam" className="text-xs font-semibold text-white/70 underline-offset-4 hover:underline">
                      Open Sam
                    </Link>
                  </div>
                  <p className="mt-2 text-sm text-white/60" suppressHydrationWarning>
                    {samConversation
                      ? `Last activity · ${new Date(samConversation.conversation.lastActivity).toLocaleString()}`
                      : 'Sam keeps your prep work ready when you need it.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/12 bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Humans</p>
                      <h3 className="text-lg font-semibold text-white">Recent conversations</h3>
                    </div>
                    <Link href="/" className="text-xs font-semibold text-white/70 underline-offset-4 hover:underline">
                      Workspace
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
          </div>

          <section aria-labelledby="command-heading" className="rounded-3xl border border-white/12 bg-white/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Workspace shortcuts</p>
                <h2 id="command-heading" className="text-lg font-semibold text-white">
                  Jump only when you must leave
                </h2>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {commandLinks.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group inline-flex flex-col rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-left transition hover:border-white/40"
                >
                  <span className="text-xs uppercase tracking-[0.3em] text-white/50">{action.label}</span>
                  <span className="text-base font-semibold text-white">{action.description}</span>
                  {action.label === 'Workspace' && recentHumanConversations.length > 0 && (
                    <span className="mt-1 text-xs text-white/60">{recentHumanConversations[0].meta.displayName} just replied</span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
