'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { UseProfileDetailsResult } from '../hooks/useProfileDetails';

interface AccountIdentityFormProps {
  profileState: UseProfileDetailsResult;
}

const MIN_NAME_LENGTH = 2;
export default function AccountIdentityForm({ profileState }: AccountIdentityFormProps) {
  const { profile, save, saving } = profileState;
  const [name, setName] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [currentFocus, setCurrentFocus] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.name) {
      setName(profile.name);
    } else {
      setName('');
    }
    setCurrentRole(profile?.currentRoleTitle ?? '');
    setCurrentFocus(profile?.currentFocus ?? '');
    setStatus('idle');
    setMessage(null);
  }, [profile?.name, profile?.currentRoleTitle, profile?.currentFocus]);

  const trimmedName = name.trim();

  const initials = useMemo(() => {
    if (!profile?.name) return 'HC';
    const parts = profile.name.trim().split(/\s+/);
    const chars = parts.slice(0, 2).map((part) => part[0]).join('');
    return chars.toUpperCase() || 'HC';
  }, [profile?.name]);

  const disableSubmit = useMemo(() => {
    if (!profile) return true;
    if (saving) return true;
    if (trimmedName.length < MIN_NAME_LENGTH) return true;
    const nameUnchanged = trimmedName === profile.name.trim();
    const roleUnchanged = currentRole.trim() === (profile.currentRoleTitle ?? '');
    const focusUnchanged = currentFocus.trim() === (profile.currentFocus ?? '');
    return nameUnchanged && roleUnchanged && focusUnchanged;
  }, [profile, saving, trimmedName, currentRole, currentFocus]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || trimmedName.length < MIN_NAME_LENGTH) {
      setStatus('error');
      setMessage(`Name must be at least ${MIN_NAME_LENGTH} characters.`);
      return;
    }
    setStatus('idle');
    setMessage(null);
    try {
      await save({
        name: trimmedName,
        currentRoleTitle: currentRole.trim() || null,
        currentFocus: currentFocus.trim() || null
      });
      setStatus('success');
      setMessage('Name updated successfully.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to update name right now.');
    }
  };

  if (!profile) {
    return <p className="text-sm text-white/70">Sign in to edit your name.</p>;
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/20">
                {profile?.avatarUrl ? (
                  <Image src={profile.avatarUrl} alt="Profile avatar" fill sizes="80px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-lg font-semibold" aria-hidden>
                    {initials}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">Profile avatar</p>
                <p className="text-xs text-white/60">Visible on ProfileCards, chat, and bookings.</p>
              </div>
            </div>
            <p className="text-xs text-white/60">
              Avatars sync from your sign-in provider right now. Custom uploads launch once the backend endpoint ships.
            </p>
          </div>
          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="account-name-input">
            Display name
            <input
              id="account-name-input"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white focus:border-aqua/60"
              maxLength={80}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="account-role-input">
            Current role / profession
            <input
              id="account-role-input"
              type="text"
              value={currentRole}
              onChange={(event) => setCurrentRole(event.target.value)}
              placeholder="e.g. Product Manager, Freelance Designer"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-aqua/60"
              maxLength={120}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="account-focus-input">
            Current focus / goal
            <input
              id="account-focus-input"
              type="text"
              value={currentFocus}
              onChange={(event) => setCurrentFocus(event.target.value)}
              placeholder="e.g. Scaling my startup, switching careers"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-aqua/60"
              maxLength={200}
            />
          </label>
          <div className="flex flex-col gap-2 text-xs text-white/60">
            <span>This is shared with members across chat, bookings, and payout receipts.</span>
            {message && (
              <span
                className={
                  status === 'success'
                    ? 'text-emerald-300'
                    : status === 'error'
                      ? 'text-rose-300'
                      : 'text-white/70'
                }
              >
                {message}
              </span>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={disableSubmit}
              className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-6 py-3 text-sm font-semibold text-midnight disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save name'}
            </button>
          </div>
    </form>
  );
}
