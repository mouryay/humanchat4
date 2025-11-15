import { query } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';

export interface CalendarConnectInput {
  userId: string;
  provider: 'google' | 'microsoft' | 'apple';
  accountEmail: string;
  calendarId: string;
  accessToken: string;
  refreshToken: string;
}

export const connectCalendar = async (input: CalendarConnectInput): Promise<void> => {
  await query(
    `INSERT INTO calendar_connections (user_id, provider, account_email, calendar_id, access_token, refresh_token, last_synced_at)
     VALUES ($1,$2,$3,$4,pgp_sym_encrypt($5, current_setting('humanchat.crypto_key')),
             pgp_sym_encrypt($6, current_setting('humanchat.crypto_key')), NOW())
     ON CONFLICT (user_id, provider)
     DO UPDATE SET account_email = EXCLUDED.account_email, calendar_id = EXCLUDED.calendar_id,
                   access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
                   last_synced_at = NOW()`,
    [
      input.userId,
      input.provider,
      input.accountEmail,
      input.calendarId,
      input.accessToken,
      input.refreshToken
    ]
  );
};

export const fetchCalendarAvailability = async (userId: string): Promise<{ slots: Array<{ start: string; end: string }> }> => {
  const result = await query(
    'SELECT provider, last_synced_at FROM calendar_connections WHERE user_id = $1',
    [userId]
  );
  if (!result.rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Calendar connection not found');
  }

  // Placeholder data - real implementation would call provider APIs.
  return {
    slots: [
      {
        start: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        end: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }
    ]
  };
};

export const triggerCalendarSync = async (userId: string): Promise<{ synced: boolean }> => {
  const result = await query(
    'UPDATE calendar_connections SET last_synced_at = NOW() WHERE user_id = $1 RETURNING *',
    [userId]
  );
  if (!result.rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Calendar connection not found');
  }
  return { synced: true };
};
