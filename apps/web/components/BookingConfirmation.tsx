'use client';

import type { ProfileSummary } from '../../../src/lib/db';
import type { CalendarSlot } from '../services/bookingService';
import { formatSlotDate, formatSlotTimeRange, getTimezoneAbbreviation } from '../utils/timezone';
import styles from './BookingModal.module.css';

interface BookingConfirmationProps {
  profile: ProfileSummary;
  slot: CalendarSlot;
  durationMinutes: number;
  price: number;
  timezone: string;
  isSubmitting: boolean;
  error?: string | null;
  onConfirm: () => void;
  onBack: () => void;
}

export default function BookingConfirmation({
  profile,
  slot,
  durationMinutes,
  price,
  timezone,
  isSubmitting,
  error,
  onConfirm,
  onBack
}: BookingConfirmationProps) {
  return (
    <div className={styles.confirmationCard}>
      <div className={styles.summaryRow}>
        <span className={styles.summaryLabel}>Meeting with</span>
        <span className={styles.summaryValue}>{profile.name}</span>
      </div>
      <div className={styles.summaryRow}>
        <span className={styles.summaryLabel}>When</span>
        <span className={styles.summaryValue}>
          {formatSlotDate(slot.start, timezone)} • {formatSlotTimeRange(slot.start, slot.end, timezone)}
        </span>
      </div>
      <div className={styles.summaryRow}>
        <span className={styles.summaryLabel}>Timezone</span>
        <span className={styles.summaryValue}>{getTimezoneAbbreviation(timezone, slot.start)}</span>
      </div>
      <div className={styles.summaryRow}>
        <span className={styles.summaryLabel}>Duration</span>
        <span className={styles.summaryValue}>{durationMinutes} min</span>
      </div>
      <div className={styles.summaryRow}>
        <span className={styles.summaryLabel}>Total</span>
        <span className={styles.summaryValue}>${price.toFixed(2)}</span>
      </div>
      {error && <div className={styles.errorState}>{error}</div>}
      <div className={styles.buttonRow}>
        <button type="button" className={styles.secondaryButton} onClick={onBack} disabled={isSubmitting}>
          Go Back
        </button>
        <button type="button" className={styles.primaryButton} onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? 'Booking…' : 'Confirm Booking'}
        </button>
      </div>
    </div>
  );
}
