import type { RequestedPerson } from './requestedPeopleApi';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface AdminOverviewMetrics {
  totals: {
    users: number;
    managed: number;
    online: number;
    admins: number;
  };
  sessions: {
    active: number;
    pending: number;
    completedToday: number;
  };
  requests: {
    pending: number;
    requestedPeoplePending: number;
  };
  revenue: {
    today: number;
    last7Days: number;
    last30Days: number;
    donations30d: number;
  };
  sparkline: Array<{ date: string; activeSessions: number; revenue: number }>;
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'manager';
  managed: boolean;
  manager_name?: string | null;
  manager_id?: string | null;
  conversation_type?: string;
  is_online: boolean;
  has_active_session: boolean;
  display_mode?: 'normal' | 'by_request' | 'confidential' | null;
  instant_rate_per_minute?: number | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSessionSummary {
  id: string;
  host_user_id: string;
  guest_user_id: string;
  host_name: string;
  guest_name: string;
  status: 'pending' | 'in_progress' | 'complete';
  type: 'instant' | 'scheduled';
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  agreed_price: number;
  payment_mode: 'free' | 'paid' | 'charity';
  created_at: string;
  updated_at: string;
}

export interface AdminRequestSummary {
  id: string;
  requester_user_id: string;
  requester_name: string;
  target_user_id: string;
  target_name: string;
  manager_user_id?: string | null;
  representative_name?: string | null;
  message: string;
  preferred_time?: string | null;
  budget_range?: string | null;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
}

export interface AdminAnnouncement {
  id: string;
  message: string;
  authorId: string;
  createdAt: string;
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Request failed');
  }
  return response.json();
};

const withCredentials = (init: RequestInit = {}): RequestInit => ({
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    ...(init.headers ?? {})
  },
  ...init
});

export const fetchAdminOverview = async (): Promise<AdminOverviewMetrics> => {
  const payload = await handleResponse(await fetch(`${API_BASE_URL}/api/admin/overview`, withCredentials()));
  return payload.metrics as AdminOverviewMetrics;
};

export const fetchAdminUsers = async (params: { q?: string; role?: string; managed?: boolean } = {}): Promise<AdminUserSummary[]> => {
  const url = new URL('/api/admin/users', API_BASE_URL);
  if (params.q) url.searchParams.set('q', params.q);
  if (params.role) url.searchParams.set('role', params.role);
  if (typeof params.managed === 'boolean') url.searchParams.set('managed', String(params.managed));
  const payload = await handleResponse(await fetch(url.toString(), withCredentials()));
  return payload.users ?? [];
};

export const updateAdminUser = async (id: string, updates: Record<string, unknown>): Promise<AdminUserSummary> => {
  const payload = await handleResponse(
    await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
      ...withCredentials({ method: 'PATCH' }),
      body: JSON.stringify(updates)
    })
  );
  return payload.user;
};

export const fetchAdminSessions = async (limit = 60): Promise<AdminSessionSummary[]> => {
  const url = new URL('/api/admin/sessions', API_BASE_URL);
  url.searchParams.set('limit', String(limit));
  const payload = await handleResponse(await fetch(url.toString(), withCredentials()));
  return payload.sessions ?? [];
};

export const fetchAdminRequests = async (): Promise<AdminRequestSummary[]> => {
  const payload = await handleResponse(await fetch(`${API_BASE_URL}/api/admin/requests`, withCredentials()));
  return payload.requests ?? [];
};

export const fetchAdminRequestedPeople = async (): Promise<RequestedPerson[]> => {
  const payload = await handleResponse(await fetch(`${API_BASE_URL}/api/admin/requested-people`, withCredentials()));
  return payload.people ?? [];
};

export const publishAdminAnnouncement = async (message: string): Promise<void> => {
  await handleResponse(
    await fetch(`${API_BASE_URL}/api/admin/announcements`, {
      ...withCredentials({ method: 'POST' }),
      body: JSON.stringify({ message })
    })
  );
};

export const fetchAdminAnnouncements = async (): Promise<AdminAnnouncement[]> => {
  const payload = await handleResponse(await fetch(`${API_BASE_URL}/api/admin/announcements`, withCredentials()));
  return payload.announcements ?? [];
};
