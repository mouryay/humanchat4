'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import type { UseProfileDetailsResult } from '../hooks/useProfileDetails';

interface ProfileDetailsSummaryProps {
  profileState: UseProfileDetailsResult;
}

export default function ProfileDetailsSummary({ profileState }: ProfileDetailsSummaryProps) {
  const { profile, loading, error, refresh } = profileState;

  const initials = useMemo(() => {
    if (!profile?.name) return 'HC';
    const parts = profile.name.trim().split(/\s+/);
    return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'HC';
  }, [profile?.name]);

  const completionSections = useMemo(() => {
    if (!profile) return [];
    return [
      { label: 'Name', filled: Boolean(profile.name?.trim()) },
      { label: 'About', filled: Boolean(profile.bio?.trim()) },
      { label: 'Experiences', filled: (profile.livedExperiences?.length ?? 0) > 0, count: profile.livedExperiences?.length },
      { label: 'Products & Services', filled: (profile.productsServices?.length ?? 0) > 0, count: profile.productsServices?.length },
      { label: 'Places', filled: (profile.placesKnown?.length ?? 0) > 0, count: profile.placesKnown?.length },
      { label: 'Interests', filled: (profile.interestsHobbies?.length ?? 0) > 0, count: profile.interestsHobbies?.length },
      { label: 'Dealing with', filled: (profile.currentlyDealingWith?.length ?? 0) > 0, count: profile.currentlyDealingWith?.length },
      { label: 'Languages', filled: (profile.languages?.length ?? 0) > 0 },
      { label: 'Education', filled: Boolean(profile.education?.trim()) },
      { label: 'Social links', filled: Boolean(profile.linkedinUrl || profile.facebookUrl || profile.instagramUrl || profile.otherSocialUrl) }
    ];
  }, [profile]);

  const filledCount = completionSections.filter((s) => s.filled).length;
  const totalCount = completionSections.length;
  const completionPct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  if (loading) {
    return <p className="text-sm text-white/70">Loading profile...</p>;
  }

  if (!loading && error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
        <p>{error}</p>
        <button type="button" onClick={() => refresh()} className="mt-3 rounded-full border border-rose-200/40 px-3 py-1 text-xs font-semibold text-rose-50">
          Try again
        </button>
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-white/70">Sign in to view your profile.</p>;
  }

  return (
    <div className="flex flex-col gap-5 text-white">
      {/* Profile card preview */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs text-white/40 mb-3">This is how Sam introduces you</p>
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/20">
            {profile.avatarUrl ? (
              <Image src={profile.avatarUrl} alt="Avatar" fill sizes="56px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/70">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold text-white truncate">{profile.name}</p>
            {profile.headline && (
              <p className="text-sm text-white/60 truncate">{profile.headline}</p>
            )}
          </div>
        </div>
        {profile.bio && (
          <p className="mt-3 text-sm leading-relaxed text-white/70 line-clamp-3">{profile.bio}</p>
        )}
        {!profile.bio && (
          <p className="mt-3 text-sm text-white/30 italic">No bio yet. Write something in the "About you" box above.</p>
        )}
      </div>

      {/* Completion meter */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-white/80">Profile completeness</p>
          <span className="text-sm font-semibold text-white">{completionPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-4">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigoGlow to-aqua transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {completionSections.map((section) => (
            <div key={section.label} className="flex items-center gap-2 text-sm">
              <span className={section.filled ? 'text-emerald-400' : 'text-white/20'}>
                {section.filled ? '●' : '○'}
              </span>
              <span className={section.filled ? 'text-white/70' : 'text-white/30'}>
                {section.label}
                {section.count && section.count > 0 ? ` (${section.count})` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* What Sam knows — your entries in your words */}
      {(() => {
        const sections: { label: string; items: string[] }[] = [];
        if (profile.livedExperiences && profile.livedExperiences.length > 0) {
          sections.push({ label: 'Experiences', items: profile.livedExperiences.map((e) => e.rawText).filter(Boolean) });
        }
        if (profile.productsServices && profile.productsServices.length > 0) {
          sections.push({ label: 'Products & Services', items: profile.productsServices.map((e) => e.rawText).filter(Boolean) });
        }
        if (profile.placesKnown && profile.placesKnown.length > 0) {
          sections.push({ label: 'Places', items: profile.placesKnown.map((e) => e.rawText).filter(Boolean) });
        }
        if (profile.interestsHobbies && profile.interestsHobbies.length > 0) {
          sections.push({ label: 'Interests', items: profile.interestsHobbies.map((e) => e.rawText).filter(Boolean) });
        }
        if (profile.currentlyDealingWith && profile.currentlyDealingWith.length > 0) {
          sections.push({ label: 'Dealing with', items: profile.currentlyDealingWith.map((e) => e.rawText).filter(Boolean) });
        }

        if (sections.length === 0) return null;

        return (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs text-white/40 mb-3">What Sam knows about you, in your words</p>
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.label}>
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/50 mb-2">{section.label}</p>
                  <div className="space-y-1.5">
                    {section.items.map((item, i) => (
                      <p key={i} className="text-sm text-white/70 leading-relaxed pl-3 border-l-2 border-white/10">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
