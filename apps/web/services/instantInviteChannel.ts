'use client';

import { db, saveInstantInvite, type InstantInvite } from '../../../src/lib/db';
import { sessionStatusManager } from './sessionStatusManager';
import { INSTANT_INVITE_TARGETED_EVENT, type InstantInviteTargetedDetail } from '../constants/events';
import {
  mapConversationRecord,
  mapInviteRecord,
  mapSessionRecord,
  type ConversationRecord,
  type InstantInviteRecord,
  type SessionRecord
} from './conversationMapper';

interface InstantInviteNotification {
  type: 'instant_invite';
  event: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  invite: InstantInviteRecord;
  conversation?: ConversationRecord;
  session?: SessionRecord;
}

interface NewMessageNotification {
  type: 'new_message';
  userId: string;
  conversationId: string;
  message: {
    id: string;
    conversation_id: string;
    sender_id: string | null;
    content: string;
    message_type: 'user_text' | 'sam_response' | 'system_notice';
    actions?: unknown;
    created_at: string;
  };
}

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/^http/i, 'ws');

class InstantInviteChannel {
  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private unsubscribe?: () => void;
  private disposed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }
    this.unsubscribe = sessionStatusManager.onCurrentUserChange((nextUserId) => {
      this.userId = nextUserId;
      this.resetConnection();
    });
    this.userId = sessionStatusManager.getCurrentUserId();
    this.resetConnection();
  }

  private resetConnection(): void {
    this.ws?.close();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.userId && !this.disposed) {
      this.connect();
    }
  }

  private connect(): void {
    if (!this.userId || this.ws || this.disposed) {
      return;
    }
    try {
      this.ws = new WebSocket(`${WS_BASE_URL.replace(/\/$/, '')}/notifications/${this.userId}`);
      this.ws.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(event.data as string) as InstantInviteNotification | NewMessageNotification;
          if (payload?.type === 'instant_invite' && 'invite' in payload) {
            void this.handleInviteNotification(payload);
          } else if (payload?.type === 'new_message' && 'message' in payload) {
            void this.handleNewMessage(payload);
          }
        } catch (error) {
          console.warn('Failed to parse notification', error);
        }
      });
      this.ws.addEventListener('close', () => {
        this.ws = null;
        if (!this.disposed && this.userId) {
          this.reconnectTimer = setTimeout(() => this.connect(), 1500);
        }
      });
      this.ws.addEventListener('error', () => {
        this.ws?.close();
      });
    } catch (error) {
      console.warn('Instant invite channel failed to connect', error);
    }
  }

  private async handleInviteNotification(payload: InstantInviteNotification): Promise<void> {
    const invite = mapInviteRecord(payload.invite);
    await saveInstantInvite(invite);

    if (payload.conversation) {
      const participants = payload.conversation.participants ?? [];
      const conversation = mapConversationRecord(payload.conversation, participants, payload.conversation.linked_session_id ?? null);
      await db.conversations.put(conversation);
    }

    if (payload.session) {
      const session = mapSessionRecord(payload.session);
      await db.sessions.put(session);
    }

    this.emitTargetedInvite(invite);
  }

  private async handleNewMessage(payload: NewMessageNotification): Promise<void> {
    const { message, conversationId } = payload;
    
    console.log('Received new_message notification:', JSON.stringify(payload, null, 2));
    console.log('Message content:', message.content);
    
    if (!message.id) {
      console.warn('Message without ID received, cannot store:', message);
      return;
    }
    
    // Skip WebSocket sync for Sam conversations (they're purely client-side)
    const conversation = await db.conversations.get(conversationId);
    if (conversation?.type === 'sam') {
      console.log('Ignoring WebSocket message for Sam conversation (client-side only)');
      return;
    }
    
    const timestamp = new Date(message.created_at).getTime();
    
    const messageToAdd = {
      messageId: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id ?? '',
      content: message.content,
      timestamp,
      type: message.message_type,
      actions: message.actions ? (Array.isArray(message.actions) ? message.actions : [message.actions]) : undefined
    };
    
    console.log('Upserting message to IndexedDB:', messageToAdd);
    
    // Use put for upsert - with &messageId as primary key, this prevents duplicates
    await db.messages.put(messageToAdd);

    // Update conversation's lastActivity timestamp
    if (conversation) {
      await db.conversations.update(conversationId, {
        lastActivity: timestamp
      });
      console.log(`Updated conversation ${conversationId} lastActivity to ${timestamp}`);
    } else {
      console.warn(`Conversation ${conversationId} not found in IndexedDB`);
    }
  }

  private emitTargetedInvite(invite: InstantInvite): void {
    if (typeof window === 'undefined') return;
    if (!this.userId || invite.targetUserId !== this.userId) return;
    if (invite.status !== 'pending') return;

    const detail: InstantInviteTargetedDetail = {
      conversationId: invite.conversationId,
      inviteId: invite.inviteId
    };

    window.dispatchEvent(new CustomEvent<InstantInviteTargetedDetail>(INSTANT_INVITE_TARGETED_EVENT, { detail }));
  }

  public dispose(): void {
    this.disposed = true;
    this.ws?.close();
    this.unsubscribe?.();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

let channel: InstantInviteChannel | null = null;

export const initInstantInviteChannel = (): InstantInviteChannel => {
  if (!channel) {
    channel = new InstantInviteChannel();
  }
  return channel;
};

export const disposeInstantInviteChannel = (): void => {
  channel?.dispose();
  channel = null;
};
