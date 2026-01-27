'use client';

import clsx from 'clsx';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { Conversation, Message } from '../../../src/lib/db';

interface MessageBubbleProps {
  message: Message;
  variant: 'sam' | 'user';
  children?: ReactNode;
  onQuickReply?: (message: Message) => void;
  currentUserId?: string | null;
  conversation?: Conversation | null;
}

const getVisibleMessageContent = (
  message: Message,
  currentUserId: string | null,
  conversation: Conversation | null
): string => {
  if (
    message.type !== 'system_notice' ||
    !message.actions ||
    message.actions.length === 0 ||
    !currentUserId ||
    !conversation
  ) {
    return message.content;
  }

  const bookingAction = message.actions.find(
    (a) => a.type === 'booking_cancelled' && a.payload
  );

  if (!bookingAction || !bookingAction.payload) {
    return message.content;
  }

  const { expertId } = bookingAction.payload as { expertId?: string };
  const userRole = currentUserId === expertId ? 'expert' : 'client';

  const roleSpecificAction = message.actions.find(
    (a) =>
      a.type === 'booking_cancelled' &&
      (a as any).visibility === userRole &&
      typeof (a as any).content === 'string'
  );

  return (roleSpecificAction as any)?.content ?? message.content;
};

export default function MessageBubble({
  message,
  variant,
  children,
  onQuickReply,
  currentUserId,
  conversation
}: MessageBubbleProps) {
  const touchStartX = useRef<number | null>(null);
  const touchDelta = useRef(0);
  const isSystemMessage = message.type === 'system_notice';

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    touchDelta.current = event.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;
    if (touchDelta.current > 60 && onQuickReply) {
      onQuickReply(message);
    }
    touchStartX.current = null;
    touchDelta.current = 0;
  };

  const content = getVisibleMessageContent(
    message,
    currentUserId ?? null,
    conversation ?? null
  );

  // Don't render empty bubbles
  if (!content || content.trim().length === 0) {
    return null;
  }

  // Premium message bubble styling
  const rowClass = clsx(
    "flex w-full mb-2",
    isSystemMessage ? "justify-center" : variant === 'sam' ? "justify-start" : "justify-end"
  );

  const bubbleClass = clsx(
    "px-4 py-3 rounded-2xl text-base leading-relaxed max-w-[80%] transition-all duration-base",
    isSystemMessage
      ? "bg-background-tertiary/50 border border-dashed border-border-medium text-text-secondary text-sm text-center"
      : variant === 'user'
      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm shadow-lg shadow-blue-500/20"
      : "bg-background-elevated border border-border-subtle text-text-primary rounded-bl-sm shadow-md"
  );

  const timeClass = clsx(
    "text-xs text-text-tertiary mt-1.5 px-1",
    variant === 'user' ? "text-right" : "text-left"
  );

  return (
    <div 
      className={rowClass} 
      onTouchStart={handleTouchStart} 
      onTouchMove={handleTouchMove} 
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex flex-col gap-1.5">
        <div className={bubbleClass}>
          {content}
        </div>
        {children}
        <span className={timeClass}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
