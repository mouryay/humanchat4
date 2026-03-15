'use client';

import { useState } from 'react';

import AccountExtendedProfileForm from '../AccountExtendedProfileForm';
import AccountSocialLinksForm from '../AccountSocialLinksForm';
import ProfileDetailsSummary from '../ProfileDetailsSummary';
import { useProfileDetails } from '../../hooks/useProfileDetails';

type ProfileState = ReturnType<typeof useProfileDetails>;

interface SettingsProfilePanelProps {
  profileState?: ProfileState;
  embedded?: boolean;
}

type ProfileSection = 'summary' | 'profile' | 'reputation' | null;

export default function SettingsProfilePanel({ profileState, embedded = false }: SettingsProfilePanelProps) {
  const resolvedProfileState = profileState ?? useProfileDetails();
  const containerClass = embedded ? 'space-y-6 text-white' : 'flex flex-col gap-8 text-white';
  const [openSection, setOpenSection] = useState<ProfileSection>('profile');

  const editSections = [
    {
      id: 'profile' as const,
      label: 'Bio',
      tagline: 'Name, bio, experiences, interests, and matching.',
      content: <AccountExtendedProfileForm profileState={resolvedProfileState} />
    },
    {
      id: 'reputation' as const,
      label: 'Social proof',
      tagline: 'LinkedIn, socials, and website links.',
      content: <AccountSocialLinksForm profileState={resolvedProfileState} />
    },
    {
      id: 'summary' as const,
      label: 'How members see you',
      tagline: 'At-a-glance public profile preview.',
      content: <ProfileDetailsSummary profileState={resolvedProfileState} />
    }
  ];

  return (
    <div className={containerClass}>
      <div className="space-y-3">
        {editSections.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <section key={section.id} className="rounded-3xl border border-white/10 bg-white/[0.03]">
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
