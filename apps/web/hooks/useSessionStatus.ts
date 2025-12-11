'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { sessionStatusManager, type SessionStatus, type PresenceState } from '../services/sessionStatusManager';

interface SessionStatusState {
  isOnline: boolean;
  hasActiveSession: boolean;
  presenceState: PresenceState;
  isLoading: boolean;
}

export type PrefetchedSessionStatus = Partial<Pick<SessionStatusState, 'isOnline' | 'hasActiveSession'>> & {
  presenceState?: PresenceState;
};

interface UseSessionStatusOptions {
  disabled?: boolean;
  prefetchedStatus?: PrefetchedSessionStatus | null;
}

const initialState: SessionStatusState = {
  isOnline: false,
  hasActiveSession: false,
  presenceState: 'offline',
  isLoading: false
};

const derivePresenceState = (
  status?: Pick<SessionStatus, 'presenceState' | 'isOnline'> | PrefetchedSessionStatus
): PresenceState => {
  if (status?.presenceState) {
    return status.presenceState;
  }
  return status?.isOnline ? 'active' : 'offline';
};

export const useSessionStatus = (userId?: string | null, options?: UseSessionStatusOptions) => {
  const { disabled = false, prefetchedStatus = null } = options ?? {};
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(sessionStatusManager.getCurrentUserId()));
  const prefetchedSlice = useMemo(() => {
    if (!prefetchedStatus) {
      return null;
    }
    return {
      isOnline: Boolean(prefetchedStatus.isOnline),
      hasActiveSession: Boolean(prefetchedStatus.hasActiveSession),
      presenceState: derivePresenceState(prefetchedStatus)
    } satisfies Omit<SessionStatusState, 'isLoading'>;
  }, [prefetchedStatus?.isOnline, prefetchedStatus?.hasActiveSession, prefetchedStatus?.presenceState]);
  const [state, setState] = useState<SessionStatusState>(() => ({
    ...initialState,
    ...(prefetchedSlice ?? {}),
    isLoading: Boolean(userId) && !disabled
  }));

  useEffect(() => {
    return sessionStatusManager.onCurrentUserChange((currentUserId) => {
      setIsAuthenticated(Boolean(currentUserId));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const cleanup = () => {
      cancelled = true;
      unsubscribe?.();
    };

    if (!userId) {
      setState({ ...initialState, ...(prefetchedSlice ?? {}), isLoading: false });
      return cleanup;
    }

    if (disabled) {
      setState((prev) => ({ ...prev, ...(prefetchedSlice ?? {}), isLoading: false }));
      return cleanup;
    }

    if (!isAuthenticated) {
      setState((prev) => ({ ...prev, ...(prefetchedSlice ?? {}), isLoading: true }));
      return cleanup;
    }

    setState((prev) => ({ ...prev, ...(prefetchedSlice ?? {}), isLoading: true }));

    sessionStatusManager
      .checkUserStatus(userId)
      .then((status) => {
        if (!cancelled) {
          setState({
            isOnline: status.isOnline,
            hasActiveSession: status.hasActiveSession,
            presenceState: derivePresenceState(status),
            isLoading: false
          });
        }
      })
      .catch((error) => {
        console.warn('Failed to load session status', error);
        if (!cancelled) {
          setState({ ...initialState, ...(prefetchedSlice ?? {}), isLoading: false });
        }
      });

    unsubscribe = sessionStatusManager.subscribeToStatusChanges(userId, (status) => {
      setState({
        isOnline: status.isOnline,
        hasActiveSession: status.hasActiveSession,
        presenceState: derivePresenceState(status),
        isLoading: false
      });
    });

    return cleanup;
  }, [userId, isAuthenticated, disabled, prefetchedSlice]);

  return state;
};

export const useMySessionStatus = () => {
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [userId, setUserId] = useState<string | null>(() => sessionStatusManager.getCurrentUserId());

  useEffect(() => {
    const unsubscribe = sessionStatusManager.onCurrentUserChange((next) => {
      setUserId(next);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      return () => undefined;
    }

    let cancelled = false;
    sessionStatusManager
      .checkUserStatus(userId)
      .then((next) => {
        if (!cancelled) {
          setStatus(next);
        }
      })
      .catch((error) => console.warn('Unable to load current user status', error));

    const unsubscribe = sessionStatusManager.subscribeToStatusChanges(userId, (next) => {
      setStatus(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId]);

  const startSession = useCallback(
    async (sessionId: string) => {
      if (!userId) {
        throw new Error('Cannot start session without a userId');
      }
      const updated = await sessionStatusManager.startSession(sessionId, userId);
      setStatus(updated);
      return updated;
    },
    [userId]
  );

  const endSession = useCallback(
    async (sessionId: string) => {
      if (!userId) {
        throw new Error('Cannot end session without a userId');
      }
      const updated = await sessionStatusManager.endSession(sessionId, userId);
      setStatus(updated);
      return updated;
    },
    [userId]
  );

  const currentSession = useMemo(() => status, [status]);

  return { startSession, endSession, currentSession };
};
