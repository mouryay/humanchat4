'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import type { UseProfileDetailsResult } from '../hooks/useProfileDetails';
import type { ConversationCategory, ScheduledRateEntry } from '../services/profileApi';

const CONVERSATION_OPTIONS: Array<{ label: string; value: ConversationCategory; helper: string }> = [
  { label: 'Free', value: 'free', helper: 'Offer guidance without charging. Tips optional.' },
  { label: 'Paid', value: 'paid', helper: 'Charge per minute when members connect instantly.' },
  { label: 'Charity', value: 'charity', helper: 'Route earnings to the charity you selected.' }
];

const DISPLAY_OPTIONS: Array<{ label: string; value: 'normal' | 'by_request' | 'confidential'; helper: string }> = [
  { label: 'Everyone can see me', value: 'normal', helper: 'Show up in search and allow instant connects.' },
  { label: 'By request only', value: 'by_request', helper: 'Hide the connect button and rely on private asks.' },
  { label: 'Confidential', value: 'confidential', helper: 'Only Sam can introduce you to approved guests.' }
];

interface FormState {
  name: string;
  headline: string;
  bio: string;
  conversationType: ConversationCategory;
  instantRatePerMinute: string;
  displayMode: 'normal' | 'by_request' | 'confidential';
  isOnline: boolean;
  scheduledRates: ScheduledRateEntry[];
}

const buildFormState = (profile: UseProfileDetailsResult['profile']): FormState => ({
  name: profile?.name ?? '',
  headline: profile?.headline ?? '',
  bio: profile?.bio ?? '',
  conversationType: profile?.conversationType ?? 'free',
  instantRatePerMinute: profile?.instantRatePerMinute ? String(profile.instantRatePerMinute) : '',
  displayMode: profile?.displayMode ?? 'normal',
  isOnline: Boolean(profile?.isOnline),
  scheduledRates: profile?.scheduledRates?.length ? profile.scheduledRates : []
});

const sanitizeRates = (rates: ScheduledRateEntry[]): ScheduledRateEntry[] =>
  rates
    .map((rate) => ({
      durationMinutes: Number(rate.durationMinutes),
      price: Number(rate.price)
    }))
    .filter((rate) => Number.isFinite(rate.durationMinutes) && Number.isFinite(rate.price) && rate.durationMinutes > 0 && rate.price > 0)
    .map((rate) => ({
      durationMinutes: Math.round(rate.durationMinutes),
      price: Math.round(rate.price * 100) / 100
    }));

interface AccountProfilePanelProps {
  profileState: UseProfileDetailsResult;
}

