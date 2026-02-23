/**
 * Google Calendar Integration Service
 * Handles OAuth flow, token refresh, and busy time fetching
 */

import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import { env } from '../config/env.js';

const oauth2Client = new OAuth2Client(
  env.googleClientId,
  env.googleClientSecret,
  `${env.apiBaseUrl}/api/experts/calendar/callback`
);

export interface CalendarConnection {
  id: string;
  expertId: string;
  provider: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  calendarId: string | null;
  syncEnabled: boolean;
  lastSyncAt: Date | null;
}

export interface BusyTimeSlot {
  start: Date;
  end: Date;
}

const mapCalendarConnection = (row: any): CalendarConnection => ({
  id: row.id,
  expertId: row.responder_id || row.expert_id,
  provider: row.provider,
  accessToken: row.access_token,
  refreshToken: row.refresh_token,
  tokenExpiresAt: row.token_expires_at,
  calendarId: row.calendar_id,
  syncEnabled: row.sync_enabled,
  lastSyncAt: row.last_sync_at
});

/**
 * Generate OAuth authorization URL for expert to connect Google Calendar
 */
export const getGoogleAuthUrl = (state?: string): string => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: state,
    prompt: 'consent' // Force consent to get refresh token
  });
};

/**
 * Exchange authorization code for tokens and store connection
 */
export const handleGoogleCallback = async (
  code: string,
  expertId: string
): Promise<CalendarConnection> => {
  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Invalid tokens received from Google');
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Get primary calendar ID
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items?.find((cal) => cal.primary);

    const result = await query(
      `INSERT INTO expert_calendar_connections 
       (responder_id, provider, access_token, refresh_token, token_expires_at, calendar_id, sync_enabled, last_sync_at)
       VALUES ($1, 'google', $2, $3, $4, $5, TRUE, NOW())
       ON CONFLICT (responder_id, provider)
       DO UPDATE SET 
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expires_at = EXCLUDED.token_expires_at,
         calendar_id = EXCLUDED.calendar_id,
         sync_enabled = TRUE,
         last_sync_at = NOW()
       RETURNING *`,
      [
        expertId,
        tokens.access_token,
        tokens.refresh_token,
        expiresAt,
        primaryCalendar?.id ?? 'primary'
      ]
    );

    return mapCalendarConnection(result.rows[0]);
  } catch (error: any) {
    console.error('Google Calendar callback error:', error);
    throw new ApiError(500, 'SERVER_ERROR', `Failed to connect calendar: ${error.message}`);
  }
};

/**
 * Refresh access token if expired
 */
const refreshAccessToken = async (connection: CalendarConnection): Promise<string> => {
  if (new Date() < connection.tokenExpiresAt) {
    return connection.accessToken;
  }

  try {
    oauth2Client.setCredentials({
      refresh_token: connection.refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('No access token in refresh response');
    }

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await query(
      `UPDATE expert_calendar_connections
       SET access_token = $1, token_expires_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [credentials.access_token, expiresAt, connection.id]
    );

    return credentials.access_token;
  } catch (error: any) {
    console.error('Token refresh error:', error);
    throw new ApiError(500, 'SERVER_ERROR', `Failed to refresh token: ${error.message}`);
  }
};

/**
 * Get calendar connection for expert
 */
export const getCalendarConnection = async (
  expertId: string
): Promise<CalendarConnection | null> => {
  const result = await query(
    `SELECT * FROM expert_calendar_connections
     WHERE responder_id = $1 AND provider = 'google' AND sync_enabled = TRUE`,
    [expertId]
  );

  return result.rows[0] ? mapCalendarConnection(result.rows[0]) : null;
};

/**
 * Fetch busy times from Google Calendar for a date range
 */
export const getGoogleCalendarBusyTimes = async (
  expertId: string,
  startDate: Date,
  endDate: Date
): Promise<BusyTimeSlot[]> => {
  const connection = await getCalendarConnection(expertId);

  if (!connection) {
    return []; // No calendar connected, no busy times
  }

  try {
    const accessToken = await refreshAccessToken(connection);

    oauth2Client.setCredentials({
      access_token: accessToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: connection.calendarId ?? 'primary' }]
      }
    });

    const calendars = response.data.calendars;
    const primaryCalendar = calendars?.[connection.calendarId ?? 'primary'];
    const busySlots = primaryCalendar?.busy ?? [];

    return busySlots.map((slot) => ({
      start: new Date(slot.start!),
      end: new Date(slot.end!)
    }));
  } catch (error: any) {
    console.error('Failed to fetch Google Calendar busy times:', error);
    // Don't throw - return empty array so booking can still work
    return [];
  }
};

/**
 * Create calendar event for a booking
 */
export const createCalendarEvent = async (
  expertId: string,
  booking: {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    startTime: Date;
    endTime: Date;
    title: string;
    notes?: string;
    meetingLink?: string;
  }
): Promise<string | null> => {
  const connection = await getCalendarConnection(expertId);

  if (!connection) {
    return null; // No calendar connected
  }

  try {
    const accessToken = await refreshAccessToken(connection);

    oauth2Client.setCredentials({
      access_token: accessToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event: calendar_v3.Schema$Event = {
      summary: booking.title,
      description: [
        booking.notes ?? '',
        booking.meetingLink ? `\n\nJoin Call: ${booking.meetingLink}` : '',
        `\n\nBooking ID: ${booking.id}`
      ].join(''),
      start: {
        dateTime: booking.startTime.toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: booking.endTime.toISOString(),
        timeZone: 'UTC'
      },
      attendees: [
        {
          email: booking.userEmail,
          displayName: booking.userName
        }
      ],
      conferenceData: booking.meetingLink
        ? {
            entryPoints: [
              {
                entryPointType: 'video',
                uri: booking.meetingLink,
                label: 'HumanChat Video Call'
              }
            ]
          }
        : undefined,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 15 }
        ]
      }
    };

    const response = await calendar.events.insert({
      calendarId: connection.calendarId ?? 'primary',
      requestBody: event,
      conferenceDataVersion: 1
    });

    return response.data.id ?? null;
  } catch (error: any) {
    console.error('Failed to create calendar event:', error);
    return null; // Don't throw - calendar event is optional
  }
};

/**
 * Delete calendar event for cancelled booking
 */
export const deleteCalendarEvent = async (
  expertId: string,
  eventId: string
): Promise<void> => {
  const connection = await getCalendarConnection(expertId);

  if (!connection || !eventId) {
    return;
  }

  try {
    const accessToken = await refreshAccessToken(connection);

    oauth2Client.setCredentials({
      access_token: accessToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: connection.calendarId ?? 'primary',
      eventId: eventId
    });
  } catch (error: any) {
    console.error('Failed to delete calendar event:', error);
    // Don't throw - event might already be deleted
  }
};

/**
 * Disconnect calendar for expert
 */
export const disconnectCalendar = async (expertId: string): Promise<void> => {
  await query(
    `UPDATE expert_calendar_connections
     SET sync_enabled = FALSE, updated_at = NOW()
     WHERE responder_id = $1 AND provider = 'google'`,
    [expertId]
  );
};
