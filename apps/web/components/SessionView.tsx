'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Conversation, InstantInvite, Message, Session } from '../../../src/lib/db';
import styles from './ConversationView.module.css';
import VideoArea, { type CallEndSummary } from './VideoArea';
import ChatArea from './ChatArea';
import EndCallFlow from './EndCallFlow';
import DonationModal from './DonationModal';
import { sessionStatusManager } from '../services/sessionStatusManager';
import VirtualMessageList from './VirtualMessageList';
import MessageBubble from './MessageBubble';
import InstantInvitePanel from './InstantInvitePanel';
import SystemMessageNotification from './SystemMessageNotification';

interface SessionViewProps {
  conversation: Conversation;
  session: Session | null;
  invite?: InstantInvite | null;
  messages: Message[];
  registerScrollContainer: (node: HTMLDivElement | null) => void;
  onScrollToLatest?: () => void;
  isMobile?: boolean;
}

const isUserMessage = (message: Message, conversation: Conversation) => {
  return conversation.participants.includes(message.senderId);
};

const formatCountdown = (target: number) => {
  const delta = Math.max(0, target - Date.now());
  const seconds = Math.floor(delta / 1000) % 60;
  const minutes = Math.floor(delta / (1000 * 60)) % 60;
  const hours = Math.floor(delta / (1000 * 60 * 60));
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export default function SessionView({ conversation, session, invite, messages, registerScrollContainer, onScrollToLatest, isMobile }: SessionViewProps) {
  const [now, setNow] = useState(Date.now());
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => sessionStatusManager.getCurrentUserId());
  const [callSummary, setCallSummary] = useState<(CallEndSummary & { peerName?: string }) | null>(null);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [callMode, setCallMode] = useState<'video' | 'audio' | null>(null);
  const [activeSystemMessage, setActiveSystemMessage] = useState<Message | null>(null);
  const [seenSystemMessageIds, setSeenSystemMessageIds] = useState<Set<number>>(new Set());
  const [videoFullscreen, setVideoFullscreen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = sessionStatusManager.onCurrentUserChange((userId) => setCurrentUserId(userId));
    return () => unsubscribe();
  }, []);

  const orderedMessages = useMemo(() => 
    [...messages]
      .filter((message) => {
        const content = message.content?.trim() || '';
        if (!content) return false;
        return true;
      })
      .sort((a, b) => a.timestamp - b.timestamp), 
    [messages]
  );
  
  const systemMessages = useMemo(() => {
    return orderedMessages.filter((msg) => msg.type === 'system_notice');
  }, [orderedMessages]);

  useEffect(() => {
    if (systemMessages.length === 0) {
      setActiveSystemMessage(null);
      return;
    }

    const unseenMessage = systemMessages
      .filter((msg) => msg.id !== undefined && !seenSystemMessageIds.has(msg.id))
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (unseenMessage && !activeSystemMessage && unseenMessage.id !== undefined) {
      const messageId = unseenMessage.id;
      setActiveSystemMessage(unseenMessage);
      setSeenSystemMessageIds((prev) => new Set([...prev, messageId]));
    }
  }, [systemMessages, seenSystemMessageIds, activeSystemMessage]);

  const peerLabel = useMemo(() => {
    const peer = conversation.participants.find((participant) => participant !== currentUserId);
    if (!peer) {
      return 'Session participant';
    }
    return conversation.participantLabels?.[peer] ?? peer;
  }, [conversation.participants, conversation.participantLabels, currentUserId]);

  useEffect(() => {
    setCallMode(null);
    setCallSummary(null);
    setShowDonationModal(false);
  }, [conversation.conversationId]);

  const handleDismissSystemMessage = () => {
    setActiveSystemMessage(null);
  };

  const handleCallEnd = (summary: CallEndSummary) => {
    setCallSummary({ ...summary, peerName: peerLabel });
    setShowDonationModal(false);
    setCallMode(null);
  };

  const handleDismissSummary = () => {
    setCallSummary(null);
    setShowDonationModal(false);
    onScrollToLatest?.();
  };

  // --- All hooks above, conditional rendering below ---

  const isInProgress = session?.status === 'in_progress';
  const isComplete = session?.status === 'complete';
  const isScheduled = !isInProgress && !isComplete && (session?.startTime ?? 0) > now;
  const shouldShowInvitePanel = Boolean(invite) && !isMobile;
  const invitePanel = shouldShowInvitePanel && invite ? <InstantInvitePanel invite={invite} currentUserId={currentUserId} /> : null;

  if (!session) {
    return (
      <div className={styles.humanView}>
        {invitePanel}
        {invite?.status === 'pending' && (
          <div className={styles.pendingSessionNotice}>
            <p className={styles.pendingSessionTitle}>Waiting for a host to accept</p>
            <p className={styles.pendingSessionSub}>Keep chatting here while we wait.</p>
          </div>
        )}
        <ChatArea
          conversation={conversation}
          messages={messages}
          registerScrollContainer={registerScrollContainer}
          currentUserId={currentUserId}
        />
        {activeSystemMessage && (
          <SystemMessageNotification
            message={activeSystemMessage}
            onDismiss={handleDismissSystemMessage}
          />
        )}
      </div>
    );
  }

  if (isScheduled) {
    return (
      <div className={styles.countdown}>
        {invitePanel}
        <strong>{formatCountdown(session.startTime)}</strong>
        <p>Session starts in</p>
      </div>
    );
  }

  if (isComplete) {
    const archivedMessages = orderedMessages.filter((msg) => msg.type !== 'system_notice');
    
    const getMessageGrouping = (index: number) => {
      const currentMessage = archivedMessages[index];
      const currentIsUser = isUserMessage(currentMessage, conversation);
      
      const isGrouped = index > 0 && (() => {
        const previousMessage = archivedMessages[index - 1];
        const previousIsUser = isUserMessage(previousMessage, conversation);
        return currentIsUser === previousIsUser;
      })();
      
      const isLastInGroup = index === archivedMessages.length - 1 || (() => {
        const nextMessage = archivedMessages[index + 1];
        const nextIsUser = isUserMessage(nextMessage, conversation);
        return currentIsUser !== nextIsUser;
      })();
      
      const isNewSpeaker = !isGrouped;
      
      return { isGrouped: !!isGrouped, isNewSpeaker, isLastInGroup };
    };
    
    return (
      <div className={styles.archivedView}>
        {invitePanel}
        <div className={styles.archivedNotice}>This session has ended. Messages are read-only.</div>
        <div className={styles.messageListContainer}>
          <VirtualMessageList messages={archivedMessages} className={styles.messageList} registerScrollContainer={registerScrollContainer}>
            {(message, index) => {
              const { isGrouped, isNewSpeaker, isLastInGroup } = getMessageGrouping(index ?? 0);
              return (
                <MessageBubble
                  message={message}
                  variant={isUserMessage(message, conversation) ? 'user' : 'sam'}
                  currentUserId={currentUserId}
                  conversation={conversation}
                  isGrouped={isGrouped}
                  isNewSpeaker={isNewSpeaker}
                  isLastInGroup={isLastInGroup}
                />
              );
            }}
          </VirtualMessageList>
        </div>
        {activeSystemMessage && (
          <SystemMessageNotification
            message={activeSystemMessage}
            onDismiss={handleDismissSystemMessage}
          />
        )}
      </div>
    );
  }

  if (!currentUserId) {
    return <div className={styles.error}>Sign in again to join this session.</div>;
  }

  const shouldShowDonationModal = Boolean(callSummary?.donationAllowed && !callSummary.confidentialRate && showDonationModal && session);
  const canLaunchCall = Boolean(session && currentUserId);
  const callActive = Boolean(callMode && canLaunchCall);

  return (
    <div className={styles.humanView}>
      {invitePanel}
      <div className={styles.chatSection} style={{ position: 'relative' }}>
        <ChatArea conversation={conversation} messages={messages} registerScrollContainer={registerScrollContainer} currentUserId={currentUserId} />
        {callActive && session && currentUserId && (
          <div className={videoFullscreen ? styles.videoOverlayFullscreen : styles.videoOverlayInline}>
            <VideoArea session={session} currentUserId={currentUserId} onCallEnd={handleCallEnd} mediaMode={callMode ?? 'video'} />
            <button
              type="button"
              className={styles.videoFullscreenToggle}
              onClick={() => setVideoFullscreen((prev) => !prev)}
              aria-label={videoFullscreen ? 'Exit fullscreen' : 'Go fullscreen'}
            >
              {videoFullscreen ? '⤡' : '⤢'}
            </button>
          </div>
        )}
      </div>
      {activeSystemMessage && (
        <SystemMessageNotification
          message={activeSystemMessage}
          onDismiss={handleDismissSystemMessage}
        />
      )}
      {callSummary && (
        <EndCallFlow
          summary={callSummary}
          onDismiss={handleDismissSummary}
          onDonate={callSummary.donationAllowed ? () => setShowDonationModal(true) : undefined}
        />
      )}
      {shouldShowDonationModal && callSummary && (
        <DonationModal
          sessionId={callSummary.sessionId}
          hostName={callSummary.peerName ?? 'your host'}
          charityName={callSummary.charityName}
          paymentMode={callSummary.paymentMode}
          onClose={() => setShowDonationModal(false)}
        />
      )}
    </div>
  );
}
