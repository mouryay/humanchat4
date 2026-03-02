'use client';

import { fetchWithAuthRefresh } from '../utils/fetchWithAuthRefresh';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type NotificationItem = {
  id: string;
  user_id: string;
  type: 'booking_scheduled' | 'booking_reminder_30m';
  title: string;
  body: string;
  payload: Record<string, unknown>;
  channel: 'in_app' | 'email' | 'both';
  status: 'unread' | 'read';
  created_at: string;
  read_at: string | null;
};

const parseError = async (res: Response): Promise<string> => {
  try {
    const payload = await res.json();
    return payload?.error?.message ?? payload?.message ?? 'Request failed';
  } catch {
    return 'Request failed';
  }
};

export const listNotifications = async (limit = 30, offset = 0): Promise<NotificationItem[]> => {
  const response = await fetchWithAuthRefresh(
    `${API_BASE_URL}/api/notifications?limit=${limit}&offset=${offset}`,
    { credentials: 'include' }
  );
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const payload = await response.json();
  return payload?.data?.notifications ?? [];
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const response = await fetchWithAuthRefresh(`${API_BASE_URL}/api/notifications/unread-count`, {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const payload = await response.json();
  return Number(payload?.data?.unreadCount ?? 0);
};

export const markNotificationRead = async (id: string): Promise<void> => {
  const response = await fetchWithAuthRefresh(`${API_BASE_URL}/api/notifications/${id}/read`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
};

export const markAllNotificationsRead = async (): Promise<number> => {
  const response = await fetchWithAuthRefresh(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const payload = await response.json();
  return Number(payload?.data?.updatedCount ?? 0);
};
