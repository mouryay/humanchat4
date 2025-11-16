'use client';

import { useMemo, useState } from 'react';
import styles from './ConversationView.module.css';
import { initiateDonation } from '../services/sessionApi';
import type { PaymentMode } from '../../../src/lib/db';

const PRESET_AMOUNTS = [5, 10, 20];

interface DonationModalProps {
  sessionId: string;
  hostName: string;
  charityName?: string;
  paymentMode: PaymentMode;
  onClose: () => void;
}

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

export default function DonationModal({ sessionId, hostName, charityName, paymentMode, onClose }: DonationModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(PRESET_AMOUNTS[1]);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolvedAmount = useMemo(() => {
    const numericCustom = Number(customAmount);
    if (!Number.isNaN(numericCustom) && numericCustom > 0) {
      return numericCustom;
    }
    return selectedAmount;
  }, [customAmount, selectedAmount]);

  const impactMessage = useMemo(() => {
    if (paymentMode === 'charity' && charityName) {
      return `Your tip will be routed directly to ${charityName}.`;
    }
    return `Tips are paid out to ${hostName} (minus platform fees).`;
  }, [paymentMode, charityName, hostName]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);
    const dollars = Number(resolvedAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      const cents = Math.round(dollars * 100);
      const result = await initiateDonation(sessionId, cents);
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, '_blank', 'noopener');
        setStatusMessage('Redirected to Stripe Checkout to finish your tip.');
      } else {
        setStatusMessage('Thanks! Your tip was processed.');
      }
      setCustomAmount('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to process donation right now.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.donationModal} role="dialog" aria-modal="true">
      <form className={styles.donationCard} onSubmit={handleSubmit}>
        <div>
          <h3>Send thanks to {hostName}</h3>
          <p>{impactMessage}</p>
        </div>
        <div className={styles.donationGrid}>
          {PRESET_AMOUNTS.map((amount) => {
            const isActive = !customAmount && selectedAmount === amount;
            return (
              <button
                key={amount}
                type="button"
                className={`${styles.donationAmountButton} ${isActive ? styles.donationAmountButtonActive : ''}`.trim()}
                onClick={() => {
                  setSelectedAmount(amount);
                  setCustomAmount('');
                }}
              >
                {formatCurrency(amount)}
              </button>
            );
          })}
        </div>
        <div className={styles.donationInputRow}>
          <label htmlFor="custom-amount">Custom</label>
          <input
            id="custom-amount"
            type="number"
            min="1"
            step="1"
            placeholder="Enter amount"
            value={customAmount}
            onChange={(event) => setCustomAmount(event.target.value)}
          />
        </div>
        {error && <span className={styles.error}>{error}</span>}
        {statusMessage && <span className={styles.statusBadge}>{statusMessage}</span>}
        <div className={styles.donationFooter}>
          <button type="submit" className={styles.primaryButton} disabled={submitting}>
            {submitting ? 'Sending…' : `Tip ${formatCurrency(resolvedAmount)}`}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={submitting}>
            Skip
          </button>
        </div>
      </form>
    </div>
  );
}
