'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation, Message } from '../../../src/lib/db';
import { sendMessage as sendMessageApi } from '../services/conversationClient';
import styles from './ConversationView.module.css';
import VirtualMessageList from './VirtualMessageList';
import MessageBubble from './MessageBubble';

interface ChatAreaProps {
  conversation: Conversation;
  messages: Message[];
  registerScrollContainer: (node: HTMLDivElement | null) => void;
  currentUserId: string | null;
}

export default function ChatArea({ conversation, messages, registerScrollContainer, currentUserId }: ChatAreaProps) {
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Filter out system messages and empty messages
  const orderedMessages = useMemo(() => {
    return [...messages]
      .filter((message) => {
        // Filter out system messages - they'll be shown as notifications instead
        if (message.type === 'system_notice') return false;
        // Filter out messages with empty or whitespace-only content
        const content = message.content?.trim() || '';
        if (!content) return false;
        return true;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [messages]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
    setIsTyping(true);
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    typingTimeout.current = setTimeout(() => setIsTyping(false), 1200);
  };

  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !currentUserId) return;
    setDraft('');
    setIsTyping(false);

    try {
      // Send message to backend API - backend will save to PostgreSQL and broadcast via WebSocket
      // The WebSocket notification will add it to IndexedDB for all participants (including sender)
      await sendMessageApi(conversation.conversationId, currentUserId, message, 'user_text');
    } catch (error) {
      console.error('Failed to send message:', error);
      // TODO: Show error toast to user
    }
  };

  const handleQuickReply = (message: Message) => {
    setDraft((prev) => (prev ? `${prev}\n${message.content}` : message.content));
  };

  // Determine message grouping for better spacing
  const getMessageGrouping = (index: number) => {
    const currentMessage = orderedMessages[index];
    const currentIsMine = currentUserId ? currentMessage.senderId === currentUserId : false;
    
    // Check previous message
    const isGrouped = index > 0 && (() => {
      const previousMessage = orderedMessages[index - 1];
      const previousIsMine = currentUserId ? previousMessage.senderId === currentUserId : false;
      return currentIsMine === previousIsMine;
    })();
    
    // Check next message to determine if this is the last in group
    const isLastInGroup = index === orderedMessages.length - 1 || (() => {
      const nextMessage = orderedMessages[index + 1];
      const nextIsMine = currentUserId ? nextMessage.senderId === currentUserId : false;
      return currentIsMine !== nextIsMine;
    })();
    
    const isNewSpeaker = !isGrouped;
    
    return { isGrouped: !!isGrouped, isNewSpeaker, isLastInGroup };
  };

  return (
    <div className={styles.chatArea}>
      <div className={styles.messageListContainer}>
        <VirtualMessageList messages={orderedMessages} className={styles.messageList} registerScrollContainer={registerScrollContainer}>
          {(message, index) => {
            const isMine = currentUserId ? message.senderId === currentUserId : false;
            const { isGrouped, isNewSpeaker, isLastInGroup } = getMessageGrouping(index ?? 0);
            return (
              <MessageBubble
                message={message}
                variant={isMine ? 'user' : 'sam'}
                onQuickReply={handleQuickReply}
                currentUserId={currentUserId}
                conversation={conversation}
                isGrouped={isGrouped}
                isNewSpeaker={isNewSpeaker}
                isLastInGroup={isLastInGroup}
              />
            );
          }}
        </VirtualMessageList>
        {isTyping && <div className={styles.typingIndicator}>Typing…</div>}
      </div>
      <form ref={formRef} className={styles.chatInputBar} onSubmit={handleSubmit}>
        <textarea
          placeholder="Message during session…"
          value={draft}
          onChange={handleChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (!currentUserId) {
                return;
              }
              formRef.current?.requestSubmit();
            }
          }}
          disabled={!currentUserId}
        />
        <button type="submit" disabled={!draft.trim() || !currentUserId}>
          Send
        </button>
      </form>
    </div>
  );
}
