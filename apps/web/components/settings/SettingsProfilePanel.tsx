'use client';

import { useState } from 'react';

import ProfilePanel from '../ProfilePanel';
import AccountIdentityForm from '../AccountIdentityForm';
import AccountNarrativeForm from '../AccountNarrativeForm';
import AccountPreferencesForm from '../AccountPreferencesForm';
import ProfileDetailsSummary from '../ProfileDetailsSummary';
import { useProfileDetails } from '../../hooks/useProfileDetails';

type ProfileState = ReturnType<typeof useProfileDetails>;

interface SettingsProfilePanelProps {
  profileState?: ProfileState;
  embedded?: boolean;
}

type ProfileSection = 'identity' | 'story' | 'preferences' | null;

export default function SettingsProfilePanel({ profileState, embedded = false }: SettingsProfilePanelProps) {
  const resolvedProfileState = profileState ?? useProfileDetails();
  const containerClass = embedded ? 'space-y-6 text-white' : 'flex flex-col gap-8 text-white';
  const [openSection, setOpenSection] = useState<ProfileSection>('identity');

  const editSections = [
    {
      id: 'identity' as const,
      label: 'Identity & appearance',
      tagline: 'Avatar, name, and public basics.',
      content: (
        <div className="space-y-6">
          <ProfilePanel variant="card" />
          <AccountIdentityForm profileState={resolvedProfileState} />
        </div>
      )
    },
    {
      id: 'story' as const,
      label: 'Story & positioning',
      tagline: 'Headline and narrative members read.',
      content: <AccountNarrativeForm profileState={resolvedProfileState} />
    },
    {
      id: 'preferences' as const,
      label: 'Audience preferences',
      tagline: 'Formats, categories, and safety settings.',
      content: <AccountPreferencesForm profileState={resolvedProfileState} />
    }
  ];

  return (
    <div className={containerClass}>
      <ProfileDetailsSummary profileState={resolvedProfileState} />

      <div className="space-y-3">
        {editSections.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <section key={section.id} className="rounded-3xl border border-white/12 bg-white/5">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                onClick={() => setOpenSection((prev) => (prev === section.id ? null : section.id))}
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">{section.label}</p>
                  <p className="text-sm text-white/70">{section.tagline}</p>
                </div>
                <span className="text-xl text-white/60">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && <div className="border-t border-white/10 px-5 py-4">{section.content}</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
