'use client';

import clsx from 'clsx';
import styles from './ProfileCard.module.css';

interface CharityBadgeProps {
  charityName?: string;
  className?: string;
  compact?: boolean;
}

export default function CharityBadge({ charityName, className, compact = false }: CharityBadgeProps) {
  if (!charityName) {
    return (
      <span className={clsx(styles.badge, styles.charityBadge, className)}>
        💚 Proceeds benefit our charity partners
      </span>
    );
  }

  return (
    <span className={clsx(styles.badge, styles.charityBadge, compact && styles.charityBadgeCompact, className)}>
      💚 Proceeds benefit {charityName}
    </span>
  );
}
