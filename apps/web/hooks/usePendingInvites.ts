'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { db, type InstantInvite } from '../../../src/lib/db';
import { fetchPendingInvites } from '../services/instantInviteApi';
import { useAuthIdentity } from './useAuthIdentity';

/**
 * Watches IndexedDB for pending instant-invites targeting the current user.
 * On mount it also fetches pending invites from the server so that invites
 * created while the user was offline are picked up.
 *
 * Returns a map of conversationId → InstantInvite so the sidebar can overlay
 * accept / decline buttons on the right conversation card.
 */
export function usePendingInvites() {
  const { identity } = useAuthIdentity();
  const userId = identity?.id ?? null;
  const [invitesByConversation, setInvitesByConversation] = useState<Map<string, InstantInvite>>(new Map());
  const mountedRef = useRef(true);
  const serverFetchedRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshFromDb = useCallback(async () => {
    if (!userId) {
      setInvitesByConversation(new Map());
      return;
    }
    try {
      const pending = await db.instantInvites
        .where('targetUserId')
        .equals(userId)
        .filter((invite) => invite.status === 'pending')
        .toArray();

      if (!mountedRef.current) return;

      const map = new Map<string, InstantInvite>();
      for (const invite of pending) {
        const existing = map.get(invite.conversationId);
        if (!existing || invite.createdAt > existing.createdAt) {
          map.set(invite.conversationId, invite);
        }
      }
      setInvitesByConversation(map);
    } catch (err) {
      console.warn('[usePendingInvites] Failed to query invites', err);
    }
  }, [userId]);

  // Fetch pending invites from server on mount (picks up offline-created invites)
  useEffect(() => {
    if (!userId || serverFetchedRef.current) return;

    let cancelled = false;
    const hydrate = async () => {
      try {
        await fetchPendingInvites();
        serverFetchedRef.current = true;
        if (!cancelled) {
          await refreshFromDb();
        }
      } catch (err) {
        console.warn('[usePendingInvites] Server fetch failed, relying on local data', err);
      }
    };
    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [userId, refreshFromDb]);

  // Subscribe to changes on the instantInvites table
  useEffect(() => {
    if (!userId) {
      setInvitesByConversation(new Map());
      return undefined;
    }

    void refreshFromDb();

    const onChange = () => {
      void refreshFromDb();
    };

    db.instantInvites.hook('creating', onChange);
    db.instantInvites.hook('updating', onChange);
    db.instantInvites.hook('deleting', onChange);

    return () => {
      db.instantInvites.hook('creating').unsubscribe(onChange);
      db.instantInvites.hook('updating').unsubscribe(onChange);
      db.instantInvites.hook('deleting').unsubscribe(onChange);
    };
  }, [userId, refreshFromDb]);

  const refresh = useCallback(async () => {
    try {
      await fetchPendingInvites();
    } catch {
      // Server fetch may fail; fall through to local
    }
    await refreshFromDb();
  }, [refreshFromDb]);

  return { invitesByConversation, refresh };
}
