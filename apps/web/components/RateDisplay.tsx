'use client';

import clsx from 'clsx';
import styles from './ProfileCard.module.css';
import type { ScheduledRate } from '../../../src/lib/db';
import CharityBadge from './CharityBadge';

interface RateDisplayProps {
  conversationType?: 'free' | 'paid' | 'charity';
  confidentialRate?: boolean;
  instantRatePerMinute?: number;
  scheduledRates?: ScheduledRate[];
  isOnline?: boolean;
  charityName?: string;
  donationPreference?: 'on' | 'off';
}

const formatCurrency = (value?: number) => {
  if (value == null) return '';
  return `$${value.toFixed(2)}`;
};

export default function RateDisplay({
  conversationType,
  confidentialRate,
  instantRatePerMinute,
  scheduledRates,
  isOnline,
  charityName,
  donationPreference
}: RateDisplayProps) {
  return (
    <div className={styles.rateSection}>
      <div className={styles.badgeGroup}>
        {conversationType === 'free' && <span className={clsx(styles.badge, styles.freeBadge)}>Free</span>}
        {conversationType === 'charity' && <CharityBadge charityName={charityName} />}
        {confidentialRate && <span className={clsx(styles.badge, styles.confidentialBadge)}>By Request</span>}
        {conversationType === 'paid' && !confidentialRate && isOnline && instantRatePerMinute != null && (
          <span className={clsx(styles.badge, styles.paidBadge)}>{formatCurrency(instantRatePerMinute)}/min</span>
        )}
        {donationPreference === 'on' && <span className={clsx(styles.badge, styles.tipBadge)}>Accepts tips ⭐</span>}
      </div>
      {conversationType === 'charity' && (
        <div>
          {instantRatePerMinute != null && (
            <div className={styles.charityRate}>
              <span>
                {formatCurrency(instantRatePerMinute)}/min → {charityName ?? 'our charity partner'}
              </span>
            </div>
          )}
          <p className={styles.charitySubtext}>100% goes to charity</p>
        </div>
      )}
      {scheduledRates && scheduledRates.length > 0 && (
        <div className={styles.scheduledPills}>
          {scheduledRates.map((rate) => (
            <span key={`${rate.durationMinutes}-${rate.price}`} className={styles.scheduledPill}>
              {rate.durationMinutes} min • {formatCurrency(rate.price)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
