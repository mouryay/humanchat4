"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Message } from '../../../src/lib/db';
import type { ReactNode } from 'react';

interface VirtualMessageListProps {
  messages: Message[];
  className?: string;
  registerScrollContainer?: (node: HTMLDivElement | null) => void;
  children: (message: Message, index: number) => ReactNode;
}

export default function VirtualMessageList({ messages, className, registerScrollContainer, children }: VirtualMessageListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
      parentRef.current = node;
      registerScrollContainer?.(node);
    },
    [registerScrollContainer]
  );

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 8,
    getItemKey: (index) => messages[index]?.messageId ?? messages[index]?.id ?? index
  });

  useEffect(() => {
    if (!parentRef.current || messages.length === 0) {
      return;
    }

    virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
  }, [messages.length, virtualizer]);

  return (
    <div ref={handleRef} className={className} style={{ overflow: 'hidden' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%', paddingBottom: 0 }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index];
          if (!message) {
            console.error('VirtualMessageList: undefined message at index', virtualRow.index);
            return null;
          }
          // Use messageId as the React key, not virtualRow.key
          const messageKey = message.messageId ?? message.id ?? `fallback-${virtualRow.index}`;
          return (
            <div
              key={messageKey}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {children(message, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