export default function AccountProfilePanel({ profileState }: AccountProfilePanelProps) {
  const { profile, loading, error, saving, save } = profileState;
  const [isEditing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildFormState(profile));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setForm(buildFormState(profile));
    }
  }, [profile, isEditing]);

  const statusLabel = useMemo(() => {
    if (!profile) return 'Offline';
    if (profile.hasActiveSession) return 'In a call';
    return profile.isOnline ? 'Online now' : 'Offline';
  }, [profile]);

  const statusColor = useMemo(() => {
    if (!profile) return 'bg-white/10 text-white/70 border-white/20';
    if (profile.hasActiveSession) return 'bg-amber-400/20 text-amber-100 border-amber-200/40';
    return profile.isOnline ? 'bg-emerald-400/15 text-emerald-100 border-emerald-400/30' : 'bg-white/10 text-white/60 border-white/20';
  }, [profile]);

  const handleFieldChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRateChange = (index: number, field: keyof ScheduledRateEntry, raw: string) => {
    const nextValue = raw.replace(/[^0-9.]/g, '');
    setForm((prev) => ({
      ...prev,
      scheduledRates: prev.scheduledRates.map((rate, idx) =>
        idx === index ? { ...rate, [field]: Number(nextValue) } : rate
      )
    }));
  };

  const addRate = () => {
    setForm((prev) => ({
      ...prev,
      scheduledRates: [...prev.scheduledRates, { durationMinutes: 30, price: 150 }]
    }));
  };

  const removeRate = (index: number) => {
    setForm((prev) => ({
      ...prev,
      scheduledRates: prev.scheduledRates.filter((_, idx) => idx !== index)
    }));
  };

  const handleCancel = () => {
    setLocalError(null);
    setForm(buildFormState(profile));
    setEditing(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setLocalError(null);
    try {
      const cleanedRates = sanitizeRates(form.scheduledRates);
      await save({
        name: form.name.trim(),
        headline: form.headline.trim() || null,
        bio: form.bio.trim() || null,
        conversationType: form.conversationType,
        instantRatePerMinute: form.instantRatePerMinute ? Number(form.instantRatePerMinute) : null,
        scheduledRates: cleanedRates.length ? cleanedRates : null,
        displayMode: form.displayMode,
        isOnline: form.isOnline
      });
      setEditing(false);
    } catch (issue) {
      const detail = issue instanceof Error ? issue.message : 'Unable to save profile changes.';
      setLocalError(detail);
    }
  };

  return (
    <section className="rounded-3xl border border-white/12 bg-[rgba(7,11,22,0.9)] p-6 text-white shadow-[0_25px_80px_rgba(2,6,23,0.55)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">Your profile</p>
          <h2 className="mt-1 text-3xl font-semibold text-white">How members see you</h2>
          <p className="mt-2 text-sm text-white/60">Update your public card without leaving the account hub.</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span className={clsx('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]', statusColor)}>
            <span className={clsx('h-2 w-2 rounded-full', profile?.hasActiveSession ? 'bg-amber-300' : profile?.isOnline ? 'bg-emerald-300' : 'bg-white/50')} />
            {statusLabel}
          </span>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-midnight transition hover:bg-white/90"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40"
                disabled={loading || !profile}
              >
                Edit profile
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && <p className="mt-6 text-sm text-white/70">Loading your details…</p>}

      {!loading && (error || localError) && (
        <p className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">{localError || error}</p>
      )}

      {!loading && !profile && !error && (
        <p className="mt-6 text-sm text-white/70">Sign in to manage your profile.</p>
      )}

      {!loading && profile && !isEditing && (
        <div className="mt-6 space-y-4 text-sm text-white/70">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Identity</p>
                <h3 className="text-xl font-semibold text-white">{profile.name}</h3>
                <p className="text-white/60">{profile.email}</p>
              </div>
              <p className="text-right text-base text-white/80">{profile.headline ?? 'Add a headline to share your focus.'}</p>
            </div>
            <p className="mt-3 leading-relaxed">{profile.bio ?? 'Describe what members get when they meet you.'}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Conversation type</p>
              <p className="mt-1 text-lg font-semibold text-white capitalize">{profile.conversationType}</p>
              <p className="text-white/60">Instant rate {profile.instantRatePerMinute ? `$${profile.instantRatePerMinute.toFixed(2)}/min` : 'not set'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Display mode</p>
              <p className="mt-1 text-lg font-semibold text-white capitalize">{profile.displayMode ?? 'normal'}</p>
              <p className="text-white/60">Managed: {profile.managed ? 'Yes' : 'No'} • Confidential rate: {profile.confidentialRate ? 'Yes' : 'No'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Scheduled rates</p>
              {profile.scheduledRates.length === 0 && <p className="mt-1 text-white/60">No durations configured.</p>}
              {profile.scheduledRates.length > 0 && (
                <ul className="mt-1 space-y-1 text-white/80">
                  {profile.scheduledRates.slice(0, 3).map((rate) => (
                    <li key={`${rate.durationMinutes}-${rate.price}`} className="flex items-center justify-between text-sm">
                      <span>{rate.durationMinutes} min</span>
                      <span className="font-semibold">${rate.price.toLocaleString()}</span>
                    </li>
                  ))}
                  {profile.scheduledRates.length > 3 && <li className="text-xs text-white/50">+{profile.scheduledRates.length - 3} more</li>}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && profile && isEditing && (
        <form className="mt-6 space-y-6" onSubmit={(event) => event.preventDefault()}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-white/70">Full name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => handleFieldChange('name', event.target.value)}
                className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white placeholder-white/30 focus:border-white/60 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-white/70">Headline</span>
              <input
                type="text"
                value={form.headline}
                onChange={(event) => handleFieldChange('headline', event.target.value)}
                placeholder="Product leadership, GTM, ops…"
                className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white placeholder-white/30 focus:border-white/60 focus:outline-none"
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/70">Bio</span>
            <textarea
              value={form.bio}
              onChange={(event) => handleFieldChange('bio', event.target.value)}
              rows={4}
              className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white placeholder-white/30 focus:border-white/60 focus:outline-none"
              placeholder="Describe what you bring to every conversation."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            {CONVERSATION_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => handleFieldChange('conversationType', option.value)}
                className={clsx(
                  'rounded-2xl border px-4 py-3 text-left transition',
                  form.conversationType === option.value ? 'border-white bg-white/10' : 'border-white/15 bg-black/20'
                )}
              >
                <p className="text-sm font-semibold text-white">{option.label}</p>
                <p className="mt-1 text-xs text-white/60">{option.helper}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-white/70">Instant rate (per min)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.instantRatePerMinute}
                onChange={(event) => handleFieldChange('instantRatePerMinute', event.target.value)}
                className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white placeholder-white/30 focus:border-white/60 focus:outline-none"
                placeholder="120"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-white/70">Display mode</span>
              <select
                value={form.displayMode}
                onChange={(event) => handleFieldChange('displayMode', event.target.value as FormState['displayMode'])}
                className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white focus:border-white/60 focus:outline-none"
              >
                {DISPLAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-midnight text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={form.isOnline}
                onChange={(event) => handleFieldChange('isOnline', event.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-transparent"
              />
              <span>Show me as available</span>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Scheduled durations</span>
              <button type="button" onClick={addRate} className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70 hover:text-white">
                Add duration
              </button>
            </div>
            {form.scheduledRates.length === 0 && <p className="mt-2 text-sm text-white/50">No durations configured.</p>}
            <div className="mt-2 space-y-2">
              {form.scheduledRates.map((rate, index) => (
                <div key={`${rate.durationMinutes}-${index}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-black/20 p-3 text-sm">
                  <label className="flex flex-col text-white/70">
                    <span className="text-xs uppercase tracking-[0.2em]">Minutes</span>
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={rate.durationMinutes}
                      onChange={(event) => handleRateChange(index, 'durationMinutes', event.target.value)}
                      className="mt-1 w-24 rounded-lg border border-white/20 bg-transparent px-2 py-1 text-white focus:border-white/60 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col text-white/70">
                    <span className="text-xs uppercase tracking-[0.2em]">Price</span>
                    <input
                      type="number"
                      min="10"
                      step="5"
                      value={rate.price}
                      onChange={(event) => handleRateChange(index, 'price', event.target.value)}
                      className="mt-1 w-28 rounded-lg border border-white/20 bg-transparent px-2 py-1 text-white focus:border-white/60 focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeRate(index)}
                    className="ml-auto text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
