import { query } from '../db/postgres.js';
import { redis } from '../db/redis.js';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../types/index.js';
import { logger } from '../utils/logger.js';

export type PresenceState = 'active' | 'idle' | 'offline';

const STATE_VALUES: PresenceState[] = ['active', 'idle', 'offline'];
export const DEFAULT_STALE_SECONDS = 120;
export const DEFAULT_IDLE_SECONDS = 60;
const DEFAULT_SWEEP_INTERVAL = 60000;

let sweepTimer: ReturnType<typeof setInterval> | null = null;

const normalizeState = (state: string): PresenceState => {
  const match = STATE_VALUES.find((value) => value === state);
  if (!match) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Unsupported presence state');
  }
  return match;
};

type PresencePayload = {
  type: 'presence';
  userId: string;
  isOnline: boolean;
  hasActiveSession: boolean;
  presenceState: PresenceState;
  lastSeenAt: number | null;
};

const derivePresencePayload = (user: User): PresencePayload => {
  const now = Date.now();
  const lastSeenMs = user.last_seen_at ? new Date(user.last_seen_at).getTime() : null;
  const withinStaleWindow = Boolean(lastSeenMs && now - lastSeenMs <= DEFAULT_STALE_SECONDS * 1000);
  const withinIdleWindow = Boolean(lastSeenMs && now - lastSeenMs <= DEFAULT_IDLE_SECONDS * 1000);

  const isOnline =
    Boolean(user.has_active_session) ||
    (Boolean(user.is_online) && user.presence_state !== 'offline' && withinStaleWindow);

  let presenceState: PresenceState = 'offline';
  if (Boolean(user.has_active_session)) {
    presenceState = 'active';
  } else if (isOnline) {
    presenceState = user.presence_state === 'idle' || !withinIdleWindow ? 'idle' : 'active';
  }

  return {
    type: 'presence',
    userId: user.id,
    isOnline,
    hasActiveSession: Boolean(user.has_active_session),
    presenceState,
    lastSeenAt: lastSeenMs
  };
};

const publishPresence = (user: User): void => {
  const payload = derivePresencePayload(user);
  void redis.publish(
    'status',
    JSON.stringify(payload)
  );
};

export const publishPresenceForUserId = async (userId: string): Promise<void> => {
  const result = await query<User>(
    'SELECT id, is_online, has_active_session, presence_state, last_seen_at FROM users WHERE id = $1',
    [userId]
  );
  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  publishPresence(user);
};

export const updateUserPresence = async (userId: string, state: PresenceState): Promise<User> => {
  const normalized = normalizeState(state);
  const result = await query<User>(
    `UPDATE users
     SET is_online = CASE
           WHEN $2::text = 'offline' AND has_active_session = FALSE THEN FALSE
           WHEN $2::text = 'offline' AND has_active_session = TRUE THEN TRUE
           ELSE TRUE
         END,
         presence_state = CASE
           WHEN has_active_session = TRUE AND $2::text = 'offline' THEN 'active'
           ELSE $2::text
         END,
         last_seen_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId, normalized]
  );

  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }

  publishPresence(user);
  return user;
};

export const recordHeartbeat = async (userId: string): Promise<User> => {
  const result = await query<User>(
    `UPDATE users
     SET last_seen_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId]
  );
  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  publishPresence(user);
  return user;
};

export const expireStalePresence = async (thresholdSeconds = DEFAULT_STALE_SECONDS): Promise<number> => {
  const interval = `${thresholdSeconds} seconds`;
  const result = await query<User>(
    `UPDATE users
     SET is_online = FALSE,
         presence_state = 'offline',
         updated_at = NOW()
     WHERE is_online = TRUE
       AND has_active_session = FALSE
       AND (last_seen_at IS NULL OR last_seen_at < NOW() - ($1::interval))
     RETURNING *`,
    [interval]
  );

  if (result.rowCount && result.rowCount > 0) {
    result.rows.forEach((user) => publishPresence(user));
    logger.info(`[presence] Reset ${result.rowCount} stale user(s) to offline`);
  }

  return result.rowCount ?? 0;
};

export const startPresenceSweep = (
  options: { intervalMs?: number; staleSeconds?: number } = {}
): (() => void) => {
  const { intervalMs = DEFAULT_SWEEP_INTERVAL, staleSeconds = DEFAULT_STALE_SECONDS } = options;
  if (sweepTimer) {
    return () => {
      /* no-op when already running */
    };
  }

  const runSweep = async () => {
    try {
      await expireStalePresence(staleSeconds);
    } catch (error) {
      logger.error('[presence] Failed to sweep stale users', error);
    }
  };

  void runSweep();
  sweepTimer = setInterval(runSweep, intervalMs);

  return () => {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  };
};

export const stopPresenceSweep = (): void => {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
};
