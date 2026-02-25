import { query } from '../db/postgres.js';
import { redis } from '../db/redis.js';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../types/index.js';
import type { PresenceState } from './presenceService.js';
import { DEFAULT_IDLE_SECONDS, DEFAULT_STALE_SECONDS } from './presenceService.js';

const HUMAN_FALLBACK = 'Human';
const ONLINE_TTL_SECONDS = DEFAULT_STALE_SECONDS;
const IDLE_TTL_SECONDS = DEFAULT_IDLE_SECONDS;

const normalizeProfileCopy = (value?: string | null): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : HUMAN_FALLBACK;
};

const applyHumanDefaults = <T extends Pick<User, 'headline' | 'bio'>>(record: T): T => {
  return {
    ...record,
    headline: normalizeProfileCopy(record.headline),
    bio: normalizeProfileCopy(record.bio)
  };
};

export const getUserById = async (id: string): Promise<User> => {
  const result = await query<User>('SELECT * FROM users WHERE id = $1', [id]);
  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  return applyHumanDefaults(user);
};

export const updateUserProfile = async (id: string, updates: Partial<User>): Promise<User> => {
  const fields = Object.keys(updates);
  if (fields.length === 0) {
    return getUserById(id);
  }

  const setFragments = fields.map((field, index) => `${field} = $${index + 2}`);
  const values = Object.values(updates);

  await query<User>(`UPDATE users SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $1`, [id, ...values]);
  return getUserById(id);
};

export const searchUsers = async (
  q: string,
  online?: boolean,
  sort?: 'default' | 'recent',
  limit?: number
): Promise<User[]> => {
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(headline) LIKE $${params.length})`;
  }

  if (online !== undefined) {
    params.push(online);
    where += ` AND (is_online = $${params.length} OR has_active_session = $${params.length})`;
    if (online) {
      params.push(`${ONLINE_TTL_SECONDS} seconds`);
      where += ` AND (
        has_active_session = TRUE
        OR (
          last_seen_at IS NOT NULL
          AND last_seen_at > NOW() - ($${params.length}::interval)
          AND presence_state <> 'offline'
        )
      )`;
    }
  }

  const orderBy = sort === 'recent' ? 'created_at DESC' : 'is_online DESC, name ASC';
  const rowLimit = Math.min(limit ?? 50, 50);
  const sql = `SELECT * FROM users ${where} ORDER BY ${orderBy} LIMIT ${rowLimit}`;
  const result = await query<User>(sql, params);
  return result.rows.map(applyHumanDefaults);
};

export const getUserAvailability = async (userId: string): Promise<{ slots: Array<{ start: string; end: string }> }> => {
  // Placeholder: would call calendar service, for now return cached data if exists.
  const cacheKey = `availability:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  const slots = [{ start: new Date().toISOString(), end: new Date(Date.now() + 30 * 60 * 1000).toISOString() }];
  await redis.set(cacheKey, JSON.stringify({ slots }), 'EX', 300);
  return { slots };
};

export const getUserStatus = async (
  userId: string
): Promise<{
  status: 'online' | 'online_in_call' | 'offline' | 'idle';
  presenceState: PresenceState;
  isOnline: boolean;
  hasActiveSession: boolean;
  lastSeenAt: string | null;
}> => {
  const result = await query<User>(
    'SELECT is_online, has_active_session, presence_state, last_seen_at FROM users WHERE id = $1',
    [userId]
  );
  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  const lastSeenAtMs = user.last_seen_at ? Date.parse(user.last_seen_at as string) : null;
  const now = Date.now();
  const isWithinOnlineWindow = Boolean(lastSeenAtMs && now - lastSeenAtMs <= ONLINE_TTL_SECONDS * 1000);
  const isWithinIdleWindow = Boolean(lastSeenAtMs && now - lastSeenAtMs <= IDLE_TTL_SECONDS * 1000);
  const isOnlineEffective =
    Boolean(user.has_active_session) ||
    (Boolean(user.is_online) && user.presence_state !== 'offline' && isWithinOnlineWindow);

  let presenceState: PresenceState = 'offline';
  if (Boolean(user.has_active_session)) {
    presenceState = 'active';
  } else if (isOnlineEffective) {
    presenceState = user.presence_state === 'idle' || !isWithinIdleWindow ? 'idle' : 'active';
  }

  let status: 'online' | 'online_in_call' | 'offline' | 'idle' = 'offline';
  if (Boolean(user.has_active_session)) {
    status = 'online_in_call';
  } else if (!isOnlineEffective) {
    status = 'offline';
  } else if (presenceState === 'idle') {
    status = 'idle';
  } else {
    status = 'online';
  }
  return {
    status,
    presenceState,
    isOnline: isOnlineEffective,
    hasActiveSession: Boolean(user.has_active_session),
    lastSeenAt: user.last_seen_at ?? null
  };
};
