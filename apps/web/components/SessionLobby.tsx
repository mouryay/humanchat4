'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, type Booking } from '../../../src/lib/db';
import { cancelBooking } from '../services/bookingApi';
import { startCall } from '../services/callApi';
import styles from './SessionLobby.module.css';

interface SessionLobbyProps {
  booking: Booking;
  currentUserId: string;
}

type SessionPhase = 'future' | 'live' | 'past';

interface SessionState {
  phase: SessionPhase;
  canStartCall: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  statusBadge: string;
  statusColor: string;
}

export default function SessionLobby({ booking, currentUserId }: SessionLobbyProps) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const sessionState: SessionState = useMemo(() => {
    const startTime = booking.startTime;
    const endTime = booking.endTime;
    const oneHourBefore = startTime - 60 * 60 * 1000;

    if (now < startTime) {
      return {
        phase: 'future',
        canStartCall: false,
        canCancel: now < oneHourBefore,
        canReschedule: now < oneHourBefore,
        statusBadge: 'STARTS SOON',
        statusColor: styles.statusFuture
      };
    } else if (now >= startTime && now <= endTime) {
      return {
        phase: 'live',
        canStartCall: true,
        canCancel: false,
        canReschedule: false,
        statusBadge: 'IN SESSION',
        statusColor: styles.statusLive
      };
    } else {
      return {
        phase: 'past',
        canStartCall: false,
        canCancel: false,
        canReschedule: false,
        statusBadge: 'COMPLETED',
        statusColor: styles.statusPast
      };
    }
  }, [booking, now]);

  const otherUser = useMemo(() => {
    const isExpert = currentUserId === booking.expertId;
    return {
      id: isExpert ? booking.userId : booking.expertId,
      name: isExpert ? booking.userName : booking.expertName,
      avatar: isExpert ? booking.userAvatar : booking.expertAvatar,
      headline: booking.expertHeadline
    };
  }, [booking, currentUserId]);

  const handleStartCall = async (callType: 'video' | 'audio') => {
    if (!sessionState.canStartCall) return;
    
    setIsStartingCall(true);
    try {
      // Create call through API
      const result = await startCall({
        conversationId: `booking-${booking.bookingId}`, // Create/use conversation linked to booking
        callType,
      });
      
      // Navigate to call page
      router.push(`/call/${result.callId}?bookingId=${booking.bookingId}`);
    } catch (error) {
      console.error('Failed to start call:', error);
      alert(error instanceof Error ? error.message : 'Failed to start call');
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleCancel = async () => {
    if (!sessionState.canCancel) return;
    
    const confirmed = confirm(
      'Are you sure you want to cancel this session? Cancellations within 1 hour of the start time may not be eligible for refunds.'
    );
    
    if (!confirmed) return;
    
    setIsCancelling(true);
    try {
      await cancelBooking(booking.bookingId);
      router.push('/bookings?tab=canceled');
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel session');
      setIsCancelling(false);
    }
  };

  const handleReschedule = () => {
    // Navigate to reschedule flow
    router.push(`/experts/${otherUser.id}/schedule?reschedule=${booking.bookingId}`);
  };

  const handleMessage = async () => {
    // Find existing conversation between the two parties
    const allConversations = await db.conversations.toArray();
    
    const existingConversation = allConversations.find(conv => 
      conv.type === 'human' && 
      conv.participants.includes(booking.userId) && 
      conv.participants.includes(booking.expertId)
    );
    
    if (existingConversation) {
      // Navigate to existing conversation
      router.push(`/?conversationId=${existingConversation.conversationId}`);
    } else {
      // Create new conversation (fallback)
      const otherUserId = booking.userId === currentUserId ? booking.expertId : booking.userId;
      router.push(`/?userId=${otherUserId}`);
    }
  };

  const formatDateTime = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(timestamp));
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = timestamp - now;
    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `in ${days} day${days !== 1 ? 's' : ''}`;
    if (hours > 0) return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
    if (minutes > 0) return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    return 'very soon';
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Session with {otherUser.name}</h1>
          <div className={styles.statusRow}>
            <span className={`${styles.statusBadge} ${sessionState.statusColor}`}>
              {sessionState.statusBadge}
            </span>
            {sessionState.phase === 'future' && (
              <span className={styles.countdown}>
                Starts {formatRelativeTime(booking.startTime)}
              </span>
            )}
            {sessionState.phase === 'live' && (
              <span className={styles.countdown}>Session window open</span>
            )}
          </div>
        </div>
      </header>

      {/* Session Info Card */}
      <div className={styles.infoCard}>
        <div className={styles.infoRow}>
          <div className={styles.infoLabel}>Date & Time</div>
          <div className={styles.infoValue}>
            {formatDateTime(booking.startTime)} ({booking.durationMinutes} min)
          </div>
        </div>
        {booking.meetingTitle && (
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>Topic</div>
            <div className={styles.infoValue}>{booking.meetingTitle}</div>
          </div>
        )}
        {booking.timezone && (
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>Timezone</div>
            <div className={styles.infoValue}>{booking.timezone}</div>
          </div>
        )}
        {booking.price && (
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>Session Fee</div>
            <div className={styles.infoValue}>${(booking.price / 100).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Prep Section (only for future sessions) */}
      {sessionState.phase === 'future' && (
        <div className={styles.prepCard}>
          <h3 className={styles.prepTitle}>Prep with Simple Sam</h3>
          <p className={styles.prepSubtitle}>
            Here are 3 quick prompts to make the call productive:
          </p>
          <ul className={styles.prepList}>
            <li>Share your target role + timeline</li>
            <li>Paste your current resume highlights</li>
            <li>List 2–3 projects you want feedback on</li>
          </ul>
          <textarea
            placeholder="Add notes or questions for the session..."
            className={styles.prepTextarea}
            rows={3}
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.actions}>
        <button
          disabled={!sessionState.canStartCall || isStartingCall}
          onClick={() => handleStartCall('video')}
          className={`${styles.actionButton} ${styles.actionButtonVideo}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          Start video
        </button>

        <button
          disabled={!sessionState.canStartCall || isStartingCall}
          onClick={() => handleStartCall('audio')}
          className={`${styles.actionButton} ${styles.actionButtonAudio}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          Start audio
        </button>

        <button onClick={handleMessage} className={`${styles.actionButton} ${styles.actionButtonOutline}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Message
        </button>

        {sessionState.canReschedule && (
          <button 
            onClick={handleReschedule} 
            className={`${styles.actionButton} ${styles.actionButtonReschedule}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Reschedule
          </button>
        )}

        {sessionState.canCancel ? (
          <button 
            onClick={handleCancel} 
            disabled={isCancelling}
            className={`${styles.actionButton} ${styles.actionButtonOutline}`}
          >
            Cancel
          </button>
        ) : (
          <button disabled className={`${styles.actionButton} ${styles.actionButtonOutline}`}>
            Cancel
          </button>
        )}
      </div>

      {/* Policy Reminder */}
      <p className={styles.policyText}>
        {sessionState.phase === 'future'
          ? 'Cancel or reschedule available until 1 hour before start.'
          : 'Once a call starts, it can continue past end time until both hang up.'}
      </p>
    </div>
  );
}
