'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseProfileDetailsResult } from '../hooks/useProfileDetails';
import type {
  LivedExperience,
  ProductService,
  PlaceKnown,
  InterestHobby,
  CurrentlyDealingWith
} from '../services/profileApi';

interface AccountExtendedProfileFormProps {
  profileState: UseProfileDetailsResult;
}

/* ── Tag / chip input (for simple string arrays) ──────────────────── */

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
    if (e.key === 'Backspace' && !draft && tags.length > 0) {
      remove(tags.length - 1);
    }
  };

  return (
    <fieldset className="flex flex-col gap-2 text-sm text-white/80">
      <div className="flex items-center justify-between">
        <legend className="font-medium">{label}</legend>
        <span className="text-xs text-white/40">{tags.length}</span>
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Type and press enter'}
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

/* ── Freeform entry input (for JSONB arrays with rawText) ─────────── */

interface FreeformEntryProps<T extends { rawText: string }> {
  label: string;
  hint: string;
  placeholder: string;
  entries: T[];
  onChange: (entries: T[]) => void;
  makeEntry: (text: string) => T;
}

function FreeformEntry<T extends { rawText: string }>({
  label,
  hint,
  placeholder,
  entries,
  onChange,
  makeEntry
}: FreeformEntryProps<T>) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    onChange([...entries, makeEntry(text)]);
    setDraft('');
    inputRef.current?.focus();
  }, [draft, entries, onChange, makeEntry]);

  const remove = useCallback(
    (index: number) => {
      onChange(entries.filter((_, i) => i !== index));
    },
    [entries, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/80">{label}</p>
        {entries.length > 0 && (
          <span className="text-xs text-white/40">{entries.length}</span>
        )}
      </div>
      <p className="text-xs text-white/40 -mt-1">{hint}</p>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
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

      {entries.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          {entries.map((entry, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <p className="flex-1 text-sm text-white leading-relaxed">{entry.rawText}</p>
              <button
                type="button"
                onClick={() => remove(index)}
                className="mt-0.5 text-white/30 hover:text-rose-400 transition text-lg leading-none shrink-0"
                aria-label="Remove"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
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

  // Structured JSONB arrays — user only sees rawText
  const [livedExperiences, setLivedExperiences] = useState<LivedExperience[]>([]);
  const [productsServices, setProductsServices] = useState<ProductService[]>([]);
  const [placesKnown, setPlacesKnown] = useState<PlaceKnown[]>([]);
  const [interestsHobbies, setInterestsHobbies] = useState<InterestHobby[]>([]);
  const [currentlyDealingWith, setCurrentlyDealingWith] = useState<CurrentlyDealingWith[]>([]);

  // Background fields
  const [locationBorn, setLocationBorn] = useState('');
  const [citiesLivedIn, setCitiesLivedIn] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [education, setEducation] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  // Matching preferences
  const [acceptInbound, setAcceptInbound] = useState(false);
  const [preferredConnectionTypes, setPreferredConnectionTypes] = useState<string[]>([]);
  const [topicsToAvoid, setTopicsToAvoid] = useState<string[]>([]);

  // UI state
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const toggleSub = (id: string) => setOpenSub((prev) => (prev === id ? null : id));

  const inputClass =
    'w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-aqua/60 focus:outline-none';
  const selectClass =
    'w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aqua/60 focus:outline-none appearance-none';

  useEffect(() => {
    if (!profile) return;
    setLivedExperiences(profile.livedExperiences ?? []);
    setProductsServices(profile.productsServices ?? []);
    setPlacesKnown(profile.placesKnown ?? []);
    setInterestsHobbies(profile.interestsHobbies ?? []);
    setCurrentlyDealingWith(profile.currentlyDealingWith ?? []);
    setLocationBorn(profile.locationBorn ?? '');
    setCitiesLivedIn(profile.citiesLivedIn ?? []);
    setLanguages(profile.languages ?? []);
    setEducation(profile.education ?? '');
    const dob = parseDob(profile.dateOfBirth);
    setDobMonth(dob.month);
    setDobYear(dob.year);
    setAcceptInbound(profile.acceptInboundRequests ?? false);
    setPreferredConnectionTypes(profile.preferredConnectionTypes ?? []);
    setTopicsToAvoid(profile.topicsToAvoid ?? []);
    setStatus('idle');
    setMessage(null);
  }, [profile]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setStatus('idle');
    setMessage(null);
    try {
      await save({
        livedExperiences: livedExperiences.filter((e) => e.rawText),
        productsServices: productsServices.filter((e) => e.rawText),
        placesKnown: placesKnown.filter((e) => e.rawText),
        interestsHobbies: interestsHobbies.filter((e) => e.rawText),
        currentlyDealingWith: currentlyDealingWith.filter((e) => e.rawText),
        locationBorn: locationBorn.trim() || null,
        citiesLivedIn,
        languages,
        education: education.trim() || null,
        dateOfBirth: formatDob(dobMonth, dobYear),
        acceptInboundRequests: acceptInbound,
        preferredConnectionTypes,
        topicsToAvoid
      });
      setStatus('success');
      setMessage('Profile updated.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to save right now.');
    }
  };

  /* ── Entry factories (user only provides rawText) ──────────────── */

  const makeLivedExperience = useCallback((text: string): LivedExperience => ({ rawText: text }), []);
  const makeProductService = useCallback((text: string): ProductService => ({ rawText: text }), []);
  const makePlaceKnown = useCallback((text: string): PlaceKnown => ({ rawText: text }), []);
  const makeInterestHobby = useCallback((text: string): InterestHobby => ({ rawText: text }), []);
  const makeDealingWith = useCallback((text: string): CurrentlyDealingWith => ({ rawText: text }), []);

  /* ── Sub-sections ──────────────────────────────────────────────── */

  const subSections = [
    {
      id: 'lived',
      title: 'Lived Experiences',
      count: livedExperiences.length,
      hint: 'What have you been through that you could help someone else with?',
      content: (
        <FreeformEntry
          label="Your experiences"
          hint="Type naturally. Sam will handle the rest behind the scenes."
          placeholder='e.g. "I went through a nasty divorce with kids involved"'
          entries={livedExperiences}
          onChange={setLivedExperiences}
          makeEntry={makeLivedExperience}
        />
      )
    },
    {
      id: 'products',
      title: 'Products & Services I Use',
      count: productsServices.length,
      hint: 'Things you own or use that you know well enough to talk about.',
      content: (
        <FreeformEntry
          label="Products and services"
          hint="Vehicles, software, services, appliances — anything you have opinions on."
          placeholder='e.g. "Tesla Model 3, 40k miles, love it but the service centers are a nightmare"'
          entries={productsServices}
          onChange={setProductsServices}
          makeEntry={makeProductService}
        />
      )
    },
    {
      id: 'places',
      title: 'Places I Know',
      count: placesKnown.length,
      hint: 'Places you know well enough to give someone real advice about.',
      content: (
        <FreeformEntry
          label="Places"
          hint="Neighborhoods, cities, venues — wherever you have insider knowledge."
          placeholder='e.g. "Lived in Austin TX for 8 years, know the east side like the back of my hand"'
          entries={placesKnown}
          onChange={setPlacesKnown}
          makeEntry={makePlaceKnown}
        />
      )
    },
    {
      id: 'interests',
      title: 'Interests & Hobbies',
      count: interestsHobbies.length,
      hint: 'What you enjoy, what you geek out about, what you want to learn.',
      content: (
        <FreeformEntry
          label="Interests"
          hint="Anything from serious pursuits to casual hobbies."
          placeholder='e.g. "Rock climbing — been doing it 5 years, lead up to 5.11"'
          entries={interestsHobbies}
          onChange={setInterestsHobbies}
          makeEntry={makeInterestHobby}
        />
      )
    },
    {
      id: 'dealing',
      title: 'Currently Dealing With',
      count: currentlyDealingWith.length,
      hint: 'Things you\'re navigating right now where connecting with someone who gets it would help.',
      content: (
        <FreeformEntry
          label="Current situations"
          hint="No judgment. Sam uses this to find people who've been where you are."
          placeholder='e.g. "Trying to negotiate a severance package after being laid off"'
          entries={currentlyDealingWith}
          onChange={setCurrentlyDealingWith}
          makeEntry={makeDealingWith}
        />
      )
    },
    {
      id: 'background',
      title: 'Background',
      count: undefined,
      hint: 'Where you\'re from, languages, and education.',
      content: (
        <div className="space-y-4">
          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="profile-location-born">
            Where born / raised
            <input
              id="profile-location-born"
              type="text"
              value={locationBorn}
              onChange={(e) => setLocationBorn(e.target.value)}
              placeholder="e.g. Austin, TX"
              className={inputClass}
            />
          </label>

          <TagInput
            id="profile-cities"
            label="Cities lived in"
            tags={citiesLivedIn}
            onChange={setCitiesLivedIn}
            placeholder="Type a city and press enter"
          />

          <TagInput
            id="profile-languages"
            label="Languages spoken"
            tags={languages}
            onChange={setLanguages}
            placeholder="e.g. English, Spanish"
          />

          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="profile-education">
            Education highlights
            <input
              id="profile-education"
              type="text"
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              placeholder="e.g. BS Computer Science, Stanford"
              className={inputClass}
            />
          </label>

          <fieldset className="flex flex-col gap-2 text-sm text-white/80">
            <legend className="mb-1 font-medium">Date of birth (month / year)</legend>
            <div className="flex gap-3">
              <select value={dobMonth} onChange={(e) => setDobMonth(e.target.value)} className={`${selectClass} flex-1`}>
                <option value="">Month</option>
                {MONTHS.slice(1).map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </select>
              <select value={dobYear} onChange={(e) => setDobYear(e.target.value)} className={`${selectClass} flex-1`}>
                <option value="">Year</option>
                {YEARS.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-white/40">Only month and year. Used by Sam for context, not shown publicly.</span>
          </fieldset>
        </div>
      )
    },
    {
      id: 'matching',
      title: 'Matching Preferences',
      count: undefined,
      hint: 'Control how others find and connect with you.',
      content: (
        <div className="space-y-4">
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
              <p className="text-xs text-white/50 mt-0.5">Allow others to discover you and request conversations.</p>
            </div>
          </label>

          <TagInput
            id="profile-connection-types"
            label="Preferred connection types"
            tags={preferredConnectionTypes}
            onChange={setPreferredConnectionTypes}
            placeholder="e.g. similar experiences, professional"
            hint="What kind of connections are you looking for?"
          />

          <TagInput
            id="profile-topics-avoid"
            label="Topics to avoid"
            tags={topicsToAvoid}
            onChange={setTopicsToAvoid}
            placeholder="e.g. politics, religion"
            hint="Sam will steer clear of matching you on these topics."
          />
        </div>
      )
    }
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-white backdrop-blur-sm">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Detailed profile</p>
        <h2 className="text-2xl font-semibold">More about you</h2>
        <p className="text-sm text-white/70">
          Just say it in your own words. Sam reads between the lines.
        </p>
      </header>

      {!profile && (
        <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Sign in to edit your profile.
        </p>
      )}

      {profile && (
        <form className="mt-6 space-y-2" onSubmit={handleSubmit}>
          {subSections.map((sub) => {
            const isOpen = openSub === sub.id;
            return (
              <div key={sub.id} className="rounded-2xl border border-white/8 bg-white/[0.02]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  onClick={() => toggleSub(sub.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/80">{sub.title}</p>
                    <p className="text-xs text-white/40 truncate">{sub.hint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.count !== undefined && sub.count > 0 && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">{sub.count}</span>
                    )}
                    <span className="text-lg text-white/40">{isOpen ? '−' : '+'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-white/8 px-4 py-4">
                    {sub.content}
                  </div>
                )}
              </div>
            );
          })}

          {message && (
            <p
              className={`text-sm mt-4 ${
                status === 'success' ? 'text-emerald-300' : status === 'error' ? 'text-rose-300' : 'text-white/70'
              }`}
            >
              {message}
            </p>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
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
