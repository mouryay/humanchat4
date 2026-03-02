/**
 * Listens for incoming call notifications via WebSocket
 * Shows IncomingCallModal when a call is received
 */

'use client';

import { useEffect, useState } from 'react';
import IncomingCallModal from './IncomingCallModal';
import { sessionStatusManager } from '../services/sessionStatusManager';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

interface CallRingingMessage {
  type: 'CALL_RINGING';
  callId: string;
  conversationId: string;
  caller: {
    userId: string;
    name: string;
    avatar?: string;
  };
  callType: 'video' | 'audio';
  initiatedAt: string;
}

export default function CallNotificationListener() {
  const [incomingCall, setIncomingCall] = useState<CallRingingMessage | null>(null);

  useEffect(() => {
    // Get current user ID from sessionStatusManager
    const userId = sessionStatusManager.getCurrentUserId();
    
    if (!userId) {
      console.log('[CallListener] No userId found, skipping WebSocket connection');
      return;
    }

    console.log('[CallListener] Connecting for user:', userId);

    // Connect to WebSocket for call notifications
    const ws = new WebSocket(`${WS_BASE_URL.replace(/\/$/, '')}/notifications/${userId}`);

    ws.onopen = () => {
      console.log('[CallListener] Connected to call notification WebSocket');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[CallListener] 📨 Received message:', message);

        if (message.type === 'CALL_RINGING') {
          console.log('[CallListener] 📞 INCOMING CALL from:', message.caller.name);
          console.log('[CallListener] Setting incoming call state...');
          setIncomingCall(message as CallRingingMessage);
        } else if (message.type === 'CALL_DECLINED' || message.type === 'CALL_ENDED' || message.type === 'CALL_TIMEOUT') {
          console.log('[CallListener] Call ended/declined/timeout:', message.type);
          // Clear incoming call modal
          setIncomingCall(null);
          
          // If user is in an active call, force disconnect
          if (message.type === 'CALL_ENDED' && window.location.pathname.includes('/call/')) {
            console.log('[CallListener] Forcing disconnect from active call');
            window.location.href = '/chat';
          }
        }
      } catch (error) {
        console.error('[CallListener] Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[CallListener] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[CallListener] WebSocket connection closed');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []); // Run once on mount

  const handleDismiss = () => {
    setIncomingCall(null);
  };

  if (!incomingCall) {
    return null;
  }

  console.log('[CallListener] 🔔 Rendering IncomingCallModal for call:', incomingCall.callId);

  return (
    <IncomingCallModal
      callId={incomingCall.callId}
      caller={incomingCall.caller}
      callType={incomingCall.callType}
      onClose={handleDismiss}
    />
  );
}
