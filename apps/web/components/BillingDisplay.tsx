'use client';

import type { Session } from '../../../src/lib/db';
import styles from './ConversationView.module.css';

interface BillingDisplayProps {
  session: Session;
  elapsedSeconds: number;
}

const formatAmount = (amount: number): string => `$${amount.toFixed(2)}`;

export const computeInstantTotal = (session: Session, elapsedSeconds: number): number => {
  const rate = session.instantRatePerMinute ?? (session.durationMinutes > 0 ? session.agreedPrice / session.durationMinutes : 0);
  return Math.max(0, (elapsedSeconds / 60) * rate);
};

export default function BillingDisplay({ session, elapsedSeconds }: BillingDisplayProps) {
  if (session.paymentMode === 'charity') {
    const label = session.type === 'scheduled' ? 'Scheduled rate' : 'Live rate';
    const rate = session.type === 'scheduled' ? session.agreedPrice / Math.max(session.durationMinutes, 1) : session.instantRatePerMinute ?? 0;
    return (
      <div className={styles.billingBadge}>
        <div>
          <span>{label}:</span>
          <strong>{formatAmount(rate)} → {session.charityName ?? 'charity partner'}</strong>
        </div>
        <small className={styles.billingSubtext}>100% goes to charity</small>
      </div>
    );
  }

  if (session.paymentMode === 'free') {
    return (
      <div className={styles.billingBadge}>
        <span>Session:</span>
        <strong>Free</strong>
      </div>
    );
  }

  if (session.type === 'scheduled') {
    return (
      <div className={styles.billingBadge}>
        <span>Session:</span>
        <strong>{formatAmount(session.agreedPrice)}</strong>
      </div>
    );
  }

  const total = computeInstantTotal(session, elapsedSeconds);
  return (
    <div className={styles.billingBadge}>
      <span>Total:</span>
      <strong>{formatAmount(total)}</strong>
    </div>
  );
}
