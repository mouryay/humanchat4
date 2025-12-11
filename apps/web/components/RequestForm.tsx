'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Conversation, ProfileSummary } from '../../../src/lib/db';
import { addMessage, saveChatRequest } from '../../../src/lib/db';
import { submitConnectionRequest } from '../services/requestApi';
import styles from './RequestForm.module.css';

interface RequestFormProps {
  open: boolean;
  profile: ProfileSummary | null;
  conversation: Conversation | null;
  onClose: () => void;
}

type StepState = 'form' | 'success';

const getAvatar = (profile?: ProfileSummary | null) => {
  if (profile?.avatarUrl) return profile.avatarUrl;
  if (profile?.name) {
    return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(profile.name)}`;
  }
  return 'https://api.dicebear.com/8.x/initials/svg?seed=Guest';
};

export default function RequestForm({ open, profile, conversation, onClose }: RequestFormProps) {
  const [message, setMessage] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<StepState>('form');
  const [ackRepName, setAckRepName] = useState<string>('their representative');

  const shouldShowBudget = !profile?.confidentialRate;

  useEffect(() => {
    if (!open) {
      setMessage('');
      setPreferredTime('');
      setBudgetRange('');
      setError(null);
      setSubmitting(false);
      setStep('form');
      return;
    }
    setAckRepName(profile?.managerName ?? 'their representative');
  }, [open, profile]);

  const closeWithReset = useCallback(() => {
    setMessage('');
    setPreferredTime('');
    setBudgetRange('');
    setError(null);
    setSubmitting(false);
    setStep('form');
    onClose();
  }, [onClose]);

  const persistSamReceipt = useCallback(
    async (repName: string) => {
      if (!conversation) return;
      await addMessage(conversation.conversationId, {
        senderId: 'sam',
        content: `Request sent to ${repName}. They'll respond within 24 hours.`,
        type: 'sam_response',
        timestamp: Date.now()
      });
    },
    [conversation]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) {
      setError('Profile missing. Please retry.');
      return;
    }
    if (!message.trim()) {
      setError('Tell the rep why you want to connect.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { local } = await submitConnectionRequest({
        targetUserId: profile.userId,
        message: message.trim(),
        preferredTime: preferredTime.trim() || undefined,
        budgetRange: budgetRange.trim() || undefined
      });
      await saveChatRequest(local);
      const repName = local.representativeName ?? profile.managerName ?? 'their representative';
      setAckRepName(repName);
      await persistSamReceipt(repName).catch((err) => {
        console.warn('Failed to log Sam receipt', err);
      });
      setStep('success');
    } catch (submissionError) {
      const detail = submissionError instanceof Error ? submissionError.message : 'Unable to send request right now.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !profile) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <img src={getAvatar(profile)} alt={profile.name ? `${profile.name}'s avatar` : 'Profile avatar'} className={styles.avatar} />
            <div>
              <div className={styles.title}>{profile.name}</div>
              <div className={styles.subtitle}>Private request</div>
            </div>
          </div>
          <button type="button" className={styles.closeButton} onClick={closeWithReset}>
            ×
          </button>
        </div>

        {step === 'form' && (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.label}>
              Why do you want to connect?
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Share the context for this chat"
                required
              />
            </label>
            <label className={styles.label}>
              Preferred date/time <span className={styles.optional}>(optional)</span>
              <input
                type="text"
                value={preferredTime}
                onChange={(event) => setPreferredTime(event.target.value)}
                placeholder="Next Tue after 3 PM PT"
              />
            </label>
            {shouldShowBudget && (
              <label className={styles.label}>
                Budget range <span className={styles.optional}>(optional)</span>
                <input
                  type="text"
                  value={budgetRange}
                  onChange={(event) => setBudgetRange(event.target.value)}
                  placeholder="$5k - $7k"
                />
              </label>
            )}
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className={styles.submitButton} disabled={submitting || !message.trim()}>
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </form>
        )}

        {step === 'success' && (
          <div className={styles.successState}>
            <div className={styles.successIcon}>✓</div>
            <p>
              Request sent to <strong>{ackRepName}</strong>. They'll respond within 24 hours.
            </p>
            <button type="button" className={styles.primaryButton} onClick={closeWithReset}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
