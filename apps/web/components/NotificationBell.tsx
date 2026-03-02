'use client';

import { Bell } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';

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
  const { items, unreadCount, loading, busy, markRead, markAllRead } = useNotifications();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          'relative border border-white/20 bg-white/5 text-white/80 hover:bg-white/10',
          compact ? 'h-9 w-9 rounded-[10px] p-0' : 'rounded-full p-2'
        )}
        aria-label="Open notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-emerald-400 px-1.5 py-0.5 text-[10px] font-semibold text-black">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(90vw,380px)] rounded-xl border border-white/10 bg-[#0b0d13] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs uppercase tracking-[0.25em] text-white/60">Notifications</span>
            <button
              type="button"
              disabled={busy || unreadCount === 0}
              onClick={() => void markAllRead()}
              className="text-xs text-white/70 hover:text-white disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-sm text-white/60">Loading...</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-white/60">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {items.map((item) => (
                  <li key={item.id} className="px-3 py-3">
                    <button
                      type="button"
                      className={clsx('w-full text-left', item.status === 'unread' ? 'text-white' : 'text-white/70')}
                      onClick={() => {
                        if (item.status === 'unread') {
                          void markRead(item.id);
                        }
                      }}
                    >
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-white/70">{item.body}</p>
                      <p className="mt-1 text-[11px] text-white/40">{formatTime(item.created_at)}</p>
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
