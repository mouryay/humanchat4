'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCallContext } from '../context/CallContext';
import { useAuthIdentity } from '../hooks/useAuthIdentity';
import { getCall } from '../services/callApi';
import CallShell from './CallShell';
import AudioCallPage from './AudioCallPage';
import VideoCallPage from './VideoCallPage';

/**
 * GlobalCallRoom - Mounts LiveKit room globally when a call is active
 * This keeps the connection alive even when user navigates away from /call/[callId]
 */
export default function GlobalCallRoom() {
  const { callId, callType, isMinimized, endCall: endCallContext } = useCallContext();
  const { identity } = useAuthIdentity();
  const [callData, setCallData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Load call data when callId changes
  useEffect(() => {
    if (!callId) {
      setCallData(null);
      return;
    }

    async function loadCall() {
      setLoading(true);
      try {
        const data = await getCall(callId);
        
        // If call is already ended, clear context
        if (data.status === 'ended' || data.status === 'declined' || data.status === 'missed') {
          endCallContext();
          return;
        }
        
        setCallData(data);
      } catch (err) {
        console.error('[GlobalCallRoom] Failed to load call:', err);
        endCallContext();
      } finally {
        setLoading(false);
      }
    }

    loadCall();
  }, [callId, endCallContext]);

  // Listen for call events via WebSocket
  useEffect(() => {
    if (!callId || !identity?.id) return;

    const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const wsUrl = `${WS_BASE_URL.replace(/\/$/, '')}/notifications/${identity.id}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // If call was declined or ended, handle it
        if (message.callId === callId && 
            (message.type === 'CALL_DECLINED' || message.type === 'CALL_ENDED' || message.type === 'CALL_TIMEOUT')) {
          
          // Show professional courtesy message for declined calls
          if (message.type === 'CALL_DECLINED') {
            const participantName = message.declinedBy?.name || callData?.participantName || 'The other party';
            alert(`${participantName} is currently busy and unable to take your call.`);
          } else if (message.type === 'CALL_TIMEOUT') {
            alert(`${callData?.participantName || 'The other party'} did not answer the call.`);
          }
          
          endCallContext();
          router.push('/chat');
        }
      } catch (error) {
        console.error('[GlobalCallRoom] Failed to parse WebSocket message:', error);
      }
    };

    // Fallback: Poll call status every 2 seconds
    const pollInterval = setInterval(async () => {
      try {
        const data = await getCall(callId);
        
        if (data.status === 'declined' || data.status === 'ended' || data.status === 'missed' || data.status === 'timeout') {
          clearInterval(pollInterval);
          
          // Show professional courtesy message
          if (data.status === 'declined') {
            alert(`${data.participantName || 'The other party'} is currently busy and unable to take your call.`);
          } else if (data.status === 'timeout' || data.status === 'missed') {
            alert(`${data.participantName || 'The other party'} did not answer the call.`);
          }
          
          endCallContext();
          router.push('/chat');
        }
      } catch (err) {
        // If call not found, end it
        clearInterval(pollInterval);
        endCallContext();
        router.push('/chat');
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [callId, identity?.id, endCallContext, router, callData?.participantName]);

  const handleEndCall = async () => {
    // Import and call endCall API
    try {
      const { endCall: endCallApi } = await import('../services/callApi');
      await endCallApi(callId!);
    } catch (err) {
      console.error('[GlobalCallRoom] Failed to end call:', err);
    } finally {
      // Always clear context and navigate
      endCallContext();
      if (callData?.conversationId) {
        router.push(`/chat?conversationId=${callData.conversationId}`);
      } else {
        router.push('/chat');
      }
    }
  };

  // Don't render anything if no active call
  if (!callId || !callData || loading) {
    return null;
  }

  // Determine if we should show the call UI
  // Hide if minimized
  const shouldShowCallUI = !isMinimized;

  return (
    <div
      className={`fixed inset-0 z-[9999] ${
        shouldShowCallUI ? 'block' : 'hidden'
      }`}
    >
      <CallShell
        roomName={callData.roomName}
        liveKitToken={callData.liveKitToken}
      >
        {callType === 'audio' ? (
          <AudioCallPage onEndCall={handleEndCall} />
        ) : (
          <VideoCallPage onEndCall={handleEndCall} />
        )}
      </CallShell>
    </div>
  );
}
