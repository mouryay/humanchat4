import { query } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import { Request, UserRole, type Conversation } from '../types/index.js';
import { ensureHumanConversation, attachParticipantLabels } from './conversationService.js';

export interface CreateRequestInput {
  requester_user_id: string;
  target_user_id: string;
  message: string;
  preferred_time?: string | null;
  budget_range?: string | null;
}

export const createRequest = async (input: CreateRequestInput): Promise<Request> => {
  if (input.requester_user_id === input.target_user_id) {
    throw new ApiError(400, 'INVALID_REQUEST', 'You cannot send a request to yourself.');
  }

  const targetUser = await query<{ name: string | null; is_online: boolean; has_active_session: boolean }>(
    `SELECT name, is_online, has_active_session
       FROM users
      WHERE id = $1`,
    [input.target_user_id]
  );

  const target = targetUser.rows[0];
  if (!target) {
    throw new ApiError(404, 'NOT_FOUND', 'Target user not found');
  }
  const displayName = target.name ?? 'That member';
  if (!target.is_online) {
    throw new ApiError(409, 'TARGET_OFFLINE', `${displayName} is offline right now.`);
  }
  if (target.has_active_session) {
    throw new ApiError(409, 'TARGET_BUSY', `${displayName} is already in another chat.`);
  }

  const insert = await query<Request>(
    `INSERT INTO requests (requester_user_id, target_user_id, manager_user_id, representative_name, message, preferred_time, budget_range, status, created_at)
     VALUES ($1,$2,NULL,NULL,$3,$4,$5,'pending',NOW()) RETURNING *`,
    [input.requester_user_id, input.target_user_id, input.message, input.preferred_time ?? null, input.budget_range ?? null]
  );
  return insert.rows[0];
};

export const listRequests = async (managerId: string): Promise<Request[]> => {
  const result = await query<Request>(
    `SELECT r.*
       FROM requests r
      WHERE r.target_user_id = $1
      ORDER BY r.created_at DESC`,
    [managerId]
  );
  return result.rows;
};

interface RequestActor {
  id: string;
  role: UserRole;
}

const assertActorCanUpdate = (request: Request, actor: RequestActor): void => {
  const isAdmin = actor.role === 'admin';
  const isManager = request.manager_user_id === actor.id;
  const isTarget = request.target_user_id === actor.id;

  if (isAdmin || isManager || isTarget) {
    return;
  }

  throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to update this request.');
};

export interface UpdateRequestResult {
  request: Request;
  conversation?: Conversation;
}

export const updateRequestStatus = async (
  requestId: string,
  status: Request['status'],
  actor: RequestActor
): Promise<UpdateRequestResult> => {
  const existing = await query<Request>('SELECT * FROM requests WHERE id = $1', [requestId]);
  const request = existing.rows[0];
  if (!request) {
    throw new ApiError(404, 'NOT_FOUND', 'Request not found');
  }

  assertActorCanUpdate(request, actor);
  const result = await query<Request>('UPDATE requests SET status = $2 WHERE id = $1 RETURNING *', [requestId, status]);
  const updated = result.rows[0];

  if (status !== 'approved') {
    return { request: updated };
  }

  const conversation = await ensureHumanConversation(updated.requester_user_id, updated.target_user_id);
  const hydrated = await attachParticipantLabels(conversation);
  return {
    request: updated,
    conversation: hydrated
  };
};
