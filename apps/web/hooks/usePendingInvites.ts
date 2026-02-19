'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { db, type InstantInvite } from '../../../src/lib/db';
import { fetchPendingInvites } from '../services/instantInviteApi';
import { sessionStatusManager } from '../services/sessionStatusManager';

export function usePendingInvites() {
  const [invitesByConversation, setInvitesByConversation] = useState<Map<string, InstantInvite>>(new Map());
  const [userId, setUserId] = useState<string | null>(() => sessionStatusManager.getCurrentUserId());
  const serverFetchedRef = useRef(false);

  useEffect(() => {
    return sessionStatusManager.onCurrentUserChange((next) => {
      setUserId(next);
      serverFetchedRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (!userId) {
      setInvitesByConversation(new Map());
      return undefined;
    }

    const subscription = liveQuery(() =>
      db.instantInvites
        .where('targetUserId')
        .equals(userId)
        .filter((invite) => invite.status === 'pending')
        .toArray()
    ).subscribe({
      next: (pending) => {
        const map = new Map<string, InstantInvite>();
        for (const invite of pending) {
          const existing = map.get(invite.conversationId);
          if (!existing || invite.createdAt > existing.createdAt) {
            map.set(invite.conversationId, invite);
          }
        }
        setInvitesByConversation(map);
      },
      error: (err) => {
        console.warn('[usePendingInvites] liveQuery error', err);
      }
    });

    return () => subscription.unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId || serverFetchedRef.current) return;

    let cancelled = false;
    const hydrate = async () => {
      try {
        await fetchPendingInvites();
        if (!cancelled) serverFetchedRef.current = true;
      } catch (err) {
        console.warn('[usePendingInvites] Server fetch failed', err);
      }
    };
    void hydrate();

    return () => { cancelled = true; };
  }, [userId]);

  const refresh = useCallback(async () => {
    try {
      await fetchPendingInvites();
    } catch {
      // fall through to local data
    }
  }, []);

  return { invitesByConversation, refresh };
}
