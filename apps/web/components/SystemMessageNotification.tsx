'use client';

import { useEffect, useState } from 'react';
import type { Message } from '../../../src/lib/db';
import styles from './SystemMessageNotification.module.css';

interface SystemMessageNotificationProps {
  message: Message;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function SystemMessageNotification({
  message,
  onDismiss,
  autoDismissMs = 5000
}: SystemMessageNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Wait for fade-out animation
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.notification}>
      <div className={styles.content}>
        {message.content}
      </div>
      <button
        type="button"
        className={styles.dismissButton}
        onClick={() => {
          setIsVisible(false);
          setTimeout(onDismiss, 300);
        }}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
