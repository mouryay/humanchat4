'use client';

import { Bell } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuthIdentity } from '../hooks/useAuthIdentity';

const formatTime = (value?: string): string => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
};

interface NotificationBellProps {
  compact?: boolean;
}

export default function NotificationBell({ compact = false }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 56, left: 16 });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const { identity, loading: identityLoading } = useAuthIdentity();
  const { items, unreadCount, loading, busy, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = Math.min(window.innerWidth * 0.9, 360);
      const margin = 12;
      const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
      const top = rect.bottom + 8;
      setMenuPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [open]);

  if (!identity && !identityLoading) {
    return null;
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          'relative border text-white/80',
          compact ? 'h-9 w-9 rounded-[10px] p-0' : 'h-10 w-10 rounded-[12px] p-0 backdrop-blur'
        )}
        style={{
          borderColor: 'var(--border-medium)',
          background: 'color-mix(in srgb, var(--background-tertiary) 72%, transparent)',
          color: 'var(--text-secondary)'
        }}
        aria-label="Open notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 min-w-[18px] rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: 'var(--status-online)', color: 'var(--text-primary)' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed z-[100000] w-[min(90vw,360px)] rounded-xl border shadow-2xl"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            borderColor: 'var(--border-medium)',
            background: 'color-mix(in srgb, var(--background-elevated) 94%, black)'
          }}
        >
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="text-xs uppercase tracking-[0.25em]" style={{ color: 'var(--text-tertiary)' }}>Notifications</span>
            <button
              type="button"
              disabled={busy || unreadCount === 0}
              onClick={() => void markAllRead()}
              className="text-xs disabled:opacity-40"
              style={{ color: 'var(--text-secondary)' }}
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>No notifications yet.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {items.map((item) => (
                  <li key={item.id} className="px-3 py-3">
                    <button
                      type="button"
                      className="w-full text-left"
                      style={{ color: item.status === 'unread' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      onClick={() => {
                        if (item.status === 'unread') {
                          void markRead(item.id);
                        }
                      }}
                    >
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{item.body}</p>
                      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{formatTime(item.created_at)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
