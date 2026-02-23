/**
 * Call action buttons in chat header
 * Shows "Start video call" and "Start audio call" buttons
 * Enabled during expert's available calendar hours
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Video, Phone, Lock } from 'lucide-react';
import { startCall } from '../services/callApi';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { db, type Booking } from '../../../src/lib/db';
import { liveQuery } from 'dexie';
import { sessionStatusManager } from '../services/sessionStatusManager';
import { getExpertWeeklyAvailability, type WeeklyRule } from '../services/bookingApi';
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isStarting, setIsStarting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expertAvailability, setExpertAvailability] = useState<WeeklyRule[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);

  useEffect(() => {
    setCurrentUserId(sessionStatusManager.getCurrentUserId());
    return sessionStatusManager.onCurrentUserChange((userId) => setCurrentUserId(userId));
  }, []);

  // Get the expert ID (the other participant who is not the current user)
  const expertId = useMemo(() => {
    if (!currentUserId || participantIds.length === 0) return null;
    return participantIds.find(id => id !== currentUserId) || null;
  }, [currentUserId, participantIds]);

  // Fetch expert's weekly availability schedule
  useEffect(() => {
    if (!expertId) {
      setExpertAvailability([]);
      return;
    }

    let mounted = true;
    setIsLoadingAvailability(true);

    getExpertWeeklyAvailability(expertId)
      .then((rules) => {
        if (mounted) {
          setExpertAvailability(rules);
        }
      })
      .catch((err) => {
        console.error('[ChatHeaderCallActions] Failed to fetch availability:', err);
        if (mounted) {
          setExpertAvailability([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingAvailability(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [expertId]);

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

  // Check if expert is available right now based on their calendar schedule
  const isExpertAvailableNow = useMemo(() => {
    if (isLoadingAvailability || expertAvailability.length === 0) return false;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Check if current day/time matches any availability rule
    const hasAvailability = expertAvailability.some(rule => {
      if (rule.dayOfWeek !== dayOfWeek) return false;
      
      // Simple time comparison (HH:MM format)
      return currentTime >= rule.startTime && currentTime <= rule.endTime;
    });

    console.log('[ChatHeaderCallActions] Checking expert availability:', {
      dayOfWeek,
      currentTime,
      hasAvailability,
      rulesCount: expertAvailability.length
    });

    return hasAvailability;
  }, [expertAvailability, isLoadingAvailability]);

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
    isExpertAvailableNow,
    bookingsCount: bookings?.length || 0,
    upcomingBooking: upcomingBooking?.bookingId,
    expertId,
    availabilityRulesCount: expertAvailability.length
  });

  const handleStartCall = async (callType: 'video' | 'audio') => {
    console.log('[ChatHeaderCallActions] Starting call:', { conversationId, callType, isExpertAvailableNow });
    
    if (!isExpertAvailableNow) {
      console.warn('[ChatHeaderCallActions] Expert not available now');
      if (upcomingBooking) {
        // Navigate to session detail page
        router.push(`/sessions/${upcomingBooking.bookingId}`);
      } else {
        alert('This responder accepts Audio/Video calls only during open hours. Reserve a time slot to unlock calling.');
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

      // Build return URL with current path and params
      const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

      // Navigate to live room with returnUrl
      router.push(`/call/${result.callId}?returnUrl=${encodeURIComponent(currentUrl)}`);
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

  const callsDisabled = !isExpertAvailableNow || !isConversationAccepted;
  const tooltipMessage = useMemo(() => {
    if (!isConversationAccepted) return 'Waiting for chat acceptance';
    if (!isExpertAvailableNow) {
      if (upcomingBooking) {
        const startDate = new Date(upcomingBooking.startTime);
        return `Call available during your scheduled session on ${startDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
      }
      return 'Expert is not available right now. Check their schedule to book a session.';
    }
    return '';
  }, [isConversationAccepted, isExpertAvailableNow, upcomingBooking]);

  return (
    <div className={compact ? styles.callButtonsCompact : styles.callButtons}>
      <button
        onClick={() => handleStartCall('video')}
        disabled={isStarting}
        className={compact ? styles.callButtonCompact : styles.callButtonPrimary}
        aria-label="Start video call"
        title={callsDisabled ? tooltipMessage : 'Start video call'}
        style={{ 
          opacity: callsDisabled ? 0.5 : 1,
          cursor: callsDisabled ? 'not-allowed' : 'pointer'
        }}
      >
        <Video size={compact ? 16 : 18} />
        {!compact && <span>Video call</span>}
        {!isExpertAvailableNow && <Lock size={compact ? 12 : 14} className={styles.lockIcon} />}
      </button>

      <button
        onClick={() => handleStartCall('audio')}
        disabled={isStarting}
        className={compact ? styles.callButtonCompact : styles.callButtonSecondary}
        aria-label="Start audio call"
        title={callsDisabled ? tooltipMessage : 'Start audio call'}
        style={{ 
          opacity: callsDisabled ? 0.5 : 1,
          cursor: callsDisabled ? 'not-allowed' : 'pointer'
        }}
      >
        <Phone size={compact ? 16 : 18} />
        {!compact && <span>Audio call</span>}
        {!isExpertAvailableNow && <Lock size={compact ? 12 : 14} className={styles.lockIcon} />}
      </button>
      
      {!compact && !isExpertAvailableNow && upcomingBooking && (
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
