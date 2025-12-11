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
      const user = await fetchCurrentUser();
      if (mountedRef.current) {
        setIdentity(user);
      }
      return user;
    } catch {
      if (mountedRef.current) {
        setIdentity(null);
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
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
