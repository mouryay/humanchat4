'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UseProfileDetailsResult } from '../hooks/useProfileDetails';

interface AccountSocialLinksFormProps {
  profileState: UseProfileDetailsResult;
}

type SocialFieldKey =
  | 'linkedinUrl'
  | 'facebookUrl'
  | 'instagramUrl'
  | 'quoraUrl'
  | 'mediumUrl'
  | 'youtubeUrl'
  | 'otherSocialUrl';

const socialFields: Array<{
  key: SocialFieldKey;
  label: string;
  helper: string;
  placeholder: string;
}> = [
  {
    key: 'linkedinUrl',
    label: 'LinkedIn',
    helper: 'Showcase your professional reputation.',
    placeholder: 'https://www.linkedin.com/in/you'
  },
  {
    key: 'facebookUrl',
    label: 'Facebook',
    helper: 'Optional link for community groups or pages.',
    placeholder: 'https://www.facebook.com/you'
  },
  {
    key: 'instagramUrl',
    label: 'Instagram',
    helper: 'Great for creatives and visual storytellers.',
    placeholder: 'https://www.instagram.com/you'
  },
  {
    key: 'quoraUrl',
    label: 'Quora',
    helper: 'Highlight deep knowledge threads.',
    placeholder: 'https://www.quora.com/profile/You'
  },
  {
    key: 'mediumUrl',
    label: 'Medium',
    helper: 'Surface long-form writing and essays.',
    placeholder: 'https://medium.com/@you'
  },
  {
    key: 'youtubeUrl',
    label: 'YouTube',
    helper: 'Share talks, breakdowns, or livestreams.',
    placeholder: 'https://www.youtube.com/@you'
  },
  {
    key: 'otherSocialUrl',
    label: 'Website',
    helper: 'Link your portfolio, Substack, or any other flagship destination.',
    placeholder: 'https://yourdomain.com'
  }
];

const normalize = (value: string): string => value.trim();

const hasUrlError = (value: string): boolean => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return !(parsed.protocol === 'https:' || parsed.protocol === 'http:');
  } catch {
    return true;
  }
};

export default function AccountSocialLinksForm({ profileState }: AccountSocialLinksFormProps) {
  const { profile, save, saving } = profileState;
  const [links, setLinks] = useState<Record<SocialFieldKey, string>>(() => ({
    linkedinUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    quoraUrl: '',
    mediumUrl: '',
    youtubeUrl: '',
    otherSocialUrl: ''
  }));
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setLinks({
        linkedinUrl: '',
        facebookUrl: '',
        instagramUrl: '',
        quoraUrl: '',
        mediumUrl: '',
        youtubeUrl: '',
        otherSocialUrl: ''
      });
      setStatus('idle');
      setMessage(null);
      return;
    }
    setLinks({
      linkedinUrl: profile.linkedinUrl ?? '',
      facebookUrl: profile.facebookUrl ?? '',
      instagramUrl: profile.instagramUrl ?? '',
      quoraUrl: profile.quoraUrl ?? '',
      mediumUrl: profile.mediumUrl ?? '',
      youtubeUrl: profile.youtubeUrl ?? '',
      otherSocialUrl: profile.otherSocialUrl ?? ''
    });
    setStatus('idle');
    setMessage(null);
  }, [profile]);

  const linkErrors = useMemo(() => {
    return socialFields.reduce<Record<SocialFieldKey, boolean>>((acc, field) => {
      acc[field.key] = hasUrlError(normalize(links[field.key]));
      return acc;
    }, {} as Record<SocialFieldKey, boolean>);
  }, [links]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return socialFields.some((field) => normalize(links[field.key]) !== normalize(profile[field.key] ?? ''));
  }, [links, profile]);

  const disableSubmit = saving || !profile || !hasChanges || Object.values(linkErrors).some(Boolean);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || disableSubmit) {
      return;
    }
    setStatus('idle');
    setMessage(null);
    try {
      await save({
        linkedinUrl: normalize(links.linkedinUrl) || null,
        facebookUrl: normalize(links.facebookUrl) || null,
        instagramUrl: normalize(links.instagramUrl) || null,
        quoraUrl: normalize(links.quoraUrl) || null,
        mediumUrl: normalize(links.mediumUrl) || null,
        youtubeUrl: normalize(links.youtubeUrl) || null,
        otherSocialUrl: normalize(links.otherSocialUrl) || null
      });
      setStatus('success');
      setMessage('Social links updated.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to save links right now.');
    }
  };

  if (!profile) {
    return <p className="text-sm text-white/70">Sign in to edit your links.</p>;
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
          {socialFields.map((field) => (
            <label key={field.key} className="flex flex-col gap-2 text-sm text-white/80">
              <span className="font-semibold">{field.label}</span>
              <p className="text-xs text-white/50">{field.helper}</p>
              <input
                type="url"
                inputMode="url"
                value={links[field.key]}
                onChange={(event) =>
                  setLinks((prev) => ({
                    ...prev,
                    [field.key]: event.target.value
                  }))
                }
                placeholder={field.placeholder}
                className={`rounded-2xl border px-4 py-3 text-base text-white focus:border-aqua/60 ${
                  linkErrors[field.key] ? 'border-rose-400/70 bg-rose-500/10' : 'border-white/15 bg-white/5'
                }`}
              />
              {linkErrors[field.key] && <span className="text-xs text-rose-300">Enter a valid URL (must include https://).</span>}
            </label>
          ))}

          {message && (
            <p className={`text-xs ${status === 'success' ? 'text-emerald-300' : status === 'error' ? 'text-rose-300' : 'text-white/70'}`}>{message}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={disableSubmit}
              className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-6 py-3 text-sm font-semibold text-midnight disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save links'}
            </button>
          </div>
    </form>
  );
}
