import { query } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import { Request } from '../types/index.js';

export interface CreateRequestInput {
  requester_user_id: string;
  target_user_id: string;
  message: string;
}

export const createRequest = async (input: CreateRequestInput): Promise<Request> => {
  const insert = await query<Request>(
    `INSERT INTO requests (requester_user_id, target_user_id, message, status, created_at)
     VALUES ($1,$2,$3,'pending',NOW()) RETURNING *`,
    [input.requester_user_id, input.target_user_id, input.message]
  );
  return insert.rows[0];
};

export const listRequests = async (managerId: string): Promise<Request[]> => {
  const result = await query<Request>(
    `SELECT r.* FROM requests r
     JOIN users u ON r.target_user_id = u.id
     WHERE u.manager_id = $1
     ORDER BY r.created_at DESC`,
    [managerId]
  );
  return result.rows;
};

export const updateRequestStatus = async (requestId: string, status: Request['status']): Promise<Request> => {
  const result = await query<Request>(
    'UPDATE requests SET status = $2 WHERE id = $1 RETURNING *',
    [requestId, status]
  );
  if (!result.rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Request not found');
  }
  return result.rows[0];
};
