import type { ChatRequest, Conversation } from '../../../src/lib/db';
import { mapConversationRecord, type ConversationRecord } from './conversationMapper';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ChatRequestPayload {
  id: string;
  requester_user_id: string;
  target_user_id: string;
  manager_user_id?: string | null;
  representative_name?: string | null;
  message: string;
  preferred_time?: string | null;
  budget_range?: string | null;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
}

export interface CreateConnectionRequestInput {
  targetUserId: string;
  message: string;
  preferredTime?: string;
  budgetRange?: string;
}

export interface UpdateRequestResult {
  request: ChatRequest;
  conversation?: Conversation;
}

const toCamelRequest = (request: ChatRequestPayload): ChatRequest => ({
  requestId: request.id,
  requesterId: request.requester_user_id,
  targetUserId: request.target_user_id,
  managerId: request.manager_user_id ?? null,
  representativeName: request.representative_name ?? null,
  message: request.message,
  preferredTime: request.preferred_time ?? null,
  budgetRange: request.budget_range ?? null,
  status: request.status,
  createdAt: Date.parse(request.created_at)
});

const toConversation = (record: ConversationRecord): Conversation => {
  const participants = Array.isArray(record.participants) ? record.participants : [];
  return mapConversationRecord(record, participants, record.linked_session_id ?? null);
};

export const fetchChatRequests = async (): Promise<ChatRequest[]> => {
  const response = await fetch(`${API_BASE_URL}/api/requests`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please refresh the page.');
    }
    const detail = await response.text().catch(() => '');
    let message = 'Unable to load requests.';
    try {
      const parsed = JSON.parse(detail);
      message = parsed?.error?.message ?? message;
    } catch {
      if (detail && detail.length < 200 && !detail.startsWith('{')) {
        message = detail;
      }
    }
    throw new Error(message);
  }

  const payload = await response.json();
  const data = payload?.data ?? payload;
  const rows = (data?.requests ?? []) as ChatRequestPayload[];
  return rows.map((row) => toCamelRequest(row));
};

export const submitConnectionRequest = async (input: CreateConnectionRequestInput) => {
  const response = await fetch(`${API_BASE_URL}/api/requests`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_user_id: input.targetUserId,
      message: input.message,
      preferred_time: input.preferredTime || undefined,
      budget_range: input.budgetRange || undefined
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Unable to send request.');
  }

  const payload = await response.json();
  const data = payload?.data ?? payload;
  if (!data?.request) {
    throw new Error('Malformed request response.');
  }
  return {
    api: data.request as ChatRequestPayload,
    local: toCamelRequest(data.request as ChatRequestPayload)
  };
};

export const updateRequestStatus = async (
  requestId: string,
  status: ChatRequestPayload['status']
): Promise<UpdateRequestResult> => {
  const response = await fetch(`${API_BASE_URL}/api/requests/${requestId}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please refresh the page.');
    }
    const detail = await response.text().catch(() => '');
    let message = 'Unable to update request.';
    try {
      const parsed = JSON.parse(detail);
      message = parsed?.error?.message ?? message;
    } catch {
      if (detail && detail.length < 200 && !detail.startsWith('{')) {
        message = detail;
      }
    }
    throw new Error(message);
  }

  const payload = await response.json();
  const data = payload?.data ?? payload;
  const request = data?.request as ChatRequestPayload | undefined;
  if (!request) {
    throw new Error('Malformed request status response.');
  }
  const result: UpdateRequestResult = {
    request: toCamelRequest(request)
  };
  const conversationPayload = data?.conversation as ConversationRecord | undefined;
  if (conversationPayload) {
    result.conversation = toConversation(conversationPayload);
  }
  return result;
};
