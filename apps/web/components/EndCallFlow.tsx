'use client';

import styles from './ConversationView.module.css';

interface EndCallSummary {
  durationSeconds: number;
  totalAmount: number;
  currency: string;
  paymentIntentId?: string;
}

interface EndCallFlowProps {
  summary: EndCallSummary;
  onDismiss: () => void;
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

export default function EndCallFlow({ summary, onDismiss }: EndCallFlowProps) {
  return (
    <div className={styles.endCallOverlay} role="dialog" aria-modal="true">
      <div className={styles.endCallCard}>
        <h3>Session complete</h3>
        <p>You talked for {formatDuration(summary.durationSeconds)}.</p>
        <p>
          Billing total: <strong>{summary.currency.toUpperCase()} ${summary.totalAmount.toFixed(2)}</strong>
        </p>
        {summary.paymentIntentId ? <p>Stripe payment confirmed (intent {summary.paymentIntentId}).</p> : <p>No payment required.</p>}
        <button type="button" className={styles.primaryButton} onClick={onDismiss}>
          Close
        </button>
      </div>
    </div>
  );
}
