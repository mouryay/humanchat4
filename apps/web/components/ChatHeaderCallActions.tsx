/**
 * Call action buttons in chat header
 * Shows "Start video call" and "Start audio call" buttons
 */

'use client';

import { useState } from 'react';
import { Video, Phone } from 'lucide-react';
import { startCall } from '../services/callApi';
import { useRouter } from 'next/navigation';
import styles from './ConversationView.module.css';

interface ChatHeaderCallActionsProps {
  conversationId: string;
  isConversationAccepted: boolean;
}

export default function ChatHeaderCallActions({
  conversationId,
  isConversationAccepted,
}: ChatHeaderCallActionsProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  console.log('[ChatHeaderCallActions] Rendered:', { conversationId, isConversationAccepted });

  const handleStartCall = async (callType: 'video' | 'audio') => {
    console.log('[ChatHeaderCallActions] Starting call:', { conversationId, callType, isConversationAccepted });
    
    if (!isConversationAccepted) {
      console.warn('[ChatHeaderCallActions] Conversation not accepted');
      alert('Wait for the chat request to be accepted first');
      return;
    }

    setIsStarting(true);

    try {
      console.log('[ChatHeaderCallActions] Calling startCall API...');
      const result = await startCall({
        conversationId,
        callType,
      });
      
      console.log('[ChatHeaderCallActions] Call started successfully:', result);

      // Navigate to live room
      router.push(`/call/${result.callId}`);
    } catch (error: any) {
      console.error('[ChatHeaderCallActions] Failed to start call:', error);
      console.error('[ChatHeaderCallActions] Error details:', {
        status: error?.status,
        message: error?.message,
        fullError: JSON.stringify(error, null, 2)
      });
      
      if (error.status === 409) {
        alert('A call is already in progress');
      } else {
        alert(error.message || 'Failed to start call. Please try again.');
      }
    } finally {
      setIsStarting(false);
    }
  };

  // Always show buttons, but disable if not accepted
  return (
    <div className={styles.callButtons}>
      <button
        onClick={() => handleStartCall('video')}
        disabled={isStarting || !isConversationAccepted}
        className={styles.callButtonPrimary}
        aria-label="Start video call"
      >
        <Video size={18} />
        <span>Start video call</span>
      </button>

      <button
        onClick={() => handleStartCall('audio')}
        disabled={isStarting || !isConversationAccepted}
        className={styles.callButtonSecondary}
        aria-label="Start audio call"
      >
        <Phone size={18} />
        <span>Start audio call</span>
      </button>
    </div>
  );
}
