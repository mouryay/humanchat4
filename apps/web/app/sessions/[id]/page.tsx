'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db, type Booking } from '../../../../../src/lib/db';
import { sessionStatusManager } from '../../../services/sessionStatusManager';
import SessionLobby from '../../../components/SessionLobby';
import { BookingsManager } from '../../../components/BookingsManager';
import { getBookingById } from '../../../services/bookingApi';
import styles from './page.module.css';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params?.id as string;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUserId(sessionStatusManager.getCurrentUserId());
    return sessionStatusManager.onCurrentUserChange((userId) => setCurrentUserId(userId));
  }, []);

  useEffect(() => {
    if (!bookingId) {
      setBooking(null);
      setIsLoading(false);
      return;
    }

    console.log('[SessionDetailPage] Loading booking:', bookingId);
    setIsLoading(true);
    setError(null);

    let subscription: any;
    let mounted = true;

    // Always fetch fresh data from API on page load
    const init = async () => {
      try {
        console.log('[SessionDetailPage] Fetching fresh booking from API:', bookingId);
        const apiBooking = await getBookingById(bookingId);
        console.log('[SessionDetailPage] API booking:', apiBooking);
        
        // Sync to Dexie
        await db.bookings.put(apiBooking);
        console.log('[SessionDetailPage] Synced booking to Dexie');
        
        // Now set up the live query for reactive updates
        if (!mounted) return;
        
        subscription = liveQuery(async () => {
          const result = await db.bookings.get(bookingId);
          return result;
        }).subscribe({
          next: (result) => {
            if (!mounted) return;
            setBooking(result || null);
            setIsLoading(false);
          },
          error: (err) => {
            if (!mounted) return;
            console.error('[SessionDetailPage] Booking query error:', err);
            setError('Failed to load booking');
            setIsLoading(false);
          }
        });
      } catch (err) {
        console.error('[SessionDetailPage] Failed to fetch from API:', err);
        if (!mounted) return;
        
        // Fallback to Dexie cache if API fails
        const cachedBooking = await db.bookings.get(bookingId);
        if (cachedBooking) {
          console.log('[SessionDetailPage] Using cached booking from Dexie');
          setBooking(cachedBooking);
          setIsLoading(false);
        } else {
          setError('Booking not found');
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [bookingId]);

  if (!currentUserId) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Please sign in to view this session</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div>Loading session...</div>
          <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.6 }}>
            Booking ID: {bookingId}
          </div>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div style={{ color: '#fbbf24', marginBottom: '16px' }}>
            {error || 'Booking not found'}
          </div>
          <div style={{ fontSize: '14px', marginBottom: '16px', opacity: 0.6 }}>
            Booking ID: {bookingId}
          </div>
          <button
            onClick={() => router.push('/bookings')}
            style={{
              padding: '8px 16px',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              borderRadius: '8px',
              color: '#60a5fa',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Back to bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Top Header */}
      <div className={styles.topHeader}>
        <Link href="/?focus=sam" className={styles.logo}>
          HUMANCHAT.COM
        </Link>
        <Link 
          href="/account" 
          className={styles.backLinkMobile}
        >
          ← Back to Account
        </Link>
      </div>
      
      <div className={styles.container}>
        {/* Left Sidebar: Full Calendar */}
        <aside className={styles.sidebar}>
          <BookingsManager embedded selectedBookingId={bookingId} />
        </aside>
        
        {/* Main Content: Session Detail */}
        <main className={styles.main}>
          <SessionLobby booking={booking} currentUserId={currentUserId} />
        </main>
      </div>
    </>
  );
}
