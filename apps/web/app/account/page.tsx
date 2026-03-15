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
    <main className="min-h-screen bg-midnight text-white bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_50%)]">
      <header className="px-6 pt-8 pb-2">
        <div className="flex items-center justify-center">
          <Link
            href="/"
            className="group relative text-lg font-bold uppercase tracking-[0.45em] text-white/90 transition hover:text-white"
          >
            <span
              className="relative z-10"
              style={{
                textShadow: '0 0 30px rgba(59,130,246,0.4), 0 2px 8px rgba(0,0,0,0.6), 0 0 2px rgba(255,255,255,0.15)'
              }}
            >
              Humanchat.com
            </span>
            <span
              className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              aria-hidden
              style={{
                textShadow: '0 0 40px rgba(59,130,246,0.6), 0 0 80px rgba(59,130,246,0.2)'
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
                className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-sm transition-colors hover:border-white/15"
              >
                <button
                  type="button"
                  onClick={() => setOpenPanel((prev) => (prev === panel.id ? null : panel.id))}
                  className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-white/45 font-medium">{panel.label}</p>
                    <p className="mt-0.5 text-sm text-white/65">{panel.tagline}</p>
                  </div>
                  <span className="text-lg text-white/40 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(0deg)' }}>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && <div className="border-t border-white/8 px-6 py-5">{panel.content}</div>}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
