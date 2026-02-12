'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UseProfileDetailsResult } from '../hooks/useProfileDetails';

interface AccountExtendedProfileFormProps {
  profileState: UseProfileDetailsResult;
}

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i);

const parseDob = (dob: string | null): { month: string; year: string } => {
  if (!dob) return { month: '', year: '' };
  const parts = dob.split('/');
  if (parts.length === 2) {
    return { month: parts[0], year: parts[1] };
  }
  return { month: '', year: '' };
};

const formatDob = (month: string, year: string): string | null => {
  if (!month || !year) return null;
  return `${month.padStart(2, '0')}/${year}`;
};

export default function AccountExtendedProfileForm({ profileState }: AccountExtendedProfileFormProps) {
  const { profile, save, saving } = profileState;

  const [interests, setInterests] = useState('');
  const [experiences, setExperiences] = useState('');
  const [locationBorn, setLocationBorn] = useState('');
  const [citiesLivedIn, setCitiesLivedIn] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [acceptInbound, setAcceptInbound] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setInterests((profile.interests ?? []).join(', '));
    setExperiences(profile.experiences ?? '');
    setLocationBorn(profile.locationBorn ?? '');
    setCitiesLivedIn((profile.citiesLivedIn ?? []).join(', '));
    const dob = parseDob(profile.dateOfBirth);
    setDobMonth(dob.month);
    setDobYear(dob.year);
    setAcceptInbound(profile.acceptInboundRequests ?? false);
    setStatus('idle');
    setMessage(null);
  }, [
    profile?.interests,
    profile?.experiences,
    profile?.locationBorn,
    profile?.citiesLivedIn,
    profile?.dateOfBirth,
    profile?.acceptInboundRequests
  ]);

  const parseList = (value: string): string[] =>
    value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    const currentInterests = (profile.interests ?? []).join(', ');
    const currentCities = (profile.citiesLivedIn ?? []).join(', ');
    const currentDob = parseDob(profile.dateOfBirth);
    return (
      interests.trim() !== currentInterests ||
      experiences.trim() !== (profile.experiences ?? '') ||
      locationBorn.trim() !== (profile.locationBorn ?? '') ||
      citiesLivedIn.trim() !== currentCities ||
      dobMonth !== currentDob.month ||
      dobYear !== currentDob.year ||
      acceptInbound !== (profile.acceptInboundRequests ?? false)
    );
  }, [profile, interests, experiences, locationBorn, citiesLivedIn, dobMonth, dobYear, acceptInbound]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setStatus('idle');
    setMessage(null);
    try {
      await save({
        interests: parseList(interests),
        experiences: experiences.trim() || null,
        locationBorn: locationBorn.trim() || null,
        citiesLivedIn: parseList(citiesLivedIn),
        dateOfBirth: formatDob(dobMonth, dobYear),
        acceptInboundRequests: acceptInbound
      });
      setStatus('success');
      setMessage('Profile updated.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to save right now.');
    }
  };

  const inputClass =
    'rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white focus:border-aqua/60 focus:outline-none';
  const selectClass =
    'rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white focus:border-aqua/60 focus:outline-none appearance-none';

  return (
    <section className="rounded-3xl border border-white/12 bg-[rgba(15,23,42,0.85)] p-6 text-white shadow-[0_25px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Extended profile</p>
        <h2 className="text-2xl font-semibold">More about you</h2>
        <p className="text-sm text-white/70">
          Help Sam match you with the right people. Share as much or as little as you want.
        </p>
      </header>

      {!profile && (
        <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Sign in to edit your profile.
        </p>
      )}

      {profile && (
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {/* Inbound requests toggle */}
          <label className="flex items-center gap-3 text-sm text-white/80 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={acceptInbound}
                onChange={(e) => setAcceptInbound(e.target.checked)}
                className="sr-only peer"
              />
              <div className="h-6 w-11 rounded-full bg-white/15 peer-checked:bg-aqua/60 transition-colors" />
              <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </div>
            <div>
              <span className="font-medium">Accept inbound requests</span>
              <p className="text-xs text-white/50 mt-0.5">Allow other users to discover you and request conversations.</p>
            </div>
          </label>

          {/* Interests */}
          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="profile-interests">
            Interests
            <input
              id="profile-interests"
              type="text"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g. technology, cooking, travel, photography"
              className={inputClass}
            />
            <span className="text-xs text-white/50">Comma-separated list of things you are interested in.</span>
          </label>

          {/* Experiences */}
          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="profile-experiences">
            Experiences
            <textarea
              id="profile-experiences"
              value={experiences}
              onChange={(e) => setExperiences(e.target.value)}
              placeholder="Share your professional or life experiences..."
              className={inputClass}
              rows={4}
            />
            <span className="text-xs text-white/50">
              A summary of your professional background, life experiences, or anything you want people to know.
            </span>
          </label>

          {/* Location born */}
          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="profile-location-born">
            Where were you born?
            <input
              id="profile-location-born"
              type="text"
              value={locationBorn}
              onChange={(e) => setLocationBorn(e.target.value)}
              placeholder="e.g. Austin, TX"
              className={inputClass}
            />
          </label>

          {/* Cities lived in */}
          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="profile-cities">
            Cities you have lived in
            <input
              id="profile-cities"
              type="text"
              value={citiesLivedIn}
              onChange={(e) => setCitiesLivedIn(e.target.value)}
              placeholder="e.g. New York, San Francisco, London"
              className={inputClass}
            />
            <span className="text-xs text-white/50">Comma-separated list of cities.</span>
          </label>

          {/* Date of birth */}
          <fieldset className="flex flex-col gap-2 text-sm text-white/80">
            <legend className="mb-1">Date of birth (month / year)</legend>
            <div className="flex gap-3">
              <select
                value={dobMonth}
                onChange={(e) => setDobMonth(e.target.value)}
                className={`${selectClass} flex-1`}
              >
                <option value="">Month</option>
                {MONTHS.slice(1).map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={dobYear}
                onChange={(e) => setDobYear(e.target.value)}
                className={`${selectClass} flex-1`}
              >
                <option value="">Year</option>
                {YEARS.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-white/50">Only month and year. Used by Sam for context, not shown publicly.</span>
          </fieldset>

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
              disabled={!hasChanges || saving}
              className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-6 py-3 text-sm font-semibold text-midnight disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
