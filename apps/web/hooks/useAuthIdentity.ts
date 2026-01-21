"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AuthUser } from '../services/authApi';
import { fetchCurrentUser } from '../services/authApi';
import { AUTH_UPDATED_EVENT } from '../constants/events';

export interface UseAuthIdentityResult {
  identity: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
}

export const useAuthIdentity = (): UseAuthIdentityResult => {
  const mountedRef = useRef(true);
  const [identity, setIdentity] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) {
      return null;
    }
    setLoading(true);
    try {
      console.log('[useAuthIdentity] Fetching current user...');
      const user = await fetchCurrentUser();
      console.log('[useAuthIdentity] Fetch complete:', user ? 'Authenticated' : 'Not authenticated');
      // Always set identity - React will ignore if unmounted
      setIdentity(user);
      return user;
    } catch (error) {
      console.error('[useAuthIdentity] Error during refresh:', error);
      setIdentity(null);
      return null;
    } finally {
      // Always set loading to false, React will ignore if unmounted
      console.log('[useAuthIdentity] Setting loading to false');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const handleAuthChange = () => {
      void refresh();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_UPDATED_EVENT, handleAuthChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUTH_UPDATED_EVENT, handleAuthChange);
      }
    };
  }, [refresh]);

  return { identity, loading, refresh };
};
