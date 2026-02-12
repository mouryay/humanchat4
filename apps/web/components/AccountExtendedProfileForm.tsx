'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UseProfileDetailsResult } from '../hooks/useProfileDetails';

interface AccountExtendedProfileFormProps {
  profileState: UseProfileDetailsResult;
}

/* ── Tag / chip input ─────────────────────────────────────────────── */

interface TagInputProps {
  id: string;
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  hint?: string;
}

function TagInput({ id, label, tags, onChange, placeholder, hint }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = useCallback(() => {
    const value = draft.trim();
    if (!value) return;
    // Avoid duplicates (case-insensitive)
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...tags, value]);
    setDraft('');
    inputRef.current?.focus();
  }, [draft, tags, onChange]);

  const remove = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
    },
    [tags, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
    // Backspace on empty input removes last tag
    if (e.key === 'Backspace' && !draft && tags.length > 0) {
      remove(tags.length - 1);
    }
  };

  return (
    <fieldset className="flex flex-col gap-2 text-sm text-white/80">
      <div className="flex items-center justify-between">
        <legend className="font-medium">{label}</legend>
        <span className="text-xs text-white/40">{tags.length} {label.toLowerCase()}</span>
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? `Type and press enter`}
          className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-aqua/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/12 disabled:opacity-30"
        >
          add
        </button>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {tags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3 py-1.5 text-sm text-white"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-white/40 hover:text-white transition ml-0.5"
                aria-label={`Remove ${tag}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {hint && <span className="text-xs text-white/40">{hint}</span>}
    </fieldset>
  );
}

/* ── Date of birth selectors ──────────────────────────────────────── */

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i);

const parseDob = (dob: string | null): { month: string; year: string } => {
  if (!dob) return { month: '', year: '' };
  const parts = dob.split('/');
  if (parts.length === 2) return { month: parts[0], year: parts[1] };
  return { month: '', year: '' };
};

const formatDob = (month: string, year: string): string | null => {
  if (!month || !year) return null;
  return `${month.padStart(2, '0')}/${year}`;
};

/* ── Main form ────────────────────────────────────────────────────── */

export default function AccountExtendedProfileForm({ profileState }: AccountExtendedProfileFormProps) {
  const { profile, save, saving } = profileState;

  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [experiences, setExperiences] = useState('');
  const [locationBorn, setLocationBorn] = useState('');
  const [citiesLivedIn, setCitiesLivedIn] = useState<string[]>([]);
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [acceptInbound, setAcceptInbound] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setInterests(profile.interests ?? []);
    setSkills(profile.skills ?? []);
    setExperiences(profile.experiences ?? '');
    setLocationBorn(profile.locationBorn ?? '');
    setCitiesLivedIn(profile.citiesLivedIn ?? []);
    const dob = parseDob(profile.dateOfBirth);
    setDobMonth(dob.month);
    setDobYear(dob.year);
    setAcceptInbound(profile.acceptInboundRequests ?? false);
    setStatus('idle');
    setMessage(null);
  }, [
    profile?.interests,
    profile?.skills,
    profile?.experiences,
    profile?.locationBorn,
    profile?.citiesLivedIn,
    profile?.dateOfBirth,
    profile?.acceptInboundRequests
  ]);

  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    const currentDob = parseDob(profile.dateOfBirth);
    return (
      !arraysEqual(interests, profile.interests ?? []) ||
      !arraysEqual(skills, profile.skills ?? []) ||
      experiences.trim() !== (profile.experiences ?? '') ||
      locationBorn.trim() !== (profile.locationBorn ?? '') ||
      !arraysEqual(citiesLivedIn, profile.citiesLivedIn ?? []) ||
      dobMonth !== currentDob.month ||
      dobYear !== currentDob.year ||
      acceptInbound !== (profile.acceptInboundRequests ?? false)
    );
  }, [profile, interests, skills, experiences, locationBorn, citiesLivedIn, dobMonth, dobYear, acceptInbound]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setStatus('idle');
    setMessage(null);
    try {
      await save({
        interests,
        skills,
        experiences: experiences.trim() || null,
        locationBorn: locationBorn.trim() || null,
        citiesLivedIn,
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
    'rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-aqua/60 focus:outline-none';
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
        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
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

          <hr className="border-white/8" />

          {/* Interests - tag chips */}
          <TagInput
            id="profile-interests"
            label="Interests"
            tags={interests}
            onChange={setInterests}
            placeholder="Type an interest and press enter"
            hint="Things you enjoy or are curious about."
          />

          {/* Skills - tag chips */}
          <TagInput
            id="profile-skills"
            label="Skills"
            tags={skills}
            onChange={setSkills}
            placeholder="Type a skill and press enter"
            hint="Professional or personal skills you bring to conversations."
          />

          <hr className="border-white/8" />

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
            <span className="text-xs text-white/40">
              A summary of your background, career, or anything you want people to know.
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

          {/* Cities lived in - tag chips */}
          <TagInput
            id="profile-cities"
            label="Cities lived in"
            tags={citiesLivedIn}
            onChange={setCitiesLivedIn}
            placeholder="Type a city and press enter"
          />

          {/* Date of birth */}
          <fieldset className="flex flex-col gap-2 text-sm text-white/80">
            <legend className="mb-1 font-medium">Date of birth (month / year)</legend>
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
            <span className="text-xs text-white/40">Only month and year. Used by Sam for context, not shown publicly.</span>
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
