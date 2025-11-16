'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '../../../src/lib/db';
import { db } from '../../../src/lib/db';
import { VideoCall, type VideoCallState } from '../services/videoCall';
import { sessionStatusManager } from '../services/sessionStatusManager';
import { processSessionPayment } from '../services/sessionApi';
import SessionControls from './SessionControls';
import SessionTimer from './SessionTimer';
import BillingDisplay, { computeInstantTotal } from './BillingDisplay';
import styles from './ConversationView.module.css';

interface VideoAreaProps {
  session: Session;
  currentUserId: string;
  onCallEnd: (summary: { durationSeconds: number; totalAmount: number; paymentIntentId?: string; currency: string }) => void;
}

export default function VideoArea({ session, currentUserId, onCallEnd }: VideoAreaProps) {
  const callRef = useRef<VideoCall | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callState, setCallState] = useState<VideoCallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setMuted] = useState(false);
  const [isVideoOff, setVideoOff] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => Math.max(0, Math.floor((Date.now() - (session.startTime ?? Date.now())) / 1000)));
  const startTimestamp = useRef<number>(session.startTime ?? Date.now());
  const markedStartRef = useRef(false);
  const endingRef = useRef(false);

  const isInitiator = useMemo(() => session.hostUserId === currentUserId, [session.hostUserId, currentUserId]);

  const ensureCall = useCallback(() => {
    if (!callRef.current) {
      callRef.current = new VideoCall({
        sessionId: session.sessionId,
        userId: currentUserId,
        isInitiator
      });
    }
    return callRef.current;
  }, [session.sessionId, currentUserId, isInitiator]);

  const attachStream = useCallback((element: HTMLVideoElement | null, stream: MediaStream | null, mute = false) => {
    if (!element) return;
    element.srcObject = stream;
    element.muted = mute;
    if (stream) {
      void element.play().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const instance = ensureCall();
    const detachState = instance.on('state', (state) => {
      setCallState(state);
      if (state === 'connected' && !markedStartRef.current) {
        markedStartRef.current = true;
        startTimestamp.current = Date.now();
        sessionStatusManager
          .startSession(session.sessionId, currentUserId)
          .then(async () => {
            await db.sessions.put({ ...session, status: 'in_progress', startTime: startTimestamp.current });
          })
          .catch((err) => setError(err instanceof Error ? err.message : 'Unable to update session status'));
      }
    });
    const detachLocal = instance.on('localStream', (stream) => attachStream(localVideoRef.current, stream, true));
    const detachRemote = instance.on('remoteStream', (stream) => attachStream(remoteVideoRef.current, stream, false));
    const detachError = instance.on('error', (message) => setError(message));

    instance
      .start()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to start call');
      });

    return () => {
      detachState();
      detachLocal();
      detachRemote();
      detachError();
      instance.endCall();
      callRef.current = null;
    };
  }, [ensureCall, attachStream, session.sessionId, currentUserId, session]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (callState === 'connected') {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimestamp.current) / 1000)));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [callState]);

  const handleToggleMute = () => {
    const enabled = callRef.current?.toggleMute();
    if (typeof enabled === 'boolean') {
      setMuted(!enabled);
    }
  };

  const handleToggleVideo = () => {
    const enabled = callRef.current?.toggleVideo();
    if (typeof enabled === 'boolean') {
      setVideoOff(!enabled);
    }
  };

  const calculateTotal = () => {
    if (session.paymentMode === 'free') {
      return 0;
    }
    if (session.type === 'scheduled') {
      return session.agreedPrice;
    }
    return computeInstantTotal(session, elapsedSeconds);
  };

  const handleEndCall = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    callRef.current?.endCall();
    setCallState('ended');
    try {
      await sessionStatusManager.endSession(session.sessionId, currentUserId);
      await db.sessions.put({
        ...session,
        status: 'complete',
        endTime: Date.now(),
        durationMinutes: Math.max(1, Math.ceil(elapsedSeconds / 60))
      });
    } catch (err) {
      console.warn('Failed to update session end locally', err);
    }

    const total = calculateTotal();
    try {
      const payment = await processSessionPayment(total, session.sessionId);
      onCallEnd({
        durationSeconds: elapsedSeconds,
        totalAmount: payment.amount,
        currency: payment.currency,
        paymentIntentId: payment.paymentIntentId
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      onCallEnd({ durationSeconds: elapsedSeconds, totalAmount: total, currency: 'usd' });
    }
  };

  return (
    <div className={styles.videoAreaWrapper}>
      <div className={styles.videoStatsRow}>
        <BillingDisplay session={session} elapsedSeconds={elapsedSeconds} />
        <SessionTimer elapsedSeconds={elapsedSeconds} />
      </div>
      <div className={styles.videoStage}>
        <video ref={remoteVideoRef} playsInline autoPlay className={styles.remoteVideo} />
        <video ref={localVideoRef} playsInline autoPlay muted className={styles.localPreview} />
        {(callState !== 'connected' || error) && <div className={styles.videoOverlay}>{error ?? 'Connecting…'}</div>}
        <div className={styles.controlsOverlay}>
          <SessionControls isMuted={isMuted} isVideoOff={isVideoOff} onToggleMute={handleToggleMute} onToggleVideo={handleToggleVideo} onEndCall={handleEndCall} disabled={callState === 'connecting' || callState === 'failed'} />
        </div>
      </div>
    </div>
  );
}
