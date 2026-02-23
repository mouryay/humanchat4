const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type UserRole = 'user' | 'admin' | 'manager';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Request failed');
  }
  return response.json();
};

export const fetchCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    const result = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      credentials: 'include'
    });
    if (result.status === 401) {
      console.log('[authApi] User not authenticated (401)');
      return null;
    }
    if (!result.ok) {
      console.error('[authApi] Failed to fetch user:', result.status);
      return null;
    }
    const payload = await handleResponse(result);
    if (payload?.user) {
      console.log('[authApi] User authenticated:', payload.user.email);
      return payload.user as AuthUser;
    }
    if (payload?.data?.user) {
      console.log('[authApi] User authenticated:', payload.data.user.email);
      return payload.data.user as AuthUser;
    }
    if (payload?.data && 'id' in payload.data) {
      console.log('[authApi] User authenticated:', payload.data.email);
      return payload.data as AuthUser;
    }
    console.warn('[authApi] Unexpected payload format:', payload);
    return null;
  } catch (error) {
    console.error('[authApi] Error fetching current user:', error);
    return null;
  }
};

export const logout = async (): Promise<void> => {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });
};
