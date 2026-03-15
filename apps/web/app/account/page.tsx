"use client";

import Link from 'next/link';
import { useState } from 'react';

import { BookingsManager } from '../../components/BookingsManager';
import SettingsConnectionsPanel from '../../components/settings/SettingsConnectionsPanel';
import SettingsProfilePanel from '../../components/settings/SettingsProfilePanel';
import { useAuthIdentity } from '../../hooks/useAuthIdentity';
import { useProfileDetails } from '../../hooks/useProfileDetails';
import { useSettings } from '../../hooks/useSettings';

export default function AccountPage() {
  const profileState = useProfileDetails();
  const { identity } = useAuthIdentity();
  const settingsState = useSettings();
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  const panelSections = [
    {
      id: 'settings-profile',
      label: 'Profile',
      tagline: 'Update public details, narrative, and preferences.',
      content: <SettingsProfilePanel embedded profileState={profileState} />
    },
    {
      id: 'settings-connections',
      label: 'Preferences',
      tagline: 'Presence toggle, paid modes, and integrations.',
      content: <SettingsConnectionsPanel embedded settingsState={settingsState} />
    },
    {
      id: 'calendar',
      label: 'Full calendar',
      tagline: 'Review upcoming, past, and canceled sessions.',
      content: (
        <div className="space-y-4">
          <BookingsManager embedded />
        </div>
      )
    }
  ];

  return (
    <main
      className="account-page min-h-screen text-text-primary"
      style={{ background: 'radial-gradient(circle at top, rgba(160,113,79,0.14), transparent 52%), var(--background-primary)' }}
    >
      <header className="px-6 pt-8 pb-2">
        <div className="flex items-center justify-center">
          <Link
            href="/"
            className="group relative text-lg font-bold uppercase tracking-[0.45em] text-text-secondary transition hover:text-text-primary"
          >
            <span
              className="relative z-10"
              style={{
                textShadow: '0 0 20px rgba(160,113,79,0.22), 0 1px 2px rgba(44,31,20,0.1)'
              }}
            >
              Humanchat.com
            </span>
            <span
              className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              aria-hidden
              style={{
                textShadow: '0 0 36px rgba(160,113,79,0.28), 0 0 72px rgba(160,113,79,0.12)'
              }}
            />
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
        <div className="space-y-4">
          {panelSections.map((panel) => {
            const isOpen = openPanel === panel.id;
            return (
              <section
                key={panel.id}
                className="rounded-3xl border backdrop-blur-sm transition-colors"
                style={{ borderColor: 'var(--border-subtle)', background: 'color-mix(in srgb, var(--background-tertiary) 86%, transparent)' }}
              >
                <button
                  type="button"
                  onClick={() => setOpenPanel((prev) => (prev === panel.id ? null : panel.id))}
                  className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] font-medium text-text-tertiary">{panel.label}</p>
                    <p className="mt-0.5 text-sm text-text-secondary">{panel.tagline}</p>
                  </div>
                  <span className="text-lg text-text-tertiary transition-transform duration-200" style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(0deg)' }}>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && <div className="border-t px-6 py-5" style={{ borderColor: 'var(--border-subtle)' }}>{panel.content}</div>}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
