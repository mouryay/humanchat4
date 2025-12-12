'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import {
  db,
  getLatestInviteForConversation,
  type Conversation,
  type InstantInvite,
  type Message,
  type Session
} from '../../../src/lib/db';
import { SAM_CONCIERGE_ID, SAM_FALLBACK_CONVERSATION } from './useConversationData';

interface ConversationDetailState {
  conversation: Conversation | null;
  session: Session | null;
  invite: InstantInvite | null;
  messages: Message[];
  loading: boolean;
  error: Error | null;
}

const initialState: ConversationDetailState = {
  conversation: null,
  session: null,
  invite: null,
  messages: [],
  loading: false,
  error: null
};

const ensureSamConversation = async (): Promise<Conversation> => {
  const existing = await db.conversations.get(SAM_CONCIERGE_ID);
  if (existing) return existing;
  const seeded = { ...SAM_FALLBACK_CONVERSATION, lastActivity: Date.now() };
  await db.conversations.put(seeded);
  return seeded;
};

const fetchConversationDetail = async (conversationId: string) => {
  const conversation = await db.conversations.get(conversationId);
  if (!conversation) {
    if (conversationId === SAM_CONCIERGE_ID) {
      const seeded = await ensureSamConversation();
      const messages = await db.messages.where('conversationId').equals(seeded.conversationId).sortBy('timestamp');
      return { conversation: seeded, session: null, messages };
    }
    return null;
  }

  const [messages, session, invite] = await Promise.all([
    db.messages
      .where('conversationId')
      .equals(conversationId)
      .sortBy('timestamp'),
    conversation.linkedSessionId ? db.sessions.get(conversation.linkedSessionId) : null,
    getLatestInviteForConversation(conversationId)
  ]);

  return { conversation, session, messages, invite };
};

export const useConversationDetail = (conversationId?: string) => {
  const [state, setState] = useState<ConversationDetailState>(initialState);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    subscriptionRef.current?.unsubscribe();

    if (!conversationId) {
      setState(initialState);
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const subscription = liveQuery(() => fetchConversationDetail(conversationId)).subscribe({
      next: (result) => {
        if (!result) {
          console.log('[useConversationDetail] No result for conversationId:', conversationId);
          setState({ conversation: null, session: null, invite: null, messages: [], loading: false, error: null });
          return;
        }
        
        // Check for duplicate messages
        const messageIds = result.messages?.map(m => m.messageId || m.id).filter(Boolean) || [];
        const uniqueIds = new Set(messageIds);
        if (messageIds.length !== uniqueIds.size) {
          console.warn('[useConversationDetail] ⚠️  DUPLICATES DETECTED in IndexedDB!', {
            total: messageIds.length,
            unique: uniqueIds.size,
            messageIds: messageIds
          });
        }
        
        console.log('[useConversationDetail] Got result for conversationId:', conversationId, {
          conversation: result.conversation?.conversationId,
          messagesCount: result.messages?.length || 0,
          uniqueMessageIds: uniqueIds.size
        });
        const session = result.session ?? null;
        setState({ ...result, session, invite: result.invite ?? null, loading: false, error: null });
      },
      error: (err) => {
        console.error('[useConversationDetail] Error loading conversation:', err);
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ conversation: null, session: null, invite: null, messages: [], loading: false, error });
      }
    });

    subscriptionRef.current = subscription;

    return () => subscription.unsubscribe();
  }, [conversationId]);

  const summary = useMemo(() => state, [state]);

  return summary;
};
