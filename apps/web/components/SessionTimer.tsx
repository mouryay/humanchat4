'use client';

import styles from './ConversationView.module.css';

const formatElapsed = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const hrs = Math.floor(mins / 60);
  const displayMins = mins % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${displayMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

interface SessionTimerProps {
  elapsedSeconds: number;
}

export default function SessionTimer({ elapsedSeconds }: SessionTimerProps) {
  return <div className={styles.timerBadge}>{formatElapsed(Math.max(0, elapsedSeconds))}</div>;
}
