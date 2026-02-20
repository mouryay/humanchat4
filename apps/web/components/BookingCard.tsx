/**
 * Compact booking card for sidebar list
 */

'use client';

import { useRouter } from 'next/navigation';
import type { Booking } from '../../../src/lib/db';
import styles from './BookingCard.module.css';

interface BookingCardProps {
  booking: Booking;
  currentUserId: string;
  isActive?: boolean;
}

export default function BookingCard({ booking, currentUserId, isActive }: BookingCardProps) {
  const router = useRouter();
  
  const isExpert = currentUserId === booking.expertId;
  const otherUser = {
    name: isExpert ? booking.userName : booking.expertName,
    avatar: isExpert ? booking.userAvatar : booking.expertAvatar,
  };

  const getStatusBadge = () => {
    if (booking.status === 'awaiting_payment') {
      return { label: 'WAITING PAYMENT', color: styles.statusWarning };
    }
    if (booking.status === 'scheduled') {
      return { label: 'PAID', color: styles.statusPaid };
    }
    return { label: booking.status.toUpperCase(), color: styles.statusDefault };
  };

  const statusBadge = getStatusBadge();

  const handleClick = () => {
    if (booking.status === 'scheduled') {
      router.push(`/sessions/${booking.bookingId}`);
    }
  };

  return (
    <div 
      className={`${styles.card} ${isActive ? styles.cardActive : ''} ${booking.status === 'scheduled' ? styles.cardClickable : ''}`}
      onClick={handleClick}
    >
      <div className={styles.header}>
        <img
          src={otherUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.name)}&background=4f46e5&color=fff&size=64`}
          alt={otherUser.name}
          className={styles.avatar}
        />
        <div className={styles.info}>
          <div className={styles.name}>{otherUser.name}</div>
          <div className={styles.time}>
            {new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }).format(new Date(booking.startTime))}
          </div>
        </div>
      </div>
      
      <div className={styles.meta}>
        <span className={`${styles.badge} ${statusBadge.color}`}>
          {statusBadge.label}
        </span>
        <span className={styles.duration}>{booking.durationMinutes} min</span>
      </div>
    </div>
  );
}
