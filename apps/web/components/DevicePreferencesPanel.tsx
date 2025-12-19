'use client';

import { useCallback, useEffect, useState } from 'react';
import { initializeNotifications } from '../utils/notifications';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { sessionStatusManager } from '../services/sessionStatusManager';

const CONTRAST_KEY = 'humanchat.contrast';
const FONT_KEY = 'humanchat.fontScale';

type NotificationState = 'idle' | 'enabled' | 'blocked';

export default function DevicePreferencesPanel() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => sessionStatusManager.getCurrentUserId());
  const [notificationStatus, setNotificationStatus] = useState<NotificationState>('idle');
  const [contrast, setContrast] = useState<'normal' | 'high'>('normal');
  const [fontScale, setFontScale] = useState(1);
  const { canInstall, promptInstall, hasInstalled } = useInstallPrompt();
  const isSignedIn = Boolean(currentUserId);

  useEffect(() => {
    const unsubscribe = sessionStatusManager.onCurrentUserChange((next) => setCurrentUserId(next));
    return () => unsubscribe();
  }, []);

  const readScopedItem = useCallback(
    (key: string): string | null => {
      if (typeof window === 'undefined' || !currentUserId) {
        return null;
      }
      return window.localStorage.getItem(`${key}:${currentUserId}`);
    },
    [currentUserId]
  );

  const writeScopedItem = useCallback(
    (key: string, value: string | null) => {
      if (typeof window === 'undefined' || !currentUserId) {
        return;
      }
      const scoped = `${key}:${currentUserId}`;
      if (value === null) {
        window.localStorage.removeItem(scoped);
        return;
      }
      window.localStorage.setItem(scoped, value);
    },
    [currentUserId]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!currentUserId) {
      setContrast('normal');
      document.documentElement.dataset.contrast = 'normal';
      setFontScale(1);
      document.documentElement.style.setProperty('--font-scale', '1');
      return;
    }

    const storedContrast = (readScopedItem(CONTRAST_KEY) as 'normal' | 'high' | null) ?? 'normal';
    setContrast(storedContrast);
    document.documentElement.dataset.contrast = storedContrast === 'high' ? 'high' : 'normal';

    const storedFont = Number(readScopedItem(FONT_KEY));
    const fontValue = Number.isFinite(storedFont) && storedFont > 0 ? storedFont : 1;
    setFontScale(fontValue);
    document.documentElement.style.setProperty('--font-scale', fontValue.toString());
  }, [currentUserId, readScopedItem]);

  const handleNotificationEnable = async () => {
    const granted = await initializeNotifications();
    setNotificationStatus(granted ? 'enabled' : 'blocked');
  };

  const handleContrastToggle = () => {
    if (!currentUserId) return;
    const next = contrast === 'high' ? 'normal' : 'high';
    setContrast(next);
    document.documentElement.dataset.contrast = next === 'high' ? 'high' : 'normal';
    writeScopedItem(CONTRAST_KEY, next);
  };

  const handleFontScale = (value: number) => {
    if (!currentUserId) return;
    setFontScale(value);
    document.documentElement.style.setProperty('--font-scale', value.toString());
    writeScopedItem(FONT_KEY, value.toString());
  };

  return (
    <div className="space-y-4">
      {!isSignedIn && (
        <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
          Sign in to manage device notifications and display preferences.
        </p>
      )}

      <button
        type="button"
        className="rounded-2xl border border-white/15 bg-gradient-to-r from-indigoGlow/60 to-aqua/40 px-4 py-3 text-left text-sm font-semibold text-white disabled:opacity-50"
        onClick={handleNotificationEnable}
        disabled={!isSignedIn}
      >
        Enable push notifications
        <div className="text-xs font-normal text-white/70">
          Status: {notificationStatus === 'enabled' ? 'Enabled' : notificationStatus === 'blocked' ? 'Blocked' : 'Not requested'}
        </div>
      </button>

      <button
        type="button"
        disabled={!isSignedIn || !canInstall || hasInstalled}
        onClick={() => promptInstall()}
        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white/90 disabled:opacity-50"
      >
        {hasInstalled ? 'App installed' : canInstall ? 'Add to Home Screen' : 'Install prompt unavailable yet'}
      </button>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span>High contrast mode</span>
          <button
            type="button"
            onClick={handleContrastToggle}
            className="min-h-[44px] rounded-full border border-white/20 px-4 text-sm font-semibold disabled:opacity-50"
            disabled={!isSignedIn}
          >
            {contrast === 'high' ? 'Disable' : 'Enable'}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/60">Respects system preference and improves readability.</p>
      </div>

      <label className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <span>Font scale</span>
          <span className="text-xs text-white/60">{fontScale.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min={0.9}
          max={1.3}
          step={0.05}
          value={fontScale}
          onChange={(event) => handleFontScale(Number(event.target.value))}
          className="w-full"
          aria-label="Adjust font scale"
          disabled={!isSignedIn}
        />
      </label>
    </div>
  );
}
