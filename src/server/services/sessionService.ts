import { PoolClient } from 'pg';
import { query, transaction } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import { redis } from '../db/redis.js';
import { Session } from '../types/index.js';
import { publishPresenceForUserId } from './presenceService.js';

interface SessionPayload {
  host_user_id: string;
  guest_user_id: string;
  conversation_id: string;
  type: 'instant' | 'scheduled';
  start_time: string;
  duration_minutes: number;
  agreed_price: number;
  payment_mode: 'free' | 'paid' | 'charity';
}

const insertSession = async (client: PoolClient, payload: SessionPayload): Promise<Session> => {
  const insert = await client.query<Session>(
      `INSERT INTO sessions (host_user_id, guest_user_id, conversation_id, type, status, start_time, duration_minutes, agreed_price, payment_mode, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,NOW(),NOW()) RETURNING *`,
      [
        payload.host_user_id,
        payload.guest_user_id,
        payload.conversation_id,
        payload.type,
        payload.start_time,
        payload.duration_minutes,
        payload.agreed_price,
        payload.payment_mode
      ]
    );

  await client.query('UPDATE conversations SET linked_session_id = $1 WHERE id = $2', [
    insert.rows[0].id,
    payload.conversation_id
  ]);

  return insert.rows[0];
};

export const createSessionRecord = async (payload: SessionPayload, client?: PoolClient): Promise<Session> => {
  if (client) {
    return insertSession(client, payload);
  }
  return transaction((txClient) => insertSession(txClient, payload));
};

export const getSessionById = async (id: string): Promise<Session> => {
  const result = await query<Session>('SELECT * FROM sessions WHERE id = $1', [id]);
  const session = result.rows[0];
  if (!session) {
    throw new ApiError(404, 'NOT_FOUND', 'Session not found');
  }
  return session;
};

export const updateSessionStatus = async (id: string, status: Session['status']): Promise<Session> => {
  const result = await query<Session>(
    'UPDATE sessions SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
    [id, status]
  );
  const session = result.rows[0];
  if (!session) {
    throw new ApiError(404, 'NOT_FOUND', 'Session not found');
  }
  await redis.publish('session', JSON.stringify({ sessionId: id, status }));
  return session;
};

const syncUserSessionFlags = async (client: PoolClient, userIds: string[]): Promise<void> => {
  if (userIds.length === 0) return;
  await client.query(
    `UPDATE users u
     SET has_active_session = EXISTS (
       SELECT 1
       FROM sessions s
       WHERE (s.host_user_id = u.id OR s.guest_user_id = u.id)
         AND s.status = 'in_progress'
     ),
     updated_at = NOW()
     WHERE u.id = ANY($1::text[])`,
    [userIds]
  );
};

export const markSessionStart = async (id: string): Promise<Session> => {
  const session = await transaction(async (client) => {
    const result = await client.query<Session>(
      'UPDATE sessions SET status = $2, start_time = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, 'in_progress']
    );
    const updated = result.rows[0];
    if (!updated) {
      throw new ApiError(404, 'NOT_FOUND', 'Session not found');
    }

    await syncUserSessionFlags(client, [updated.host_user_id, updated.guest_user_id]);
    return updated;
  });

  await redis.publish('session', JSON.stringify({ sessionId: id, event: 'start' }));
  await Promise.allSettled([publishPresenceForUserId(session.host_user_id), publishPresenceForUserId(session.guest_user_id)]);
  return session;
};

export const markSessionEnd = async (id: string): Promise<Session> => {
  const session = await transaction(async (client) => {
    const result = await client.query<Session>(
      `UPDATE sessions
       SET status = 'complete', end_time = NOW(), duration_minutes = EXTRACT(EPOCH FROM (NOW() - start_time))/60,
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    const updated = result.rows[0];
    if (!updated) {
      throw new ApiError(404, 'NOT_FOUND', 'Session not found');
    }

    await syncUserSessionFlags(client, [updated.host_user_id, updated.guest_user_id]);
    return updated;
  });

  await redis.publish('session', JSON.stringify({ sessionId: id, event: 'end' }));
  await Promise.allSettled([publishPresenceForUserId(session.host_user_id), publishPresenceForUserId(session.guest_user_id)]);
  return session;
};
