'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import LogoutButton from '../LogoutButton';
import { AvailabilityManager } from '../AvailabilityManager';
import DevicePreferencesPanel from '../DevicePreferencesPanel';
import { useSettings, AVAILABILITY_PROMPT_KEY, AVAILABILITY_STORAGE_KEY } from '../../hooks/useSettings';
import type { ConnectionType } from '../../services/settingsApi';

const fallbackCharities = [
  { id: 'climate-action', name: 'Climate Action Network' },
  { id: 'youth-community', name: 'Youth Community Initiative' },
  { id: 'open-access', name: 'Open Access Education Fund' }
];

const formatCurrency = (value: string): string => {
  if (!value) return '$0.00';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '$0.00';
  return `$${parsed.toFixed(parsed % 1 === 0 ? 0 : 2)}`;
};

interface SettingsConnectionsPanelProps {
  embedded?: boolean;
  settingsState?: ReturnType<typeof useSettings>;
}

type PreferenceSection = 'availability-status' | 'availability-schedule' | 'connection' | 'integrations' | 'account' | 'device';

export default function SettingsConnectionsPanel({ embedded = false, settingsState }: SettingsConnectionsPanelProps) {
  const router = useRouter();
  const state = settingsState ?? useSettings();
  const {
    settings,
    charities,
    loading,
    error,
    updateAvailability,
    saveConnection,
    savingAvailability,
    savingConnection,
    savingCalendar,
    savingStripe,
    startCalendarConnect,
    disconnectCalendar,
    startStripeConnect,
    disconnectStripe,
    refresh
  } = state;

  const [connectionType, setConnectionType] = useState<ConnectionType>('free');
  const [instantRate, setInstantRate] = useState('');
  const [selectedCharity, setSelectedCharity] = useState<string | null>(null);
  const [acceptTips, setAcceptTips] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null);
  const [promptToReenable, setPromptToReenable] = useState(false);
  const [integrationsMessage, setIntegrationsMessage] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<PreferenceSection | null>('availability-status');

  useEffect(() => {
    if (!settings) return;
    setConnectionType(settings.conversationType ?? 'free');
    setInstantRate(settings.instantRatePerMinute ? String(settings.instantRatePerMinute) : '');
    setSelectedCharity(settings.charityId ?? null);
    setAcceptTips(settings.donationPreference ?? true);
    setConnectionMessage(null);
  }, [settings]);

  useEffect(() => {
    if (!settings?.isOnline) {
      setAvailabilityNotice(null);
    }
  }, [settings?.isOnline]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkExpiry = () => {
      if (!settings?.isOnline) return;
      const expireAtRaw = window.localStorage.getItem(AVAILABILITY_STORAGE_KEY);
      const expireAt = expireAtRaw ? Number(expireAtRaw) : null;
      if (expireAt && Date.now() > expireAt) {
        void updateAvailability(false);
        window.localStorage.setItem(AVAILABILITY_PROMPT_KEY, 'true');
        setAvailabilityNotice('We turned off your availability after inactivity.');
      }
    };
    const interval = window.setInterval(checkExpiry, 60 * 1000);
    checkExpiry();
    return () => window.clearInterval(interval);
  }, [settings?.isOnline, updateAvailability]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleFocus = () => {
      if (!settings?.isOnline && window.localStorage.getItem(AVAILABILITY_PROMPT_KEY) === 'true') {
        setPromptToReenable(true);
      } else {
        setPromptToReenable(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    handleFocus();
    return () => window.removeEventListener('focus', handleFocus);
  }, [settings?.isOnline]);

  const availableCharities = charities.length > 0 ? charities : fallbackCharities;
  const trimmedRate = instantRate.trim();
  const numericRate = trimmedRate ? Number(trimmedRate) : null;

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    const rateValue = settings.instantRatePerMinute ? String(settings.instantRatePerMinute) : '';
    return (
      settings.conversationType !== connectionType ||
      rateValue !== trimmedRate ||
      (settings.charityId ?? '') !== (selectedCharity ?? '') ||
      settings.donationPreference !== acceptTips
    );
  }, [settings, connectionType, trimmedRate, selectedCharity, acceptTips]);

  const connectionErrors: string[] = [];
  if (connectionType === 'paid') {
    if (numericRate === null || !Number.isFinite(numericRate) || numericRate <= 0) {
      connectionErrors.push('Rate must be greater than $0 to accept paid requests.');
    }
  }
  if (connectionType === 'charity' && !selectedCharity) {
    connectionErrors.push('Select a charity partner before continuing.');
  }
  if ((connectionType === 'paid' || connectionType === 'charity') && !settings?.stripeConnected) {
    connectionErrors.push('Connect Stripe first to accept paid or charity conversations.');
  }

  const handleAvailabilityToggle = () => {
    if (!settings) return;
    void updateAvailability(!settings.isOnline);
  };

  const handleSaveConnection = async () => {
    if (!settings) return;
    setConnectionMessage(null);
    
    // Special handling for Stripe not connected
    if ((connectionType === 'paid' || connectionType === 'charity') && !settings?.stripeConnected) {
      const confirmConnect = window.confirm(
        'You need to connect Stripe first to accept paid or charity conversations. Click OK to connect now.'
      );
      if (confirmConnect) {
        await startStripeConnect();
      } else {
        setConnectionMessage('Stripe connection required. Please connect Stripe in the Integrations section below.');
      }
      return;
    }
    
    if (connectionErrors.length > 0) {
      setConnectionMessage(connectionErrors[0]);
      return;
    }
    try {
      await saveConnection({
        conversationType: connectionType,
        instantRatePerMinute: connectionType === 'paid' ? Number(trimmedRate) : null,
        charityId: connectionType === 'charity' ? selectedCharity : null,
        donationPreference: acceptTips
      });
      setConnectionMessage('Settings updated');
    } catch (err) {
      setConnectionMessage(err instanceof Error ? err.message : 'Unable to save changes.');
    }
  };

  const handleCalendarDisconnect = async () => {
    if (!settings?.calendarConnected) return;
    const confirmDisconnect = window.confirm('Disconnect calendar? Scheduled bookings will be disabled.');
    if (!confirmDisconnect) return;
    setIntegrationsMessage(null);
    await disconnectCalendar();
    setIntegrationsMessage('Calendar disconnected. Scheduled bookings are disabled.');
  };

  const handleStripeDisconnect = async () => {
    if (!settings) return;
    if (settings.conversationType !== 'free') {
      setIntegrationsMessage('Switch to free mode before disconnecting Stripe.');
      return;
    }
    const confirmDisconnect = window.confirm('Disconnect Stripe? You will need to offer free conversations.');
    if (!confirmDisconnect) return;
    setIntegrationsMessage(null);
    await disconnectStripe();
    setIntegrationsMessage('Stripe disconnected. You are now listed as Free.');
  };

  if (loading) {
    return (
      <div
        className="rounded-2xl border p-4 text-sm text-text-secondary"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--background-elevated)' }}
      >
        Loading settings…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
        <p className="mb-3">{error}</p>
        <button
          type="button"
          className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80"
          onClick={() => refresh()}
        >
          Retry
        </button>
      </div>
    );
  }

  const sectionCardClass = 'rounded-3xl border';

  const sections: Array<{
    id: PreferenceSection;
    label: string;
    tagline: string;
    content: ReactNode;
  }> = [
    {
      id: 'availability-status',
      label: 'Availability status',
      tagline: 'Control whether Sam can surface you right now.',
      content: (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Instant availability</h3>
              <p className="text-sm text-text-secondary">
                {settings?.isOnline
                  ? 'You appear in search and Sam routes instant connects.'
                  : 'You are hidden until you toggle availability back on.'}
              </p>
            </div>
            <button
              type="button"
              disabled={savingAvailability}
              onClick={handleAvailabilityToggle}
              className={`rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] ${
                settings?.isOnline ? 'text-accent-hover' : 'text-text-tertiary'
              }`}
              style={{ borderColor: settings?.isOnline ? 'var(--accent-primary)' : 'var(--border-medium)' }}
            >
              {savingAvailability ? 'Saving…' : settings?.isOnline ? 'On' : 'Off'}
            </button>
          </div>
          {availabilityNotice && <p className="text-xs text-amber-300">{availabilityNotice}</p>}
          {promptToReenable && (
            <div className="rounded-2xl border p-4 text-sm text-text-secondary" style={{ borderColor: 'var(--border-medium)', background: 'var(--background-elevated)' }}>
              <p>You were set to offline after inactivity. Turn availability back on?</p>
              <button
                type="button"
                className="mt-3 rounded-full px-5 py-2 text-xs font-semibold"
                style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-strong))', color: 'var(--pitch-cream)' }}
                onClick={() => {
                  setPromptToReenable(false);
                  window.localStorage.removeItem(AVAILABILITY_PROMPT_KEY);
                  void updateAvailability(true);
                }}
              >
                Re-enable availability
              </button>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'availability-schedule',
      label: 'Weekly schedule & blocks',
      tagline: 'Set recurring hours, overrides, and integrations.',
      content: <AvailabilityManager embedded />
    },
    {
      id: 'connection',
      label: 'Connection modes',
      tagline: 'Choose free, paid, or charity conversations.',
      content: (
        <div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(['free', 'paid', 'charity'] as ConnectionType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={`rounded-2xl border p-4 text-left text-sm ${
                  connectionType === type
                    ? 'bg-background-hover text-text-primary'
                    : 'text-text-secondary'
                }`}
                style={{ borderColor: connectionType === type ? 'var(--accent-primary)' : 'var(--border-subtle)' }}
                onClick={() => setConnectionType(type)}
              >
                <p className="text-base font-semibold capitalize text-text-primary">{type}</p>
                <p className="mt-2 text-xs text-text-secondary">
                  {type === 'free' && 'Members can join instantly with no payment.'}
                  {type === 'paid' && 'Set a live rate for instant connects.'}
                  {type === 'charity' && 'Donate the proceeds to a partner organization.'}
                </p>
              </button>
            ))}
          </div>

          {connectionType === 'paid' && (
            <label className="mt-6 block text-sm text-text-secondary">
              Rate per minute (USD)
              <input
                type="number"
                min="0"
                step="0.5"
                value={instantRate}
                onChange={(event) => setInstantRate(event.target.value)}
                className="mt-2 w-full rounded-2xl border bg-background-tertiary px-4 py-3 text-text-primary"
                style={{ borderColor: 'var(--border-medium)' }}
                placeholder="3.00"
              />
            </label>
          )}

          {connectionType === 'charity' && (
            <label className="mt-6 block text-sm text-text-secondary">
              Charity partner
              <select
                value={selectedCharity ?? ''}
                onChange={(event) => setSelectedCharity(event.target.value || null)}
                className="mt-2 w-full rounded-2xl border bg-background-tertiary px-4 py-3 text-text-primary"
                style={{ borderColor: 'var(--border-medium)' }}
              >
                <option value="" disabled>
                  Choose a charity
                </option>
                {availableCharities.map((charity) => (
                  <option key={charity.id} value={charity.id}>
                    {charity.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-6 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={acceptTips}
                onChange={(event) => setAcceptTips(event.target.checked)}
              />
              Accept optional tips ({acceptTips ? 'enabled' : 'disabled'})
            </label>
          </div>

          {connectionErrors.length > 0 && (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-rose-300">
              {connectionErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          {connectionMessage && <p className="mt-4 text-xs text-text-secondary">{connectionMessage}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={!hasChanges || savingConnection}
              onClick={() => void handleSaveConnection()}
              className="rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-strong))', color: 'var(--pitch-cream)' }}
            >
              {savingConnection ? 'Saving…' : 'Save changes'}
            </button>
            <p className="text-xs text-text-secondary">
              Current mode: <span className="font-semibold text-text-primary capitalize">{connectionType}</span>{' '}
              {connectionType === 'paid' && numericRate ? `· ${formatCurrency(trimmedRate)}/min` : null}
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'integrations',
      label: 'Calendar, payments & sync',
      tagline: 'Align Google Calendar and payouts.',
      content: (
        <div className="space-y-6">
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--background-elevated)' }}>
            <p className="text-sm font-semibold">Google Calendar</p>
            <p className="text-xs text-text-secondary">{settings?.calendarConnected ? 'Connected ✓' : 'Not connected'}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {settings?.calendarConnected ? (
                <button
                  type="button"
                  disabled={savingCalendar}
                  onClick={() => void handleCalendarDisconnect()}
                  className="rounded-full border px-5 py-2 text-xs text-text-secondary"
                  style={{ borderColor: 'var(--border-medium)' }}
                >
                  {savingCalendar ? 'Disconnecting…' : 'Disconnect'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={savingCalendar}
                  onClick={() => void startCalendarConnect()}
                  className="rounded-full px-5 py-2 text-xs font-semibold"
                  style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-strong))', color: 'var(--pitch-cream)' }}
                >
                  {savingCalendar ? 'Connecting…' : 'Connect Google Calendar'}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--background-elevated)' }}>
            <p className="text-sm font-semibold">Stripe</p>
            <p className="text-xs text-text-secondary">{settings?.stripeConnected ? 'Connected ✓' : 'Not connected'}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {settings?.stripeConnected ? (
                <>
                  <button
                    type="button"
                    className="rounded-full border px-5 py-2 text-xs text-text-secondary"
                    style={{ borderColor: 'var(--border-medium)' }}
                    onClick={() => router.push('/settings/payments')}
                  >
                    Manage account
                  </button>
                  <button
                    type="button"
                    disabled={savingStripe}
                    onClick={() => void handleStripeDisconnect()}
                    className="rounded-full border px-5 py-2 text-xs text-text-secondary"
                    style={{ borderColor: 'var(--border-medium)' }}
                  >
                    {savingStripe ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={savingStripe}
                  onClick={() => void startStripeConnect()}
                  className="rounded-full px-5 py-2 text-xs font-semibold"
                  style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-strong))', color: 'var(--pitch-cream)' }}
                >
                  {savingStripe ? 'Connecting…' : 'Connect Stripe'}
                </button>
              )}
            </div>
          </div>

          {integrationsMessage && <p className="text-xs text-text-secondary">{integrationsMessage}</p>}
        </div>
      )
    },
    {
      id: 'account',
      label: 'Account controls',
      tagline: 'Security, logout, and account deletion.',
      content: (
        <div className="flex flex-col gap-3 text-sm">
          <button
            type="button"
            className="rounded-2xl border border-white/15 px-4 py-3 text-left hover:border-white/40"
            onClick={() => router.push('/auth/change-password')}
          >
            Change password
          </button>
          <LogoutButton className="rounded-2xl border border-white/15 px-4 py-3 text-left text-white/80 hover:border-white/40" />
          <button
            type="button"
            className="rounded-2xl border border-rose-400/40 px-4 py-3 text-left text-rose-200 hover:border-rose-300"
            onClick={() => {
              const confirmed = window.confirm('Delete your account? This action cannot be undone.');
              if (confirmed) {
                router.push('/support/delete-account');
              }
            }}
          >
            Delete account
          </button>
        </div>
      )
    },
    {
      id: 'device',
      label: 'Device & display',
      tagline: 'Push notifications, install prompt, and readability.',
      content: <DevicePreferencesPanel />
    }
  ];

  return (
    <div className={embedded ? 'space-y-6 text-text-primary' : 'flex flex-col gap-8 text-text-primary'}>
      {sections.map((section) => {
        const isOpen = openSection === section.id;
        return (
          <section
            key={section.id}
            className={`${sectionCardClass} transition-colors`}
            style={{ borderColor: 'var(--border-subtle)', background: 'color-mix(in srgb, var(--background-tertiary) 90%, transparent)' }}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              onClick={() => setOpenSection((prev) => (prev === section.id ? null : section.id))}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-text-tertiary">{section.label}</p>
                <p className="text-sm text-text-secondary">{section.tagline}</p>
              </div>
              <span className="text-xl text-text-tertiary">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && <div className="border-t px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>{section.content}</div>}
          </section>
        );
      })}
    </div>
  );
}
