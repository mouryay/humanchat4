import nodemailer from 'nodemailer';
import { query } from '../db/postgres.js';
import { redis } from '../db/redis.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export type NotificationChannel = 'in_app' | 'email' | 'both';
export type NotificationStatus = 'unread' | 'read';
export type NotificationType = 'booking_scheduled' | 'booking_reminder_30m';

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  channel: NotificationChannel;
  status: NotificationStatus;
  dedupe_key: string | null;
  created_at: string;
  read_at: string | null;
}

interface ListNotificationsOptions {
  limit: number;
  offset: number;
}

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  channel?: NotificationChannel;
  dedupeKey?: string;
}

interface ScheduledParticipant {
  userId: string;
  name: string;
  email: string;
}

interface ScheduledNotificationInput {
  bookingId: string;
  expert: ScheduledParticipant;
  requester: ScheduledParticipant;
  startTime: string;
  durationMinutes: number;
  timezone?: string | null;
}

interface DueReminderRow {
  reminder_id: string;
  booking_id: string;
  start_time: string;
  duration_minutes: number;
  timezone: string | null;
  requester_id: string;
  requester_name: string | null;
  requester_email: string | null;
  responder_id: string;
  responder_name: string | null;
  responder_email: string | null;
}

const transporter = env.smtpHost
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort ?? 587,
      secure: (env.smtpPort ?? 587) === 465,
      auth: env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined
    })
  : nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    });

const fmtDateTime = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const createNotificationRecord = async (input: CreateNotificationInput): Promise<NotificationRecord | null> => {
  const result = await query<NotificationRecord>(
    `INSERT INTO notifications (user_id, type, title, body, payload, channel, status, dedupe_key, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'unread', $7, NOW())
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING *`,
    [
      input.userId,
      input.type,
      input.title,
      input.body,
      JSON.stringify(input.payload ?? {}),
      input.channel ?? 'both',
      input.dedupeKey ?? null
    ]
  );
  return result.rows[0] ?? null;
};

const publishInApp = async (userId: string, notification: NotificationRecord): Promise<void> => {
  await redis.publish(
    'notification',
    JSON.stringify({
      type: 'booking_notification',
      userId,
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        payload: notification.payload,
        status: notification.status,
        createdAt: notification.created_at
      }
    })
  );
};

const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  await transporter.sendMail({
    to,
    from: env.smtpFrom,
    subject,
    html
  });
};

const participantLabel = (participant: ScheduledParticipant): string => participant.name?.trim() || 'HumanChat member';

