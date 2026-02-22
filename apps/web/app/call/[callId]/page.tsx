/**
 * Call page - /call/[callId]
 * Main entry point for video/audio calls with premium UI
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCall, endCall } from '@/services/callApi';
import { useCallContext } from '@/context/CallContext';
import { useAuthIdentity } from '@/hooks/useAuthIdentity';
import CallShell from '@/components/CallShell';
import AudioCallPage from '@/components/AudioCallPage';
import VideoCallPage from '@/components/VideoCallPage';

export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.callId as string;
  const { startCall, endCall: endCallContext } = useCallContext();
  const { identity, loading: identityLoading } = useAuthIdentity();

  const [callData, setCallData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen for call events via WebSocket - set up immediately
  useEffect(() => {
    const userId = identity?.id;
    if (!userId) {
      return;
    }

    const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const wsUrl = `${WS_BASE_URL.replace(/\/$/, '')}/notifications/${userId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // WebSocket connected
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // If call was declined or ended, close this call window
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
        console.error('[CallPage] Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[CallPage] WebSocket error:', error);
    };

    ws.onclose = () => {
      // WebSocket closed
    };

    // Fallback: Poll call status every 1 second to detect if call ended
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
        // If call not found, navigate away
        clearInterval(pollInterval);
        endCallContext();
        router.push('/chat');
      }
    }, 1000); // Poll every 1 second for faster response

    return () => {
      clearInterval(pollInterval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [callId, endCallContext, router, identity?.id, identityLoading]); // Re-run when identity loads

  useEffect(() => {
    async function loadCall() {
      try {
        const data = await getCall(callId);
        
        if (data.status === 'ended' || data.status === 'declined' || data.status === 'missed') {
          setError('This call has already ended');
          setTimeout(() => router.push('/chat'), 2000);
          return;
        }

        setCallData(data);
        
        // Initialize call context
        startCall({
          callId,
          callType: data.callType,
          conversationId: data.conversationId,
          participantName: data.participantName || 'Unknown',
          participantAvatar: data.participantAvatar,
        });
      } catch (err: any) {
        console.error('Failed to load call:', err);
        setError(err.message || 'Failed to load call');
        setTimeout(() => router.push('/chat'), 2000);
      } finally {
        setLoading(false);
      }
    }

    loadCall();
  }, [callId, router, startCall]);

  const handleEndCall = async () => {
    try {
      await endCall(callId);
      endCallContext();
      router.push(`/chat?conversationId=${callData.conversationId}`);
    } catch (err: any) {
      // If call is already ended/declined, just clear context and navigate
      if (err?.message?.includes('ended') || err?.message?.includes('declined') || err?.status === 400) {
        // Call already ended
      }
      endCallContext();
      router.push('/chat');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a1f3a] via-[#0f1419] to-[#000000] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-xl">Connecting...</p>
        </div>
      </div>
    );
  }

  if (error || !callData) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a1f3a] via-[#0f1419] to-[#000000] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error || 'Call not found'}</div>
          <p className="text-gray-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <CallShell
      roomName={callData.roomName}
      liveKitToken={callData.liveKitToken}
    >
      {callData.callType === 'audio' ? (
        <AudioCallPage onEndCall={handleEndCall} />
      ) : (
        <VideoCallPage onEndCall={handleEndCall} />
      )}
    </CallShell>
  );
}
