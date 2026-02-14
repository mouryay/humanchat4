'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/* ── Shared helpers ───────────────────────────────────────────────── */

const inputClass =
  'w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-aqua/60 focus:outline-none';
const selectClass =
  'w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-aqua/60 focus:outline-none appearance-none';
const cardClass =
  'relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3';
const removeBtn =
  'absolute top-3 right-3 text-white/30 hover:text-rose-400 transition text-lg leading-none';
const addBtnClass =
  'w-full rounded-2xl border border-dashed border-white/15 py-3 text-sm text-white/50 hover:border-white/30 hover:text-white/70 transition';

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
          className={`flex-1 ${inputClass}`}
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

/* ── Sub-section header ───────────────────────────────────────────── */

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between pb-2 border-b border-white/8 mb-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-white/60">{title}</h3>
      {count !== undefined && (
        <span className="text-xs text-white/40">{count} {count === 1 ? 'entry' : 'entries'}</span>
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

/* ── Default entry factories ──────────────────────────────────────── */

const newLivedExperience = (): LivedExperience => ({
  type: '',
  situation: '',
  location: null,
  timePeriod: null,
  status: null,
  canHelpWith: null,
  visibility: 'public',
  willingToDiscuss: 'yes'
});

const newProductService = (): ProductService => ({
  category: '',
  name: '',
  duration: null,
  usageContext: null,
  opinion: null,
  wouldRecommend: null
});

const newPlaceKnown = (): PlaceKnown => ({
  type: '',
  name: '',
  relationship: null,
  timePeriod: null,
  insights: null,
  wouldRecommend: null
});

const newInterestHobby = (): InterestHobby => ({
  name: '',
  engagement: null,
  skillLevel: null,
  lookingTo: null
});

const newCurrentlyDealingWith = (): CurrentlyDealingWith => ({
  situation: '',
  timeIn: null,
  lookingFor: null
});

/* ── Main form ────────────────────────────────────────────────────── */

export default function AccountExtendedProfileForm({ profileState }: AccountExtendedProfileFormProps) {
  const { profile, save, saving } = profileState;

  // Structured JSONB arrays
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

  // Collapsed sub-sections
  const [openSub, setOpenSub] = useState<string | null>(null);
  const toggleSub = (id: string) => setOpenSub((prev) => (prev === id ? null : id));

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
      // Filter out entries where the required fields are empty
      const validExperiences = livedExperiences.filter((e) => e.type && e.situation);
      const validProducts = productsServices.filter((e) => e.category && e.name);
      const validPlaces = placesKnown.filter((e) => e.type && e.name);
      const validInterests = interestsHobbies.filter((e) => e.name);
      const validDealing = currentlyDealingWith.filter((e) => e.situation);

      await save({
        livedExperiences: validExperiences,
        productsServices: validProducts,
        placesKnown: validPlaces,
        interestsHobbies: validInterests,
        currentlyDealingWith: validDealing,
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

  /* ── Generic entry helpers ─────────────────────────────────────── */

  const updateEntry = <T,>(
    list: T[],
    setList: React.Dispatch<React.SetStateAction<T[]>>,
    index: number,
    field: keyof T,
    value: T[keyof T]
  ) => {
    setList(list.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  };

  const removeEntry = <T,>(list: T[], setList: React.Dispatch<React.SetStateAction<T[]>>, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  /* ── Sub-section components ────────────────────────────────────── */

  const subSections = [
    {
      id: 'lived',
      title: 'Lived Experiences',
      count: livedExperiences.length,
      hint: 'Health, legal, financial, career, or life transitions you\'ve navigated.',
      content: (
        <div className="space-y-3">
          {livedExperiences.map((exp, i) => (
            <div key={i} className={cardClass}>
              <button type="button" className={removeBtn} onClick={() => removeEntry(livedExperiences, setLivedExperiences, i)}>&times;</button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={exp.type} onChange={(e) => updateEntry(livedExperiences, setLivedExperiences, i, 'type', e.target.value)} className={selectClass}>
                  <option value="">Type...</option>
                  <option value="health">Health</option>
                  <option value="legal">Legal</option>
                  <option value="financial">Financial</option>
                  <option value="career">Career</option>
                  <option value="life_transition">Life transition</option>
                  <option value="other">Other</option>
                </select>
                <input value={exp.situation} onChange={(e) => updateEntry(livedExperiences, setLivedExperiences, i, 'situation', e.target.value)} placeholder="Specific situation" className={inputClass} />
                <input value={exp.location ?? ''} onChange={(e) => updateEntry(livedExperiences, setLivedExperiences, i, 'location', e.target.value || null)} placeholder="Location (optional)" className={inputClass} />
                <input value={exp.timePeriod ?? ''} onChange={(e) => updateEntry(livedExperiences, setLivedExperiences, i, 'timePeriod', e.target.value || null)} placeholder="Time period (optional)" className={inputClass} />
                <select value={exp.status ?? ''} onChange={(e) => updateEntry(livedExperiences, setLivedExperiences, i, 'status', (e.target.value || null) as LivedExperience['status'])} className={selectClass}>
                  <option value="">Status...</option>
                  <option value="resolved">Resolved</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="recurring">Recurring</option>
                </select>
                <input value={exp.canHelpWith ?? ''} onChange={(e) => updateEntry(livedExperiences, setLivedExperiences, i, 'canHelpWith', e.target.value || null)} placeholder="What I can help with" className={inputClass} />
                <select value={exp.visibility ?? 'public'} onChange={(e) => updateEntry(livedExperiences, setLivedExperiences, i, 'visibility', e.target.value as LivedExperience['visibility'])} className={selectClass}>
                  <option value="public">Public</option>
                  <option value="match_only">Match only</option>
                  <option value="private">Private</option>
                </select>
                <select value={exp.willingToDiscuss ?? 'yes'} onChange={(e) => updateEntry(livedExperiences, setLivedExperiences, i, 'willingToDiscuss', e.target.value as LivedExperience['willingToDiscuss'])} className={selectClass}>
                  <option value="yes">Willing to discuss</option>
                  <option value="only_if_asked">Only if asked</option>
                  <option value="no">Not willing to discuss</option>
                </select>
              </div>
            </div>
          ))}
          <button type="button" className={addBtnClass} onClick={() => setLivedExperiences([...livedExperiences, newLivedExperience()])}>+ Add experience</button>
        </div>
      )
    },
    {
      id: 'products',
      title: 'Products & Services I Use',
      count: productsServices.length,
      hint: 'Vehicles, software, services, appliances — things you know well.',
      content: (
        <div className="space-y-3">
          {productsServices.map((prod, i) => (
            <div key={i} className={cardClass}>
              <button type="button" className={removeBtn} onClick={() => removeEntry(productsServices, setProductsServices, i)}>&times;</button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={prod.category} onChange={(e) => updateEntry(productsServices, setProductsServices, i, 'category', e.target.value)} className={selectClass}>
                  <option value="">Category...</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="software">Software</option>
                  <option value="service">Service</option>
                  <option value="appliance">Appliance</option>
                  <option value="other">Other</option>
                </select>
                <input value={prod.name} onChange={(e) => updateEntry(productsServices, setProductsServices, i, 'name', e.target.value)} placeholder="Name / brand / model" className={inputClass} />
                <input value={prod.duration ?? ''} onChange={(e) => updateEntry(productsServices, setProductsServices, i, 'duration', e.target.value || null)} placeholder="Duration of use" className={inputClass} />
                <input value={prod.usageContext ?? ''} onChange={(e) => updateEntry(productsServices, setProductsServices, i, 'usageContext', e.target.value || null)} placeholder="Usage context (mileage, plan, etc.)" className={inputClass} />
                <input value={prod.opinion ?? ''} onChange={(e) => updateEntry(productsServices, setProductsServices, i, 'opinion', e.target.value || null)} placeholder="Key opinion / review" className={`${inputClass} sm:col-span-2`} />
                <select value={prod.wouldRecommend ?? ''} onChange={(e) => updateEntry(productsServices, setProductsServices, i, 'wouldRecommend', (e.target.value || null) as ProductService['wouldRecommend'])} className={selectClass}>
                  <option value="">Would recommend?</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="with_caveats">With caveats</option>
                </select>
              </div>
            </div>
          ))}
          <button type="button" className={addBtnClass} onClick={() => setProductsServices([...productsServices, newProductService()])}>+ Add product or service</button>
        </div>
      )
    },
    {
      id: 'places',
      title: 'Places I Know',
      count: placesKnown.length,
      hint: 'Neighborhoods, cities, venues you can speak about.',
      content: (
        <div className="space-y-3">
          {placesKnown.map((place, i) => (
            <div key={i} className={cardClass}>
              <button type="button" className={removeBtn} onClick={() => removeEntry(placesKnown, setPlacesKnown, i)}>&times;</button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={place.type} onChange={(e) => updateEntry(placesKnown, setPlacesKnown, i, 'type', e.target.value)} className={selectClass}>
                  <option value="">Place type...</option>
                  <option value="neighborhood">Neighborhood</option>
                  <option value="city">City</option>
                  <option value="building">Building</option>
                  <option value="venue">Venue</option>
                  <option value="other">Other</option>
                </select>
                <input value={place.name} onChange={(e) => updateEntry(placesKnown, setPlacesKnown, i, 'name', e.target.value)} placeholder="Place name" className={inputClass} />
                <select value={place.relationship ?? ''} onChange={(e) => updateEntry(placesKnown, setPlacesKnown, i, 'relationship', (e.target.value || null) as PlaceKnown['relationship'])} className={selectClass}>
                  <option value="">Relationship...</option>
                  <option value="resident">Resident</option>
                  <option value="former_resident">Former resident</option>
                  <option value="frequent_visitor">Frequent visitor</option>
                  <option value="visitor">Visitor</option>
                </select>
                <input value={place.timePeriod ?? ''} onChange={(e) => updateEntry(placesKnown, setPlacesKnown, i, 'timePeriod', e.target.value || null)} placeholder="Time period" className={inputClass} />
                <input value={place.insights ?? ''} onChange={(e) => updateEntry(placesKnown, setPlacesKnown, i, 'insights', e.target.value || null)} placeholder="Key insights" className={`${inputClass} sm:col-span-2`} />
                <select value={place.wouldRecommend ?? ''} onChange={(e) => updateEntry(placesKnown, setPlacesKnown, i, 'wouldRecommend', (e.target.value || null) as PlaceKnown['wouldRecommend'])} className={selectClass}>
                  <option value="">Would recommend?</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="with_caveats">With caveats</option>
                </select>
              </div>
            </div>
          ))}
          <button type="button" className={addBtnClass} onClick={() => setPlacesKnown([...placesKnown, newPlaceKnown()])}>+ Add place</button>
        </div>
      )
    },
    {
      id: 'interests',
      title: 'Interests & Hobbies',
      count: interestsHobbies.length,
      hint: 'What you enjoy, how seriously, and what you want from it.',
      content: (
        <div className="space-y-3">
          {interestsHobbies.map((interest, i) => (
            <div key={i} className={cardClass}>
              <button type="button" className={removeBtn} onClick={() => removeEntry(interestsHobbies, setInterestsHobbies, i)}>&times;</button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={interest.name} onChange={(e) => updateEntry(interestsHobbies, setInterestsHobbies, i, 'name', e.target.value)} placeholder="Interest name" className={`${inputClass} sm:col-span-2`} />
                <select value={interest.engagement ?? ''} onChange={(e) => updateEntry(interestsHobbies, setInterestsHobbies, i, 'engagement', (e.target.value || null) as InterestHobby['engagement'])} className={selectClass}>
                  <option value="">Engagement level...</option>
                  <option value="casual">Casual</option>
                  <option value="regular">Regular</option>
                  <option value="serious">Serious</option>
                </select>
                <select value={interest.skillLevel ?? ''} onChange={(e) => updateEntry(interestsHobbies, setInterestsHobbies, i, 'skillLevel', (e.target.value || null) as InterestHobby['skillLevel'])} className={selectClass}>
                  <option value="">Skill level...</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                </select>
                <select value={interest.lookingTo ?? ''} onChange={(e) => updateEntry(interestsHobbies, setInterestsHobbies, i, 'lookingTo', (e.target.value || null) as InterestHobby['lookingTo'])} className={selectClass}>
                  <option value="">Looking to...</option>
                  <option value="learn">Learn</option>
                  <option value="share">Share</option>
                  <option value="collaborate">Collaborate</option>
                  <option value="just_enjoy">Just enjoy</option>
                </select>
              </div>
            </div>
          ))}
          <button type="button" className={addBtnClass} onClick={() => setInterestsHobbies([...interestsHobbies, newInterestHobby()])}>+ Add interest</button>
        </div>
      )
    },
    {
      id: 'dealing',
      title: 'Currently Dealing With',
      count: currentlyDealingWith.length,
      hint: 'Things you\'re navigating right now and what kind of support would help.',
      content: (
        <div className="space-y-3">
          {currentlyDealingWith.map((item, i) => (
            <div key={i} className={cardClass}>
              <button type="button" className={removeBtn} onClick={() => removeEntry(currentlyDealingWith, setCurrentlyDealingWith, i)}>&times;</button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={item.situation} onChange={(e) => updateEntry(currentlyDealingWith, setCurrentlyDealingWith, i, 'situation', e.target.value)} placeholder="Situation" className={`${inputClass} sm:col-span-2`} />
                <input value={item.timeIn ?? ''} onChange={(e) => updateEntry(currentlyDealingWith, setCurrentlyDealingWith, i, 'timeIn', e.target.value || null)} placeholder="How long / what stage" className={inputClass} />
                <select value={item.lookingFor ?? ''} onChange={(e) => updateEntry(currentlyDealingWith, setCurrentlyDealingWith, i, 'lookingFor', (e.target.value || null) as CurrentlyDealingWith['lookingFor'])} className={selectClass}>
                  <option value="">Looking for...</option>
                  <option value="advice">Advice</option>
                  <option value="support">Support</option>
                  <option value="just_relating">Just relating</option>
                </select>
              </div>
            </div>
          ))}
          <button type="button" className={addBtnClass} onClick={() => setCurrentlyDealingWith([...currentlyDealingWith, newCurrentlyDealingWith()])}>+ Add situation</button>
        </div>
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
          Help Sam match you with the right people. Share as much or as little as you want.
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