export const sendBookingScheduledNotifications = async (input: ScheduledNotificationInput): Promise<void> => {
  const startAtLabel = fmtDateTime(input.startTime);
  const participants: Array<{ self: ScheduledParticipant; other: ScheduledParticipant }> = [
    { self: input.requester, other: input.expert },
    { self: input.expert, other: input.requester }
  ];

  for (const pair of participants) {
    try {
      const title = 'Call Scheduled';
      const body = `Your call with ${participantLabel(pair.other)} is scheduled for ${startAtLabel}.`;
      const payload = {
        bookingId: input.bookingId,
        eventType: 'booking_scheduled',
        counterpartUserId: pair.other.userId,
        counterpartName: participantLabel(pair.other),
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        timezone: input.timezone ?? null
      };
      const dedupeKey = `booking_scheduled:${input.bookingId}:${pair.self.userId}`;

      const created = await createNotificationRecord({
        userId: pair.self.userId,
        type: 'booking_scheduled',
        title,
        body,
        payload,
        channel: 'both',
        dedupeKey
      });

      if (created) {
        await publishInApp(pair.self.userId, created);
        await sendEmail(
          pair.self.email,
          'Your HumanChat call is scheduled',
          `<p>Hi ${participantLabel(pair.self)},</p><p>${body}</p><p>Duration: ${input.durationMinutes} minutes.</p>`
        );
      }
    } catch (error) {
      logger.warn('Failed scheduled notification delivery', {
        bookingId: input.bookingId,
        userId: pair.self.userId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
};

const processReminderRow = async (row: DueReminderRow): Promise<void> => {
  if (!row.requester_email || !row.responder_email) {
    await query('UPDATE booking_reminders SET sent_at = NOW(), send_error = $2 WHERE id = $1', [
      row.reminder_id,
      'Missing participant email'
    ]);
    return;
  }

  const startAtLabel = fmtDateTime(row.start_time);
  const participants = [
    {
      userId: row.requester_id,
      name: row.requester_name?.trim() || 'HumanChat member',
      email: row.requester_email,
      counterpartUserId: row.responder_id,
      counterpartName: row.responder_name?.trim() || 'HumanChat member'
    },
    {
      userId: row.responder_id,
      name: row.responder_name?.trim() || 'HumanChat member',
      email: row.responder_email,
      counterpartUserId: row.requester_id,
      counterpartName: row.requester_name?.trim() || 'HumanChat member'
    }
  ];

  let hasErrors = false;
  for (const participant of participants) {
    try {
      const title = 'Call Reminder: starts in 30 minutes';
      const body = `Your call with ${participant.counterpartName} starts at ${startAtLabel}.`;
      const payload = {
        bookingId: row.booking_id,
        eventType: 'booking_reminder_30m',
        counterpartUserId: participant.counterpartUserId,
        counterpartName: participant.counterpartName,
        startTime: row.start_time,
        durationMinutes: row.duration_minutes,
        timezone: row.timezone
      };
      const dedupeKey = `booking_reminder_30m:${row.booking_id}:${participant.userId}`;
      const created = await createNotificationRecord({
        userId: participant.userId,
        type: 'booking_reminder_30m',
        title,
        body,
        payload,
        channel: 'both',
        dedupeKey
      });

      if (created) {
        await publishInApp(participant.userId, created);
        await sendEmail(
          participant.email,
          'Reminder: Your HumanChat call starts in 30 minutes',
          `<p>Hi ${participant.name},</p><p>${body}</p>`
        );
      }
    } catch (error) {
      hasErrors = true;
      logger.warn('Failed reminder notification delivery', {
        bookingId: row.booking_id,
        userId: participant.userId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  await query('UPDATE booking_reminders SET sent_at = NOW(), send_error = $2 WHERE id = $1', [
    row.reminder_id,
    hasErrors ? 'One or more participant deliveries failed' : null
  ]);
};

export const dispatchDueBookingReminderNotifications = async (): Promise<number> => {
  let processed = 0;
  const due = await query<DueReminderRow>(
    `SELECT
       br.id AS reminder_id,
       br.booking_id,
       COALESCE(b.scheduled_start, b.start_time)::text AS start_time,
       b.duration_minutes,
       b.timezone,
       b.requester_id,
       u_req.name AS requester_name,
       u_req.email AS requester_email,
       b.responder_id,
       u_res.name AS responder_name,
       u_res.email AS responder_email
     FROM booking_reminders br
     JOIN bookings b ON b.id = br.booking_id
     JOIN users u_req ON u_req.id = b.requester_id
     JOIN users u_res ON u_res.id = b.responder_id
     WHERE br.reminder_type = '30min'
       AND br.sent_at IS NULL
       AND br.send_at <= NOW()
       AND b.status::varchar IN ('scheduled', 'confirmed', 'awaiting_payment')
     ORDER BY br.send_at ASC
     LIMIT 30`
  );

  for (const row of due.rows) {
    try {
      await processReminderRow(row);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await query('UPDATE booking_reminders SET send_error = $2 WHERE id = $1', [row.reminder_id, message.slice(0, 800)]);
    }
  }

  return processed;
};

export const listNotificationsForUser = async (
  userId: string,
  options: ListNotificationsOptions
): Promise<NotificationRecord[]> => {
  const result = await query<NotificationRecord>(
    `SELECT *
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, options.limit, options.offset]
  );
  return result.rows;
};

export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM notifications
     WHERE user_id = $1 AND status = 'unread'`,
    [userId]
  );
  return Number(result.rows[0]?.count ?? '0');
};

export const markNotificationAsRead = async (userId: string, notificationId: string): Promise<boolean> => {
  const result = await query(
    `UPDATE notifications
     SET status = 'read', read_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  );
  return result.rows.length > 0;
};

export const markAllNotificationsAsRead = async (userId: string): Promise<number> => {
  const result = await query<{ id: string }>(
    `UPDATE notifications
     SET status = 'read', read_at = NOW()
     WHERE user_id = $1 AND status = 'unread'
     RETURNING id`,
    [userId]
  );
  return result.rows.length;
};

let reminderTimer: NodeJS.Timeout | null = null;
let reminderSweepRunning = false;

export const startBookingReminderDispatcher = (): void => {
  if (reminderTimer) {
    return;
  }

  const sweep = async () => {
    if (reminderSweepRunning) {
      return;
    }
    reminderSweepRunning = true;
    try {
      const count = await dispatchDueBookingReminderNotifications();
      if (count > 0) {
        logger.info('Processed booking reminder notifications', { count });
      }
    } catch (error) {
      logger.error('Booking reminder dispatch failed', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      reminderSweepRunning = false;
    }
  };

  void sweep();
  reminderTimer = setInterval(() => {
    void sweep();
  }, 60_000);
};
