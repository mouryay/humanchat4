'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UseProfileDetailsResult } from '../hooks/useProfileDetails';

interface AccountNarrativeFormProps {
  profileState: UseProfileDetailsResult;
}

const HEADLINE_MAX = 160;
const BIO_MAX = 1500;

export default function AccountNarrativeForm({ profileState }: AccountNarrativeFormProps) {
  const { profile, save, saving } = profileState;
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHeadline(profile?.headline ?? '');
    setBio(profile?.bio ?? '');
    setStatus('idle');
    setMessage(null);
  }, [profile?.headline, profile?.bio]);

  const trimmedHeadline = headline.trim();
  const trimmedBio = bio.trim();

  const disableSubmit = useMemo(() => {
    if (!profile) return true;
    if (saving) return true;
    const currentHeadline = (profile.headline ?? '').trim();
    const currentBio = (profile.bio ?? '').trim();
    return trimmedHeadline === currentHeadline && trimmedBio === currentBio;
  }, [profile, saving, trimmedHeadline, trimmedBio]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setStatus('idle');
    setMessage(null);
    try {
      await save({
        headline: trimmedHeadline.length > 0 ? trimmedHeadline : null,
        bio: trimmedBio.length > 0 ? trimmedBio : null
      });
      setStatus('success');
      setMessage('Bio saved — Sam now has the latest story.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to save your story right now.');
    }
  };

  return (
    <section className="rounded-3xl border border-white/12 bg-[rgba(15,23,42,0.85)] p-6 text-white shadow-[0_25px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Bio & experience</p>
        <h2 className="text-2xl font-semibold">Tell Sam how to introduce you</h2>
        <p className="text-sm text-white/70">
          Sam reads this to suggest you to other members. Add the highlights you want surfaced when matches are made.
        </p>
      </header>

      {!profile && <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Sign in to edit your story.</p>}

      {profile && (
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="profile-experience-input">
            Experience headline
            <textarea
              id="profile-experience-input"
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              placeholder="ex: Product lead who scaled two AI teams"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white focus:border-aqua/60"
              rows={3}
              maxLength={HEADLINE_MAX}
            />
            <span className="text-xs text-white/50">
              Sam uses this line in quick recommendations. {Math.max(0, HEADLINE_MAX - headline.length)} characters left.
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="profile-bio-input">
            Full bio
            <textarea
              id="profile-bio-input"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Share the wins, industries, and communities you care about so Sam can match you well."
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white focus:border-aqua/60"
              rows={6}
              maxLength={BIO_MAX}
            />
            <span className="text-xs text-white/50">
              Sam shares excerpts from this when teeing up intros. {Math.max(0, BIO_MAX - bio.length)} characters left.
            </span>
          </label>

          {message && (
            <p
              className={`text-sm ${
                status === 'success' ? 'text-emerald-300' : status === 'error' ? 'text-rose-300' : 'text-white/70'
              }`}
            >
              {message}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={disableSubmit}
              className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-6 py-3 text-sm font-semibold text-midnight disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save bio'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
