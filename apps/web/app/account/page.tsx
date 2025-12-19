"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

import AccountProfilePanel from '../../components/AccountProfilePanel';
import { useAuthIdentity } from '../../hooks/useAuthIdentity';
import { useProfileDetails } from '../../hooks/useProfileDetails';
import { getExpertBookings, getUserBookings } from '../../services/bookingApi';
import type { Booking } from '../../../../src/lib/db';

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
  const { profile } = profileState;
  const { identity } = useAuthIdentity();
  const [sessions, setSessions] = useState<Booking[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<string | null>(null);

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

  const panelSections = [
    {
      id: 'calendar',
      label: 'Full calendar',
      tagline: 'Review upcoming, past, and canceled sessions.',
      content: (
        <div className="space-y-3 text-sm text-white/70">
          <p>
            See every booking, transcript, and payout detail without leaving the account hub. The calendar opens in a
            dedicated view so you can filter by timeframe and type.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] text-white/50">
            <span>{sessions.length > 0 ? 'Next session already scheduled.' : 'No sessions on your calendar.'}</span>
            <Link
              href="/bookings"
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white/80 transition hover:border-white/40"
            >
              Open bookings
            </Link>
          </div>
        </div>
      )
    },
    {
      id: 'availability',
      label: 'Availability',
      tagline: 'Control when Sam can auto-book and who can find you.',
      content: (
        <div className="space-y-3 text-sm text-white/70">
          <ul className="space-y-1 text-white/60">
            <li>Instant status: {profile?.isOnline ? 'Online to members' : 'Offline / request only'}</li>
            <li>Display mode: {profile?.displayMode ?? 'normal'}</li>
            <li>Conversation type: {profile?.conversationType ?? 'free'}</li>
          </ul>
          <Link
            href="/expert/availability"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40"
          >
            Edit availability
          </Link>
        </div>
      )
    },
    {
      id: 'settings',
      label: 'Settings & preferences',
      tagline: 'Advanced controls for profile, notifications, and security.',
      content: (
        <div className="space-y-3 text-sm text-white/70">
          <p>
            Jump into the settings workspace for fine-grained control—payment methods, security keys, notifications, and
            integrations all live there.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/settings?tab=profile"
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40"
            >
              Profile settings
            </Link>
            <Link
              href="/settings"
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40"
            >
              All settings
            </Link>
          </div>
        </div>
      )
    }
  ];

  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="border-b border-white/10 px-6 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.35em] text-white/70 transition hover:text-white"
          >
            humanchat.com
          </Link>
          <p className="flex-1 text-center text-xs uppercase tracking-[0.45em] text-white/50">Account</p>
          <span className="text-xs text-white/60">
            {identity?.name ? `Signed in as ${identity.name}` : 'Not signed in'}
          </span>
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-white">Your operating console</h1>
        <p className="mt-2 text-sm text-white/60">
          {identity?.name ? 'Update everything from one place.' : 'Sign in to manage your account.'}
        </p>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 pb-12">
        <div className="flex flex-col gap-8 py-10">
          <AccountProfilePanel profileState={profileState} />

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
          <div className="space-y-4">
            {panelSections.map((panel) => {
              const isOpen = openPanel === panel.id;
              return (
                <section key={panel.id} className="rounded-3xl border border-white/12 bg-white/5">
                  <button
                    type="button"
                    onClick={() => setOpenPanel((prev) => (prev === panel.id ? null : panel.id))}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">{panel.label}</p>
                      <p className="text-sm text-white/70">{panel.tagline}</p>
                    </div>
                    <span className="text-xl text-white/60">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && <div className="border-t border-white/10 px-5 py-4">{panel.content}</div>}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
