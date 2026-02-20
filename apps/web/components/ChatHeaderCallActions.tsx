/**
 * Call action buttons in chat header
 * Shows "Start video call" and "Start audio call" buttons
 * Disabled unless there's an active booking window for this conversation
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Video, Phone, Lock } from 'lucide-react';
import { startCall } from '../services/callApi';
import { useRouter } from 'next/navigation';
import { db, type Booking } from '../../../src/lib/db';
import { liveQuery } from 'dexie';
import { sessionStatusManager } from '../services/sessionStatusManager';
import styles from './ConversationView.module.css';

interface ChatHeaderCallActionsProps {
  conversationId: string;
  isConversationAccepted: boolean;
  compact?: boolean;
  participantIds?: string[];
}

export default function ChatHeaderCallActions({
  conversationId,
  isConversationAccepted,
  compact = false,
  participantIds = [],
}: ChatHeaderCallActionsProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    setCurrentUserId(sessionStatusManager.getCurrentUserId());
    return sessionStatusManager.onCurrentUserChange((userId) => setCurrentUserId(userId));
  }, []);

  // Query bookings for this conversation's participants
  useEffect(() => {
    if (participantIds.length === 0 || !currentUserId) {
      setBookings([]);
      return;
    }

    const subscription = liveQuery(async () => {
      const allBookings = await db.bookings.toArray();
      return allBookings.filter(b => 
        b.status === 'scheduled' &&
        (
          (b.userId === currentUserId && participantIds.includes(b.expertId)) ||
          (b.expertId === currentUserId && participantIds.includes(b.userId))
        )
      );
    }).subscribe({
      next: (result) => setBookings(result || []),
      error: (err) => console.error('[ChatHeaderCallActions] Booking query error:', err)
    });

    return () => subscription.unsubscribe();
  }, [participantIds, currentUserId]);

  // Check if there's an active session window right now
  const hasActiveSessionWindow = useMemo(() => {
    const now = Date.now();
    return (bookings || []).some(b => {
      const isInWindow = now >= b.startTime && now <= b.endTime;
      console.log('[ChatHeaderCallActions] Checking booking window:', {
        bookingId: b.bookingId,
        startTime: new Date(b.startTime).toISOString(),
        endTime: new Date(b.endTime).toISOString(),
        now: new Date(now).toISOString(),
        isInWindow
      });
      return isInWindow;
    });
  }, [bookings]);

  const upcomingBooking = useMemo(() => {
    if (!bookings || bookings.length === 0) return null;
    const now = Date.now();
    const upcoming = bookings
      .filter(b => b.startTime > now)
      .sort((a, b) => a.startTime - b.startTime)[0];
    return upcoming;
  }, [bookings]);

  console.log('[ChatHeaderCallActions] Rendered:', { 
    conversationId, 
    isConversationAccepted,
    hasActiveSessionWindow,
    bookingsCount: bookings?.length || 0,
    upcomingBooking: upcomingBooking?.bookingId
  });

  const handleStartCall = async (callType: 'video' | 'audio') => {
    console.log('[ChatHeaderCallActions] Starting call:', { conversationId, callType, hasActiveSessionWindow });
    
    if (!hasActiveSessionWindow) {
      console.warn('[ChatHeaderCallActions] No active session window');
      if (upcomingBooking) {
        // Navigate to session detail page
        router.push(`/sessions/${upcomingBooking.bookingId}`);
      } else {
        alert('Calls are only available during booked session windows. Please book a session first.');
      }
      return;
    }

    if (!isConversationAccepted) {
      console.warn('[ChatHeaderCallActions] Conversation not accepted');
      alert('Wait for the chat request to be accepted first');
      return;
    }

    setIsStarting(true);

    try {
      console.log('[ChatHeaderCallActions] Calling startCall API...');
      const result = await startCall({
        conversationId,
        callType,
      });
      
      console.log('[ChatHeaderCallActions] Call started successfully:', result);

      // Navigate to live room
      router.push(`/call/${result.callId}`);
    } catch (error: any) {
      console.error('[ChatHeaderCallActions] Failed to start call:', error);
      console.error('[ChatHeaderCallActions] Error details:', {
        status: error?.status,
        message: error?.message,
        fullError: JSON.stringify(error, null, 2)
      });
      
      if (error.status === 409) {
        alert('A call is already in progress');
      } else {
        alert(error.message || 'Failed to start call. Please try again.');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const callsDisabled = !hasActiveSessionWindow || !isConversationAccepted;
  const tooltipMessage = !hasActiveSessionWindow 
    ? 'Calls unlock during booked session windows' 
    : 'Waiting for chat acceptance';

  return (
    <div className={compact ? styles.callButtonsCompact : styles.callButtons} title={callsDisabled ? tooltipMessage : undefined}>
      <button
        onClick={() => handleStartCall('video')}
        disabled={isStarting || callsDisabled}
        className={compact ? styles.callButtonCompact : styles.callButtonPrimary}
        aria-label="Start video call"
        style={{ 
          opacity: callsDisabled ? 0.5 : 1,
          cursor: callsDisabled ? 'not-allowed' : 'pointer',
          position: 'relative'
        }}
      >
        {!hasActiveSessionWindow && <Lock size={compact ? 12 : 14} className={styles.lockIcon} />}
        <Video size={compact ? 16 : 18} />
        {!compact && <span>Video call</span>}
      </button>

      <button
        onClick={() => handleStartCall('audio')}
        disabled={isStarting || callsDisabled}
        className={compact ? styles.callButtonCompact : styles.callButtonSecondary}
        aria-label="Start audio call"
        style={{ 
          opacity: callsDisabled ? 0.5 : 1,
          cursor: callsDisabled ? 'not-allowed' : 'pointer',
          position: 'relative'
        }}
      >
        {!hasActiveSessionWindow && <Lock size={compact ? 12 : 14} className={styles.lockIcon} />}
        <Phone size={compact ? 16 : 18} />
        {!compact && <span>Audio call</span>}
      </button>
      
      {!compact && !hasActiveSessionWindow && upcomingBooking && (
        <button
          onClick={() => router.push(`/sessions/${upcomingBooking.bookingId}`)}
          className={styles.bookingCta}
        >
          View upcoming session
        </button>
      )}
    </div>
  );
}
