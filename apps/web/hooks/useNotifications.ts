'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem
} from '../services/notificationApi';
import { NOTIFICATION_EVENT, type RealtimeNotificationDetail } from '../constants/events';

export const useNotifications = () => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, count] = await Promise.all([listNotifications(30, 0), getUnreadNotificationCount()]);
      setItems(list);
      setUnreadCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onRealtimeNotification = (event: Event) => {
      const detail = (event as CustomEvent<RealtimeNotificationDetail>).detail;
      if (!detail?.notification) return;

      setItems((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        if (existing.has(detail.notification.id)) return prev;
        return [detail.notification as NotificationItem, ...prev].slice(0, 50);
      });
      setUnreadCount((prev) => prev + 1);
    };

    window.addEventListener(NOTIFICATION_EVENT, onRealtimeNotification as EventListener);
    return () => window.removeEventListener(NOTIFICATION_EVENT, onRealtimeNotification as EventListener);
  }, []);

  const markRead = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'read', read_at: new Date().toISOString() } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } finally {
      setBusy(false);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          status: 'read',
          read_at: item.read_at ?? new Date().toISOString()
        }))
      );
      setUnreadCount(0);
    } finally {
      setBusy(false);
    }
  }, []);

  const hasUnread = useMemo(() => unreadCount > 0, [unreadCount]);

  return {
    items,
    loading,
    busy,
    error,
    unreadCount,
    hasUnread,
    refresh,
    markRead,
    markAllRead
  };
};
