/**
 * Hook for accessing user's bookings from Dexie
 */

import { liveQuery } from 'dexie';
import { db, type Booking } from '../../../src/lib/db';
import { useState, useEffect } from 'react';
import { sessionStatusManager } from '../services/sessionStatusManager';

export function useBookings(filter?: 'upcoming' | 'past' | 'all') {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    setCurrentUserId(sessionStatusManager.getCurrentUserId());
    return sessionStatusManager.onCurrentUserChange((userId) => setCurrentUserId(userId));
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setBookings([]);
      return;
    }

    const subscription = liveQuery(async () => {
      const allBookings = await db.bookings.toArray();
      const userBookings = allBookings.filter(
        b => b.userId === currentUserId || b.expertId === currentUserId
      );

      const now = Date.now();

      switch (filter) {
        case 'upcoming':
          return userBookings
            .filter(b => b.status === 'scheduled' && b.startTime > now)
            .sort((a, b) => a.startTime - b.startTime);
        case 'past':
          return userBookings
            .filter(b => b.status === 'completed' || (b.status === 'scheduled' && b.endTime < now))
            .sort((a, b) => b.startTime - a.startTime);
        default:
          return userBookings.sort((a, b) => b.startTime - a.startTime);
      }
    }).subscribe({
      next: (result) => setBookings(result || []),
      error: (err) => console.error('[useBookings] Query error:', err)
    });

    return () => subscription.unsubscribe();
  }, [currentUserId, filter]);

  return { bookings, currentUserId };
}
