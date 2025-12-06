'use client';

import { useState } from 'react';
import type { InstantInvite } from '../../../src/lib/db';
import { acceptInstantInvite, cancelInstantInvite, declineInstantInvite } from '../services/instantInviteApi';
import styles from './ConversationView.module.css';

interface InstantInvitePanelProps {
  invite: InstantInvite;
  currentUserId: string | null;
}

type PendingAction = 'accept' | 'decline' | 'cancel' | null;

const getInviteMessage = (invite: InstantInvite, currentUserId: string | null): string => {
  const isRequester = invite.requesterUserId === currentUserId;
  const isTarget = invite.targetUserId === currentUserId;

  switch (invite.status) {
    case 'pending':
      if (isRequester) {
        return 'Waiting for your host to accept. We will notify you as soon as they hop in.';
      }
      if (isTarget) {
        return 'A member is ready to connect instantly. Accept when you are ready to join the room.';
      }
      return 'Invite pending response.';
    case 'accepted':
      return 'Invite accepted. Setting up the live room now…';
    case 'declined':
      return isRequester ? 'Your host declined this request.' : 'You declined this request.';
    case 'cancelled':
      return isTarget ? 'The member cancelled their request.' : 'You cancelled this request.';
    case 'expired':
      return 'This invite expired. Start a new one anytime.';
    default:
      return 'Invite status updated.';
  }
};

export default function InstantInvitePanel({ invite, currentUserId }: InstantInvitePanelProps) {
  const [action, setAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const isRequester = invite.requesterUserId === currentUserId;
  const isTarget = invite.targetUserId === currentUserId;
  const isPending = invite.status === 'pending';

  const handleAction = async (nextAction: PendingAction, handler: () => Promise<unknown>) => {
    setAction(nextAction);
    setError(null);
    try {
      await handler();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update that invite yet. Please retry.';
      setError(message);
    } finally {
      setAction(null);
    }
  };

  return (
    <div className={styles.invitePanel}>
      <div className={styles.inviteMessage}>{getInviteMessage(invite, currentUserId)}</div>
      {error && <div className={styles.error}>{error}</div>}
      {isPending && (
        <div className={styles.inviteActions}>
          {isTarget && (
            <button
              type="button"
              className={`${styles.inviteActionButton} ${styles.inviteActionPrimary}`}
              disabled={action !== null}
              onClick={() => handleAction('accept', () => acceptInstantInvite(invite.inviteId))}
            >
              {action === 'accept' ? 'Connecting…' : 'Accept & Join'}
            </button>
          )}
          {isTarget && (
            <button
              type="button"
              className={`${styles.inviteActionButton} ${styles.inviteActionSecondary}`}
              disabled={action !== null}
              onClick={() => handleAction('decline', () => declineInstantInvite(invite.inviteId))}
            >
              {action === 'decline' ? 'Declining…' : 'Decline'}
            </button>
          )}
          {isRequester && (
            <button
              type="button"
              className={`${styles.inviteActionButton} ${styles.inviteActionSecondary}`}
              disabled={action !== null}
              onClick={() => handleAction('cancel', () => cancelInstantInvite(invite.inviteId))}
            >
              {action === 'cancel' ? 'Cancelling…' : 'Cancel Request'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
