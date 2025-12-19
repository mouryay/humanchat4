"use client";

import { useEffect, useState } from 'react';
import type { ConversationCategory } from '../services/profileApi';
import type { UseProfileDetailsResult } from '../hooks/useProfileDetails';

const conversationHelpers: Record<ConversationCategory, string> = {
  free: 'Perfect for open office hours or community loops.',
  paid: 'Charge per minute for instant connects.',
  charity: 'Route proceeds to a charity partner.'
};

interface AccountPreferencesFormProps {
  profileState: UseProfileDetailsResult;
}

const rateFromInput = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
};

export default function AccountPreferencesForm({ profileState }: AccountPreferencesFormProps) {
  const { profile, save, saving } = profileState;
  const [conversationType, setConversationType] = useState<ConversationCategory>('free');
  const [instantRate, setInstantRate] = useState('');
  const [openToRequests, setOpenToRequests] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setConversationType(profile.conversationType);
    setInstantRate(profile.instantRatePerMinute ? String(profile.instantRatePerMinute) : '');
    setOpenToRequests(profile.displayMode !== 'by_request');
  }, [profile]);

  const disableSubmit = saving || !profile;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setStatusMessage(null);
    setStatusVariant(null);
    try {
      const numericRate = conversationType === 'paid' ? rateFromInput(instantRate) : null;
      await save({
        conversationType,
        instantRatePerMinute: conversationType === 'paid' ? numericRate : null,
        displayMode: openToRequests ? 'normal' : 'by_request'
      });
      setStatusVariant('success');
      setStatusMessage('Preferences saved successfully.');
    } catch (err) {
      setStatusVariant('error');
      setStatusMessage(err instanceof Error ? err.message : 'Unable to save preferences.');
    }
  };

  return (
    <section className="rounded-3xl border border-white/12 bg-[rgba(15,23,42,0.85)] p-6 text-white shadow-[0_25px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Account preferences</p>
        <h2 className="text-2xl font-semibold">Control what members see</h2>
        <p className="text-sm text-white/70">
          Every member can host or request chats — by default you're free and open to instant requests. Tweak the knobs below if you need a different
          setup.
        </p>
      </header>

      {!profile && (
        <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Sign in to edit your account preferences.</p>
      )}

      {profile && (
        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold">Conversation type</p>
            <p className="text-xs text-white/60">
              Choose whether your instant connects are free, paid, or charity-focused. Everyone starts in Free mode.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {(['free', 'paid', 'charity'] as ConversationCategory[]).map((type) => (
                <label
                  key={type}
                  className={`flex cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 text-sm transition ${
                    conversationType === type ? 'border-aqua/60 bg-aqua/10 text-white' : 'border-white/15 text-white/70 hover:border-white/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="conversationType"
                    value={type}
                    className="hidden"
                    checked={conversationType === type}
                    onChange={() => setConversationType(type)}
                  />
                  <span className="font-semibold capitalize">{type}</span>
                  <span className="text-xs text-white/60">{conversationHelpers[type]}</span>
                </label>
              ))}
            </div>
            {conversationType === 'paid' && (
              <label className="mt-4 block text-sm">
                <span className="text-white/80">Instant rate (USD/min)</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={instantRate}
                  onChange={(event) => setInstantRate(event.target.value)}
                  placeholder="3.00"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:border-aqua/60"
                />
              </label>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Open to chat requests</p>
                <p className="text-xs text-white/60">Stay on (default) to let anyone ping you instantly. Turn it off if you need Sam to collect approval first.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenToRequests((prev) => !prev)}
                className={`rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] ${
                  openToRequests ? 'border-aqua/60 text-aqua' : 'border-white/20 text-white/50'
                }`}
              >
                {openToRequests ? 'on' : 'off'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-white/60">
              <p>Updates take effect immediately across chat and discovery.</p>
              {statusMessage && (
                <p
                  className={`mt-1 font-semibold ${
                    statusVariant === 'success' ? 'text-emerald-300' : statusVariant === 'error' ? 'text-rose-300' : 'text-white/70'
                  }`}
                >
                  {statusMessage}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={disableSubmit}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-6 py-3 text-sm font-semibold text-midnight disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
